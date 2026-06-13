/**
 * Supabase — micro-cliente baseado em fetch puro.
 *
 * NÃO usa createClient do @supabase/supabase-js porque a chave
 * sb_publishable_… não é aceita por ele, mas funciona na REST API.
 *
 * O auth (useSupabaseAuth) cria seu próprio createClient isolado.
 *
 * Tabelas:
 *   lancamentos  (id, data, tipo, descricao, valor, categoria, created_at, user_id)
 *   configuracoes (id, chave, valor, user_id, created_at)
 */

// ── Credenciais ───────────────────────────────────────────────────────────────
export const SB_URL = (import.meta.env.VITE_SUPABASE_URL  ?? '').trim()
  || 'https://zbpgtfbcsgdhfswlymcz.supabase.co';

export const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  || 'sb_publishable_ZxS6YAedgtVFfoC3-T9I4Q_i7nmX_yi';

export const SUPABASE_ENABLED = Boolean(SB_URL && SB_KEY);

// Exportado para compatibilidade com useSupabaseAuth (ele cria o próprio client)
export const supabase = null;

// ── Token de acesso do usuário logado ─────────────────────────────────────────
// Definido por useSupabaseAuth a cada login/refresh de sessão. Enquanto for
// null, as chamadas caem na publishable key (relevante só ANTES de ligar o RLS;
// com RLS + login obrigatório, toda requisição leva o JWT do usuário, e é o
// auth.uid() desse JWT que as policies usam).
let _accessToken = null;
export function setSupabaseAccessToken(token) {
  _accessToken = token || null;
}

console.log('[Supabase] fetch-client init —', SB_URL, '| enabled:', SUPABASE_ENABLED);

// ═════════════════════════════════════════════════════════════════════════════
// sbFetch — operações REST puras (SELECT / UPSERT / DELETE)
// ═════════════════════════════════════════════════════════════════════════════
const REST = `${SB_URL}/rest/v1`;
const H = () => ({               // função para evitar objeto mutável compartilhado
  // apikey identifica o projeto (role anon); o Bearer com o JWT do usuário
  // promove a requisição para o role authenticated e define o auth.uid().
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${_accessToken || SB_KEY}`,
  'Content-Type':  'application/json',
});

function tryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * SELECT * FROM <table> WHERE col=val  ORDER BY created_at DESC
 */
async function sbSelect(table, filters = {}) {
  try {
    const params = new URLSearchParams({ select: '*' });
    for (const [col, val] of Object.entries(filters)) {
      params.set(col, `eq.${val}`);
    }
    params.set('order', 'created_at.desc');

    const url = `${REST}/${table}?${params.toString()}`;
    console.log('[sbFetch] SELECT', url);

    const res  = await fetch(url, { headers: H() });
    const text = await res.text();

    if (!res.ok) {
      const err = tryJson(text) ?? { message: text };
      console.error('[sbFetch] SELECT falhou', res.status, err);
      return { data: null, error: err };
    }
    const data = tryJson(text) ?? [];
    console.log('[sbFetch] SELECT OK —', data.length, 'rows');
    return { data, error: null };
  } catch (e) {
    console.error('[sbFetch] SELECT exception:', e.message);
    return { data: null, error: { message: e.message } };
  }
}

/**
 * UPSERT (INSERT + merge-duplicates on conflict)
 */
async function sbUpsert(table, rows) {
  try {
    const body = Array.isArray(rows) ? rows : [rows];
    console.log('[sbFetch] UPSERT', table, body.length, 'row(s)');

    const res = await fetch(`${REST}/${table}`, {
      method:  'POST',
      headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      const err  = tryJson(text) ?? { message: text };
      console.error('[sbFetch] UPSERT falhou', res.status, err);
      return { error: err };
    }
    console.log('[sbFetch] UPSERT OK —', body.length, 'row(s)');
    return { error: null };
  } catch (e) {
    console.error('[sbFetch] UPSERT exception:', e.message);
    return { error: { message: e.message } };
  }
}

/**
 * DELETE FROM <table> WHERE col=val [AND col2=val2]
 */
async function sbDeleteRow(table, filters = {}) {
  try {
    const params = new URLSearchParams();
    for (const [col, val] of Object.entries(filters)) {
      params.set(col, `eq.${val}`);
    }
    const url = `${REST}/${table}?${params.toString()}`;
    console.log('[sbFetch] DELETE', url);

    const res = await fetch(url, { method: 'DELETE', headers: H(), keepalive: true });

    if (!res.ok) {
      const text = await res.text();
      const err  = tryJson(text) ?? { message: text };
      console.error('[sbFetch] DELETE falhou', res.status, err);
      return { error: err };
    }
    console.log('[sbFetch] DELETE OK');
    return { error: null };
  } catch (e) {
    console.error('[sbFetch] DELETE exception:', e.message);
    return { error: { message: e.message } };
  }
}

export const sbFetch = {
  select: sbSelect,
  upsert: sbUpsert,
  delete: sbDeleteRow,
};
