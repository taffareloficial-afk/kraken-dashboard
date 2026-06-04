/**
 * useLancamentos — core data hook.
 *
 * Persistence strategy (priority order):
 *  1. Always writes to localStorage  (instant, works offline).
 *  2. Supabase  — when syncBackend='supabase' (SUPABASE_ENABLED=true).
 *     • user_id = userId ?? 'offline'  (works without auth)
 *     • table: lancamentos  (id, data, tipo, descricao, valor, categoria, created_at, user_id)
 *     • descricao stores the full JSON of each item so no fields are lost
 *     • per-mutation upsert/delete (no full-array debounce)
 *     • Realtime subscription for cross-device live sync
 *  3. Firebase  — when syncBackend='firebase' (legacy, full-array debounce).
 *  4. localStorage only — fallback when no backend is active.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PORTFOLIO } from '../constants';

// Firebase
import { db, FIREBASE_ENABLED } from '../lib/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Supabase (fetch-based micro-client)
import { sbFetch, SUPABASE_ENABLED } from '../lib/supabase';
// Classificador único de ativos por ticker
import { classifyTickerPlural } from '../utils/assetClass';

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_KEY       = 'kraken_lancamentos';
const RESET_KEY    = 'kraken_reset_v1';
// IDs que já foram enviados ao Supabase pelo menos uma vez.
// Permite distinguir "item novo local" de "item deletado em outro device".
const SYNCED_IDS_KEY = 'kraken_synced_ids';
// Chaves de proventos (ticker|tipo|YYYY-MM) que o usuário DELETOU manualmente.
// Impede que o auto-log de proventos os recrie no próximo carregamento.
const SUPPRESS_KEY = 'kraken_suppressed_autolog';

const KRAKEN_KEYS = [
  'kraken_lancamentos',
  'kraken_seed_v1',
  'kraken_compra_seed_v1',
  'kraken_cleanup_v1',
  'kraken_proventos',
];

// ── Safe localStorage helpers ─────────────────────────────────────────────────
function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { console.warn('[kraken] localStorage.setItem failed:', e?.name ?? e); }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

function load() {
  try {
    if (!lsGet(RESET_KEY)) {
      KRAKEN_KEYS.forEach(lsRemove);
      lsSet(RESET_KEY, '1');
      return [];
    }
    return JSON.parse(lsGet(LS_KEY) ?? '[]') ?? [];
  } catch {
    return [];
  }
}

function persist(data) {
  lsSet(LS_KEY, JSON.stringify(data));
}

/** Carrega o Set de IDs já sincronizados com o Supabase */
function loadSyncedIds() {
  try { return new Set(JSON.parse(lsGet(SYNCED_IDS_KEY) ?? '[]')); }
  catch { return new Set(); }
}

/** Persiste o Set de IDs sincronizados */
function saveSyncedIds(ids) {
  lsSet(SYNCED_IDS_KEY, JSON.stringify([...ids]));
}

/** Chave canônica de provento para o auto-log: ticker|tipo|YYYY-MM */
function proventoKey(item) {
  if (!item?.ticker || !item?.date) return null;
  return `${item.ticker}|${item.type}|${item.date.slice(0, 7)}`;
}

/** Carrega o Set de chaves de proventos suprimidas (deletadas pelo usuário) */
export function loadSuppressedAutologKeys() {
  try { return new Set(JSON.parse(lsGet(SUPPRESS_KEY) ?? '[]')); }
  catch { return new Set(); }
}

/** Adiciona uma chave à lista de proventos suprimidos */
function addSuppressedKey(key) {
  if (!key) return;
  const s = loadSuppressedAutologKeys();
  s.add(key);
  lsSet(SUPPRESS_KEY, JSON.stringify([...s]));
}

// ── Asset-type normalisation ──────────────────────────────────────────────────
const ASSET_TYPE_MAP = { 'ETFs Int.': 'ETFs', 'Tesouro': 'Renda Fixa' };
const normalizeType  = (t) => ASSET_TYPE_MAP[t] ?? t ?? 'Ações';

// ══════════════════════════════════════════════════════════════════════════════
// Supabase row mappers
// The app stores rich objects; we serialise the full item into `descricao`
// so every field survives a round-trip through the DB columns.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * App item → Supabase lancamentos row
 *
 * Mapeamento de campos localStorage → colunas Supabase:
 *   ticker    → ativo
 *   type      → tipo
 *   date      → data
 *   createdAt → created_at
 *   price     → preco       (operações)
 *   quantity  → quantidade  (operações)
 *   amount    → preco       (proventos, quantidade = 1)
 *   total     → total
 *   category  → category
 *   assetName, assetType → ignorados (não existem na tabela)
 */
function toRow(item, uid) {
  const isProvento = item.category === 'provento';
  return {
    id:           item.id,
    ativo:        item.ticker    ?? null,
    tipo:         item.type      ?? null,
    data:         item.date      ?? null,
    created_at:   item.createdAt ?? new Date().toISOString(),
    preco:        isProvento
                    ? (Number(item.amount)   || 0)
                    : (Number(item.price)    || 0),
    quantidade:   isProvento
                    ? 1
                    : (Number(item.quantity) || 0),
    total:        Number(item.total) || 0,
    category:     item.category  ?? null,
    outros_custos: 0,
    user_id:      uid ?? 'offline',
  };
}

/**
 * Infere o tipo de ativo pelo ticker (necessário porque assetType não está no Supabase).
 * Usa o classificador compartilhado (whitelist de ETFs + lista de ações-unit como
 * TAEE11), retornando a convenção plural usada em adjustedPortfolio/KRAKEN_MODEL.
 */
function inferAssetType(ticker) {
  return classifyTickerPlural(ticker);
}

/**
 * Supabase lancamentos row → app item
 *
 * Mapeamento inverso: colunas Supabase → campos app.
 * Inclui assetType/assetName inferidos para que adjustedPortfolio
 * consiga incluir tickers não listados no PORTFOLIO estático.
 */
function fromRow(row) {
  const isProvento = row.category === 'provento';
  const ticker     = row.ativo ?? null;
  return {
    id:        row.id,
    ticker,
    type:      row.tipo ? row.tipo.toLowerCase() : null,
    date:      row.data       ?? null,
    createdAt: row.created_at ?? null,
    price:     isProvento ? null : (row.preco     ?? 0),
    quantity:  isProvento ? null : (row.quantidade ?? 0),
    amount:    isProvento ? (row.preco ?? 0) : null,
    total:     row.total      ?? 0,
    category:  row.category   ?? null,
    // Inferidos — necessários para adjustedPortfolio calcular corretamente
    assetType: inferAssetType(ticker),
    assetName: ticker,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * @param {string|null} userId     — auth UID (Supabase user.id or Firebase user.uid)
 * @param {'supabase'|'firebase'|'none'} syncBackend
 */
export function useLancamentos(userId = null, syncBackend = 'firebase') {
  const [lancamentos, setLancamentos] = useState(load);
  const [syncStatus,  setSyncStatus]  = useState('idle');

  // Tracks current state so mutations can read it without stale closure
  const lancamentosRef = useRef(lancamentos);
  useEffect(() => { lancamentosRef.current = lancamentos; }, [lancamentos]);

  // Debounce timer — Firebase only (Supabase does per-item ops)
  const fbSyncTimer = useRef(null);

  // True while applying a remote snapshot → suppresses echo writes
  const applyingSnapshot = useRef(false);

  // ── Firebase debounced full-array write ──────────────────────────────────────
  const syncFirebase = useCallback((items) => {
    if (applyingSnapshot.current || !FIREBASE_ENABLED || !db || !userId) return;
    setSyncStatus('syncing');
    clearTimeout(fbSyncTimer.current);
    fbSyncTimer.current = setTimeout(() => {
      const ref = doc(db, 'users', userId, 'data', 'state');
      setDoc(ref, { lancamentos: items, lastUpdated: serverTimestamp() })
        .then(() => setSyncStatus('synced'))
        .catch(err => {
          console.error('[Kraken] Firebase sync error:', err);
          setSyncStatus('error');
        });
    }, 800);
  }, [userId]);

  // ── sbUpsert: persiste 1 item via fetch direto ───────────────────────────────
  const sbUpsert = useCallback((item) => {
    if (!SUPABASE_ENABLED || applyingSnapshot.current) return;
    const uid = userId ?? 'offline';
    setSyncStatus('syncing');
    sbFetch.upsert('lancamentos', toRow(item, uid)).then(({ error }) => {
      if (error) { console.error('[Kraken Sync] ✗ upsert:', error); setSyncStatus('error'); }
      else setSyncStatus('synced');
    });
  }, [userId]);

  // ── sbUpsertMany: persiste N itens via fetch direto ──────────────────────────
  const sbUpsertMany = useCallback((items) => {
    if (!SUPABASE_ENABLED || !items.length) return;
    const uid = userId ?? 'offline';
    setSyncStatus('syncing');
    sbFetch.upsert('lancamentos', items.map(i => toRow(i, uid))).then(({ error }) => {
      if (error) { console.error('[Kraken Sync] ✗ upsert-many:', error); setSyncStatus('error'); }
      else setSyncStatus('synced');
    });
  }, [userId]);

  // ── sbDeleteOne: deleta 1 item no Supabase via fetch direto ─────────────────
  const sbDeleteOne = useCallback((id) => {
    if (!SUPABASE_ENABLED) return Promise.resolve({ error: null });
    const uid = userId ?? 'offline';
    console.log(`[Kraken Sync] 🗑 DELETE Supabase id=${id} user_id=${uid}`);
    return sbFetch.delete('lancamentos', { id, user_id: uid }).then(({ error }) => {
      if (error) { console.error('[Kraken Sync] ✗ DELETE falhou:', error); setSyncStatus('error'); }
      else { console.log(`[Kraken Sync] ✓ DELETE OK id=${id}`); setSyncStatus('synced'); }
      return { error };
    });
  }, [userId]);

  // ════════════════════════════════════════════════════════════════════════════
  // Supabase initial load + Realtime listener
  // Runs when backend is 'supabase' — works without auth (uid='offline').
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (syncBackend !== 'supabase' || !SUPABASE_ENABLED) {
      if (syncBackend === 'supabase') setSyncStatus('idle');
      return;
    }

    const uid = userId ?? 'offline';
    setSyncStatus('syncing');

    const init = async () => {
      console.log(`[Kraken Sync] ══ INÍCIO ══ uid="${uid}"`);

      // ── Passo 1: buscar nuvem via fetch ──────────────────────────────────────
      console.log('[Kraken Sync] Passo 1: buscando lancamentos no Supabase...');
      const { data: rows, error: fetchError } = await sbFetch.select('lancamentos', { user_id: uid });

      if (fetchError) {
        console.error('[Kraken Sync] ✗ Passo 1 FALHOU:', fetchError);
        setSyncStatus('error');
        return;
      }

      const cloudItems = (rows ?? []).map(fromRow);
      console.log(`[Kraken Sync] Passo 1 OK — ${cloudItems.length} registro(s) no Supabase`);

      // ── Passo 2: ler estado React atual (sempre em sincronia com o localStorage) ─
      const localItems = lancamentosRef.current;
      console.log(`[Kraken Sync] Passo 2: estado local tem ${localItems.length} item(s)`);

      // ── Passo 3: calcular diferenças usando syncedIds ────────────────────────
      // syncedIds = IDs que já foram enviados ao Supabase em syncs anteriores.
      // Isso permite distinguir:
      //   • item em local mas não na nuvem + nunca sincronizado → NOVO LOCAL (subir)
      //   • item em local mas não na nuvem + já sincronizado    → DELETADO REMOTAMENTE (apagar local)
      const syncedIds  = loadSyncedIds();
      const cloudIds   = new Set(cloudItems.map(i => i.id));
      const localIds   = new Set(localItems.map(i => i.id));

      const toDownload      = cloudItems.filter(i => !localIds.has(i.id));
      const toUpload        = localItems.filter(i => i.id && !cloudIds.has(i.id) && !syncedIds.has(i.id));
      const toDeleteLocally = localItems.filter(i => i.id && !cloudIds.has(i.id) &&  syncedIds.has(i.id));

      console.log(`[Kraken Sync] Passo 3: ↓${toDownload.length} baixar, ↑${toUpload.length} subir, 🗑${toDeleteLocally.length} deletar local`);

      // ── Passo 4a: DELETE LOCAL — itens deletados em outro device ─────────────
      if (toDeleteLocally.length > 0) {
        console.log(`[Kraken Sync] Passo 4a: removendo ${toDeleteLocally.length} item(s) deletados em outro device...`);
        toDeleteLocally.forEach(i => console.log(`  🗑 id=${i.id} ticker=${i.ticker}`));
        const deleteIds = new Set(toDeleteLocally.map(i => i.id));
        const afterDelete = localItems.filter(i => !deleteIds.has(i.id));
        applyingSnapshot.current = true;
        setLancamentos(afterDelete);
        persist(afterDelete);
        applyingSnapshot.current = false;
        console.log(`[Kraken Sync] ✓ Passo 4a: ${toDeleteLocally.length} item(s) removidos do local`);
      }

      // ── Passo 4b: DOWNLOAD — itens da nuvem que faltam no local ──────────────
      if (toDownload.length > 0) {
        console.log(`[Kraken Sync] Passo 4b: baixando ${toDownload.length} item(s) do Supabase...`);
        toDownload.forEach(item => console.log(`  ↓ id=${item.id} ticker=${item.ticker} type=${item.type}`));
        // Base = estado atual (pode ter sido modificado pelo passo 4a)
        const currentLocal = lancamentosRef.current;
        const currentIds   = new Set(currentLocal.map(i => i.id));
        const merged = [...toDownload.filter(i => !currentIds.has(i.id)), ...currentLocal];
        applyingSnapshot.current = true;
        setLancamentos(merged);
        persist(merged);
        applyingSnapshot.current = false;
        console.log(`[Kraken Sync] ✓ Passo 4b: ${toDownload.length} item(s) adicionados`);
      }

      // ── Passo 4d: UPDATE LOCAL — registros que existem nos dois lados mas
      //    mudaram na nuvem (ex: correção feita direto no Supabase). Nuvem vence.
      //    Sem isso, edições na nuvem nunca chegavam ao cache (o sync só baixava
      //    IDs novos), exigindo limpar o localStorage manualmente.
      {
        const sig = (l) =>
          `${l.ticker}|${l.type}|${l.date}|${l.price}|${l.quantity}|${l.amount}|${l.total}|${l.category}`;
        const cloudById = new Map(cloudItems.map(i => [i.id, i]));
        const baseLocal = lancamentosRef.current;
        const toUpdate  = baseLocal.filter(l => cloudById.has(l.id) && sig(cloudById.get(l.id)) !== sig(l));
        if (toUpdate.length > 0) {
          console.log(`[Kraken Sync] Passo 4d: atualizando ${toUpdate.length} registro(s) alterados na nuvem...`);
          toUpdate.forEach(l => console.log(`  ✎ id=${l.id} ticker=${l.ticker}`));
          const updIds = new Set(toUpdate.map(l => l.id));
          const reconciled = baseLocal.map(l => updIds.has(l.id) ? cloudById.get(l.id) : l);
          applyingSnapshot.current = true;
          setLancamentos(reconciled);
          persist(reconciled);
          applyingSnapshot.current = false;
          console.log(`[Kraken Sync] ✓ Passo 4d: ${toUpdate.length} registro(s) atualizados da nuvem`);
        }
      }

      // ── Passo 4c: UPLOAD — itens locais novos que faltam na nuvem ────────────
      if (toUpload.length > 0) {
        console.log(`[Kraken Sync] Passo 4c: enviando ${toUpload.length} item(s) ao Supabase...`);
        const CHUNK = 50;
        let totalOk = 0;
        for (let i = 0; i < toUpload.length; i += CHUNK) {
          const chunk = toUpload.slice(i, i + CHUNK);
          const { error: upErr } = await sbFetch.upsert('lancamentos', chunk.map(x => toRow(x, uid)));
          if (upErr) {
            console.error(`[Kraken Sync] ✗ Passo 4c chunk ${i}: FALHOU`, upErr);
            setSyncStatus('error');
            return;
          }
          totalOk += chunk.length;
          console.log(`[Kraken Sync] ✓ ${totalOk}/${toUpload.length} enviados`);
        }
        console.log(`[Kraken Sync] ✓ Passo 4c: ${totalOk} item(s) enviados`);
      }

      // ── Passo 5: Atualizar syncedIds com todos os IDs agora na nuvem ─────────
      // Inclui cloud original + itens recém-enviados → próximo sync sabe o que é "novo"
      const newSyncedIds = new Set([...syncedIds, ...cloudIds, ...toUpload.map(i => i.id)]);
      saveSyncedIds(newSyncedIds);

      if (toDownload.length === 0 && toUpload.length === 0 && toDeleteLocally.length === 0) {
        console.log('[Kraken Sync] Tudo em sincronia — nada a fazer.');
      } else {
        console.log(`[Kraken Sync] ✓ SUCESSO — ↓${toDownload.length} baixados, ↑${toUpload.length} enviados, 🗑${toDeleteLocally.length} removidos localmente`);
      }
      setSyncStatus('synced');
      console.log('[Kraken Sync] ══ FIM ══');
    };

    init();
    // Nota: Realtime desabilitado (requer supabase JS client com JWT válido).
    // Sync entre dispositivos acontece ao recarregar a página.
  }, [userId, syncBackend]);

  // ════════════════════════════════════════════════════════════════════════════
  // Firebase real-time listener (unchanged legacy path)
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (syncBackend !== 'firebase' || !FIREBASE_ENABLED || !db || !userId) {
      if (syncBackend === 'firebase') setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');
    const ref = doc(db, 'users', userId, 'data', 'state');

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const cloudItems = snap.data().lancamentos ?? [];
          applyingSnapshot.current = true;
          setLancamentos(cloudItems);
          persist(cloudItems);
          applyingSnapshot.current = false;
          setSyncStatus('synced');
        } else {
          const localItems = JSON.parse(lsGet(LS_KEY) ?? '[]') ?? [];
          setDoc(ref, { lancamentos: localItems, lastUpdated: serverTimestamp() })
            .then(() => setSyncStatus('synced'))
            .catch(err => {
              console.error('[Kraken] Firestore listener error:', err);
              setSyncStatus('error');
            });
        }
      },
      (err) => {
        console.error('[Kraken] Firestore listener error:', err);
        setSyncStatus('error');
      }
    );

    return () => {
      unsub();
      clearTimeout(fbSyncTimer.current);
    };
  }, [userId, syncBackend]);

  // ════════════════════════════════════════════════════════════════════════════
  // Mutations — every write goes to localStorage immediately,
  //   then fires the appropriate cloud op.
  // ════════════════════════════════════════════════════════════════════════════

  const add = useCallback((entry) => {
    const novo = {
      ...entry,
      id:        entry.id        ?? crypto.randomUUID(),
      createdAt: entry.createdAt ?? new Date().toISOString(),
    };

    setLancamentos(prev => {
      const next = [novo, ...prev];
      persist(next);
      if (syncBackend === 'firebase') syncFirebase(next);
      return next;
    });

    if (syncBackend === 'supabase') sbUpsert(novo);

    return novo;
  }, [syncBackend, syncFirebase, sbUpsert]);

  const remove = useCallback((id) => {
    // Guarda o item antes de remover (para reverter em caso de falha)
    const prevItem = lancamentosRef.current.find(l => l.id === id);

    // Se for um provento, suprime sua chave para o auto-log NÃO recriá-lo
    // no próximo carregamento (causa raiz do "registro volta após reload").
    if (prevItem && prevItem.category === 'provento') {
      addSuppressedKey(proventoKey(prevItem));
    }

    // Remoção otimista do estado local
    setLancamentos(prev => {
      const next = prev.filter(l => l.id !== id);
      persist(next);
      if (syncBackend === 'firebase') syncFirebase(next);
      return next;
    });

    // Supabase DELETE — em caso de falha, reverte e sinaliza erro
    if (syncBackend === 'supabase') {
      console.log('[Kraken] deletando do Supabase:', id);
      sbDeleteOne(id).then(({ error }) => {
        if (error && prevItem) {
          console.error('[Kraken] DELETE falhou — restaurando registro na tela');
          setLancamentos(prev => {
            if (prev.some(l => l.id === id)) return prev; // já restaurado
            const restored = [prevItem, ...prev];
            persist(restored);
            return restored;
          });
          setSyncStatus('error');
          try {
            window.dispatchEvent(new CustomEvent('kraken-toast', {
              detail: { type: 'error', message: 'Não foi possível remover o lançamento. Tente novamente.' },
            }));
          } catch { /* noop */ }
        }
      });
    }
  }, [syncBackend, syncFirebase, sbDeleteOne]);

  const update = useCallback((id, changes) => {
    // Read current item from ref (avoids stale closure)
    const current = lancamentosRef.current.find(l => l.id === id);
    const updated  = current
      ? { ...current, ...changes, updatedAt: new Date().toISOString() }
      : null;

    setLancamentos(prev => {
      const next = prev.map(l =>
        l.id === id ? { ...l, ...changes, updatedAt: new Date().toISOString() } : l
      );
      persist(next);
      if (syncBackend === 'firebase') syncFirebase(next);
      return next;
    });

    if (syncBackend === 'supabase' && updated) sbUpsert(updated);
  }, [syncBackend, syncFirebase, sbUpsert]);

  const addBulk = useCallback((entries) => {
    if (!entries?.length) return;
    const novos = entries.map(entry => ({
      ...entry,
      id:        entry.id        ?? crypto.randomUUID(),
      createdAt: entry.createdAt ?? new Date().toISOString(),
    }));

    setLancamentos(prev => {
      const next = [...novos, ...prev];
      persist(next);
      if (syncBackend === 'firebase') syncFirebase(next);
      return next;
    });

    if (syncBackend === 'supabase') sbUpsertMany(novos);
  }, [syncBackend, syncFirebase, sbUpsertMany]);

  const mergeImport = useCallback((entries) => {
    let added = 0;
    let skipped = 0;

    // Build semantic dedup key: data+tipo+ativo+total (handles reimports safely)
    const makeKey = (l) => {
      const total = (typeof l.total === 'number' ? l.total : parseFloat(l.total) || 0).toFixed(2);
      return `${l.date}|${l.type}|${l.ticker}|${total}`;
    };

    // Existing items keyed by semantic signature
    const existingKeys = new Set(lancamentosRef.current.map(makeKey));
    const toAdd = [];

    for (const e of entries) {
      const key = makeKey(e);
      if (existingKeys.has(key)) {
        console.log(`[mergeImport] Dedup hit: ${key}`);
        skipped++;
      } else {
        toAdd.push({
          ...e,
          id:        e.id        ?? crypto.randomUUID(),
          createdAt: e.createdAt ?? new Date().toISOString(),
        });
        existingKeys.add(key); // Add to seen set so duplicates within this batch are caught
        added++;
      }
    }

    if (toAdd.length > 0) {
      console.log(`[mergeImport] Adicionando ${added}, ignorando ${skipped} duplicatas`);
      setLancamentos(prev => {
        const next = [...toAdd, ...prev];
        persist(next);
        if (syncBackend === 'firebase') syncFirebase(next);
        return next;
      });

      if (syncBackend === 'supabase') sbUpsertMany(toAdd);
    }

    return { added, skipped };
  }, [syncBackend, syncFirebase, sbUpsertMany]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const adjustedPortfolio = useMemo(() => {
    // Estado por ticker com PREÇO MÉDIO e redução PROPORCIONAL de custo na venda
    // (igual a calcPMData). Sem isso, vender parte de uma posição não reduzia o
    // custo → Renda Fixa exibia a soma de todas as compras (ex: CDB com 2 compras
    // + 1 venda mostrava o valor das 2 compras em vez do remanescente).
    const state      = {};   // ticker → { qty, cost }
    const tickerMeta = {};

    // Sanitiza data p/ ordenação: ano inválido (typo tipo 0004/2925) ordena por
    // ÚLTIMO em vez de bagunçar a cronologia (evita venda anular-se por sortear
    // antes das compras). Torna o cálculo resiliente a dados corrompidos em cache.
    const sortDate = (d) => {
      const y = parseInt((d ?? '').slice(0, 4), 10);
      return (isNaN(y) || y < 2000 || y > 2100) ? '9999-12-31' : d;
    };

    lancamentos
      .filter(l => l.category === 'operacao')
      .slice()
      .sort((a, b) => {
        const dd = sortDate(a.date).localeCompare(sortDate(b.date));
        if (dd !== 0) return dd;
        const at = a.type?.toLowerCase?.();
        const bt = b.type?.toLowerCase?.();
        if (at !== bt) return at === 'compra' ? -1 : 1; // compra antes da venda no mesmo dia
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      })
      .forEach(op => {
        const qty = parseFloat(op.quantity) || 0;
        const typeNorm = op.type?.toLowerCase?.();
        if (!state[op.ticker]) state[op.ticker] = { qty: 0, cost: 0 };
        const s = state[op.ticker];

        if (typeNorm === 'compra') {
          const total = parseFloat(op.total) || ((parseFloat(op.price) || 0) * qty);
          s.qty  += qty;
          s.cost += total;
        } else if (typeNorm === 'venda') {
          if (s.qty > 0) {
            const fraction = Math.min(qty / s.qty, 1);
            s.cost -= s.cost * fraction;   // reduz custo proporcionalmente
          }
          s.qty -= qty;
          if (s.qty <= 0) { s.qty = 0; s.cost = 0; }  // posição zerada → reset
        }

        if (!tickerMeta[op.ticker] && op.assetType) {
          tickerMeta[op.ticker] = {
            name: op.assetName || op.ticker,
            type: normalizeType(op.assetType),
          };
        }
      });

    // deltas = quantidade líquida atual por ticker
    const deltas = {};
    for (const [ticker, s] of Object.entries(state)) deltas[ticker] = s.qty;

    const staticTickers = new Set(PORTFOLIO.map(p => p.ticker));
    const result = PORTFOLIO.map(item => ({
      ...item,
      shares: Math.max(0, item.shares + (deltas[item.ticker] ?? 0)),
    }));

    for (const [ticker, delta] of Object.entries(deltas)) {
      if (!staticTickers.has(ticker) && delta > 0 && tickerMeta[ticker]) {
        // Preço médio = custo remanescente / quantidade. Para Renda Fixa
        // (sem cotação de mercado) é o valor exibido na carteira.
        const remainingCost = state[ticker]?.cost ?? 0;
        const avgPrice = remainingCost > 0 ? remainingCost / delta : 0;
        result.push({
          ticker,
          shares: delta,
          type:   tickerMeta[ticker].type,
          name:   tickerMeta[ticker].name,
          price:  avgPrice,
        });
      }
    }

    return result.filter(item => item.shares > 0);
  }, [lancamentos]);

  const { totalMes, totalAno, totalGeral, totalPorAtivo, proventosOrdenados } = useMemo(() => {
    const provs = lancamentos.filter(l => l.category === 'provento');
    const now   = new Date();
    const mes   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ano   = String(now.getFullYear());

    const totalMes   = provs.filter(p => p.date?.startsWith(mes)).reduce((s, p) => s + +p.amount, 0);
    const totalAno   = provs.filter(p => p.date?.startsWith(ano)).reduce((s, p) => s + +p.amount, 0);
    const totalGeral = provs.reduce((s, p) => s + +p.amount, 0);
    const totalPorAtivo = provs.reduce((acc, p) => {
      acc[p.ticker] = (acc[p.ticker] ?? 0) + +p.amount;
      return acc;
    }, {});
    const proventosOrdenados = [...provs].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '')
    );

    return { totalMes, totalAno, totalGeral, totalPorAtivo, proventosOrdenados };
  }, [lancamentos]);

  return {
    lancamentos,
    syncStatus,
    add,
    addBulk,
    mergeImport,
    remove,
    update,
    adjustedPortfolio,
    proventosStats: { totalMes, totalAno, totalGeral, totalPorAtivo, proventosOrdenados },
  };
}
