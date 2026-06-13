/**
 * krakenCompliance — avalia cada ativo da carteira contra os critérios
 * Kraken v2.0 COMPUTÁVEIS com os dados que o app possui localmente:
 *
 *   • DY 12m por ativo  → proventos lançados ÷ valor atual (anualizado)
 *   • Concentração      → peso do ativo vs teto de maxPerAsset (10%)
 *   • Renda Fixa        → taxa % CDI do lançamento vs piso (90% CDI) + prazo 2-4 anos
 *   • Cripto            → somente ativos permitidos (BTC)
 *   • Contagem          → nº de ativos por categoria vs limites (5-7 FIIs etc.)
 *
 * P/VP, P/L, ROE, vacância e liquidez NÃO têm fonte de dados local — são
 * avaliados apenas pela Análise IA (web_search). O status reflete isso com
 * honestidade: ✅ significa "ok nos critérios avaliáveis", nunca "ok em tudo".
 *
 * Critérios vêm de src/config/krakenCriteria.js (fonte única).
 */
import { KRAKEN_CRITERIA, ASSET_COUNT_LIMITS } from '../config/krakenCriteria.js';

const MS_PER_DAY = 86_400_000;

// status: 'fail' (❌ viola critério) | 'warn' (⚠️ atenção) | 'unknown' (— sem dados) | 'ok' (✅)
const SEVERITY = { fail: 3, warn: 2, unknown: 1, ok: 0 };

function fmtPct(v, digits = 1) {
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

/**
 * Proventos dos últimos 12 meses e data da primeira compra, por ticker.
 */
function buildLancamentoIndex(lancamentos) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const prov12m  = {};
  const firstBuy = {};
  const rfMeta   = {};

  for (const l of lancamentos ?? []) {
    if (l.category === 'provento' && l.ticker) {
      if ((l.date ?? '') >= cutoffStr)
        prov12m[l.ticker] = (prov12m[l.ticker] ?? 0) + (parseFloat(l.amount) || 0);
    }
    if (l.category === 'operacao' && l.type?.toLowerCase?.() === 'compra' && l.ticker && l.date) {
      if (!firstBuy[l.ticker] || l.date < firstBuy[l.ticker]) firstBuy[l.ticker] = l.date;
    }
    // Metadados de Renda Fixa (indexador/taxa/vencimento) ficam no lançamento de compra
    if (l.category === 'operacao' && l.assetType === 'Renda Fixa' && l.ticker) {
      rfMeta[l.ticker] = {
        indexador:    l.indexador ?? rfMeta[l.ticker]?.indexador ?? null,
        taxa:         l.taxa ?? rfMeta[l.ticker]?.taxa ?? null,
        maturityDate: l.maturityDate ?? rfMeta[l.ticker]?.maturityDate ?? null,
        date:         l.date ?? rfMeta[l.ticker]?.date ?? null,
      };
    }
  }
  return { prov12m, firstBuy, rfMeta };
}

/**
 * DY 12m anualizado de um ativo a partir dos proventos lançados.
 * Retorna { dy, monthsHeld } ou null quando não há base para avaliar.
 */
function calcAssetDY(asset, prov12m, firstBuy) {
  const received = prov12m[asset.ticker] ?? 0;
  const first    = firstBuy[asset.ticker];
  if (!first || !(asset.totalValue > 0)) return null;

  const days       = Math.max(0, (Date.now() - new Date(`${first}T12:00:00`)) / MS_PER_DAY);
  const monthsHeld = Math.min(12, days / 30.44);
  if (received <= 0) return { dy: null, monthsHeld };          // sem proventos registrados
  if (monthsHeld < 3) return { dy: null, monthsHeld };          // janela curta demais p/ anualizar

  const dy = (received / asset.totalValue) * (12 / monthsHeld) * 100;
  return { dy, monthsHeld };
}

/**
 * Avalia UM ativo. Retorna { status, reasons: [string], notes: [string] }.
 * reasons = violações/atenções exibíveis; notes = contexto (tooltip).
 */
export function evaluateAsset(asset, { totalValue, prov12m, firstBuy, rfMeta }) {
  const C = KRAKEN_CRITERIA;
  const reasons = [];
  const notes   = [];
  let   status  = 'ok';
  const raise   = (s) => { if (SEVERITY[s] > SEVERITY[status]) status = s; };

  // ── Concentração (todas as categorias) ─────────────────────────────────
  const weight = totalValue > 0 ? (asset.totalValue / totalValue) * 100 : 0;
  if (weight > C.allocation.maxPerAsset) {
    raise('fail');
    reasons.push(`Concentração ${fmtPct(weight)} > ${C.allocation.maxPerAsset}%`);
  }

  // ── DY 12m (FIIs: critério | Ações: preferência) ───────────────────────
  if (asset.type === 'FIIs' || asset.type === 'Ações') {
    const r = calcAssetDY(asset, prov12m, firstBuy);
    if (!r) {
      raise('unknown');
      notes.push('Sem compras registradas — DY 12m não avaliado');
    } else if (r.dy == null) {
      raise('unknown');
      notes.push(r.monthsHeld < 3
        ? 'Posição com menos de 3 meses — DY 12m ainda não avaliável'
        : 'Nenhum provento registrado nos últimos 12m — DY não avaliado');
    } else if (asset.type === 'FIIs' && r.dy < C.fiis.dy.min) {
      raise('fail');
      reasons.push(`DY ${fmtPct(r.dy)} < ${fmtPct(C.fiis.dy.min)} (proventos 12m)`);
    } else if (asset.type === 'Ações' && r.dy < C.acoes.dy.min) {
      raise('warn');
      reasons.push(`DY ${fmtPct(r.dy)} < ${C.acoes.dy.min}% (preferência, não obrigatório)`);
    } else {
      notes.push(`DY 12m ${fmtPct(r.dy)} ✓`);
    }
  }

  // ── Renda Fixa: % CDI e prazo ──────────────────────────────────────────
  if (asset.type === 'Renda Fixa') {
    const meta = rfMeta[asset.ticker];
    const isCDI = meta?.indexador && /cdi/i.test(meta.indexador);
    if (isCDI && meta.taxa != null) {
      if (meta.taxa < C.rendaFixa.minCDI.min) {
        raise('fail');
        reasons.push(`${String(meta.taxa).replace('.', ',')}% CDI < ${C.rendaFixa.minCDI.min}% CDI`);
      } else {
        notes.push(`${String(meta.taxa).replace('.', ',')}% CDI ✓`);
      }
    } else if (!meta?.indexador || meta?.taxa == null) {
      raise('unknown');
      notes.push('Indexador/taxa não informados — critério % CDI não avaliado');
    } else {
      notes.push(`Indexador ${meta.indexador} — critério % CDI não se aplica`);
    }
    if (meta?.maturityDate && meta?.date) {
      const years = (new Date(meta.maturityDate) - new Date(meta.date)) / (MS_PER_DAY * 365.25);
      if (years < C.rendaFixa.term.min || years > C.rendaFixa.term.max) {
        raise('warn');
        reasons.push(`Prazo ${years.toFixed(1).replace('.', ',')} anos fora de ${C.rendaFixa.term.min}-${C.rendaFixa.term.max} anos`);
      }
    }
  }

  // ── Cripto: somente ativos permitidos ──────────────────────────────────
  if (asset.type === 'Cripto' && !C.cripto.allowedAssets.includes(asset.ticker)) {
    raise('fail');
    reasons.push(`Apenas ${C.cripto.allowedAssets.join(', ')} permitido no modelo Kraken`);
  }

  // Contexto: o que NÃO é avaliável localmente
  if (asset.type === 'FIIs')  notes.push('P/VP, vacância e liquidez: avaliados na Análise IA');
  if (asset.type === 'Ações') notes.push('P/L, P/VP, ROE e dívida: avaliados na Análise IA');
  if (asset.type === 'ETFs')  notes.push('Taxa de adm. e liquidez: avaliados na Análise IA');

  return { status, reasons, notes, weight };
}

/**
 * Avalia a carteira inteira.
 * Retorna { byTicker, failCount, warnCount, countIssues }.
 */
export function evaluatePortfolio(assets, lancamentos, totalValue) {
  const idx = buildLancamentoIndex(lancamentos);
  const byTicker = {};
  let failCount = 0;
  let warnCount = 0;

  for (const asset of assets ?? []) {
    const r = evaluateAsset(asset, { totalValue, ...idx });
    byTicker[asset.ticker] = r;
    if (r.status === 'fail') failCount++;
    else if (r.status === 'warn') warnCount++;
  }

  // Quantidades-alvo por categoria (só avalia categorias com ativos;
  // categoria zerada já é coberta pelo insight "não alocado").
  // exact = alvo fixo (FIIs 7, Ações 5, ETFs 2, Cripto 1); senão faixa (RF 2-3).
  const countIssues = [];
  const counts = {};
  for (const a of assets ?? []) counts[a.type] = (counts[a.type] ?? 0) + 1;
  for (const [cat, { min, max, exact }] of Object.entries(ASSET_COUNT_LIMITS)) {
    const n = counts[cat] ?? 0;
    if (n === 0) continue;
    if (n > max)      countIssues.push(exact ? `${cat}: ${n} ativos (alvo exato: ${max})` : `${cat}: ${n} ativos (máx. ${max})`);
    else if (n < min) countIssues.push(exact ? `${cat}: ${n} de ${min} ativos (faltam ${min - n})` : `${cat}: ${n} de no mín. ${min} ativos`);
  }

  return { byTicker, failCount, warnCount, countIssues };
}

/**
 * buildAlerts — alertas automáticos de critério, focados nos limites de
 * ELIMINAÇÃO computáveis com os dados que o app já tem (sem serviços pagos,
 * sem fetch novo). Diferente de evaluatePortfolio (que usa o piso de COMPRA
 * dy.min), aqui usamos os gatilhos de eliminação:
 *
 *   • Concentração > maxPerAsset (10%)            → 🔴 crítico
 *   • FII: DY 12m anualizado < eliminateBelow (6%) → 🔴 crítico (amortização)
 *   • Renda Fixa: taxa < piso de % CDI (90%)       → 🔴 crítico
 *   • Cripto fora dos permitidos (≠ BTC)           → 🔴 crítico
 *   • Quantidade por classe fora do alvo (7/5/2)   → 🟡 atenção
 *
 * Sem falsos positivos: o DY reusa calcAssetDY, que só avalia quando há
 * proventos registrados e ≥ 3 meses de posição (anualizando o período).
 *
 * P/VP, vacância, dívida líq./EBITDA, recuperação judicial e rating NÃO têm
 * fonte local — continuam a cargo da Análise IA (web_search).
 *
 * @returns {{ alerts: object[], criticalCount: number, warningCount: number }}
 */
export function buildAlerts(assets, lancamentos, totalValue) {
  const C = KRAKEN_CRITERIA;
  const idx = buildLancamentoIndex(lancamentos);
  const alerts = [];

  for (const asset of assets ?? []) {
    const t = asset.ticker;

    // Concentração (todas as classes)
    const weight = totalValue > 0 ? (asset.totalValue / totalValue) * 100 : 0;
    if (weight > C.allocation.maxPerAsset) {
      alerts.push({
        key: `conc:${t}`, ticker: t, classe: asset.type, severity: 'critical',
        criterio: 'Concentração acima do teto',
        atual: fmtPct(weight), limite: `${C.allocation.maxPerAsset}%`,
        detalhe: `${fmtPct(weight)} da carteira — teto de ${C.allocation.maxPerAsset}% por ativo`,
      });
    }

    // FIIs: DY 12m abaixo do piso de eliminação (possível amortização)
    if (asset.type === 'FIIs') {
      const r = calcAssetDY(asset, idx.prov12m, idx.firstBuy);
      if (r && r.dy != null && r.dy < C.fiis.dy.eliminateBelow) {
        alerts.push({
          key: `dy:${t}`, ticker: t, classe: 'FIIs', severity: 'critical',
          criterio: 'DY abaixo do piso (possível amortização)',
          atual: fmtPct(r.dy), limite: `${C.fiis.dy.eliminateBelow}%`,
          detalhe: `DY 12m ${fmtPct(r.dy)} < ${C.fiis.dy.eliminateBelow}% — pode ser devolução de capital, não renda`,
        });
      }
    }

    // Renda Fixa: taxa abaixo do piso de % CDI
    if (asset.type === 'Renda Fixa') {
      const meta = idx.rfMeta[t];
      if (meta?.indexador && /cdi/i.test(meta.indexador) && meta.taxa != null && meta.taxa < C.rendaFixa.minCDI.min) {
        const taxaStr = `${String(meta.taxa).replace('.', ',')}% CDI`;
        alerts.push({
          key: `rf:${t}`, ticker: t, classe: 'Renda Fixa', severity: 'critical',
          criterio: 'Taxa abaixo do piso de CDI',
          atual: taxaStr, limite: `${C.rendaFixa.minCDI.min}% CDI`,
          detalhe: `${taxaStr} < piso de ${C.rendaFixa.minCDI.min}% CDI`,
        });
      }
    }

    // Cripto fora do modelo (≠ BTC)
    if (asset.type === 'Cripto' && !C.cripto.allowedAssets.includes(t)) {
      alerts.push({
        key: `cripto:${t}`, ticker: t, classe: 'Cripto', severity: 'critical',
        criterio: 'Cripto fora do modelo',
        atual: t, limite: C.cripto.allowedAssets.join(', '),
        detalhe: `Apenas ${C.cripto.allowedAssets.join(', ')} é permitido no modelo Kraken`,
      });
    }
  }

  // Quantidade de ativos por classe vs alvo (FIIs 7, Ações 5, ETFs 2…)
  const counts = {};
  for (const a of assets ?? []) counts[a.type] = (counts[a.type] ?? 0) + 1;
  for (const [cat, { min, max, exact }] of Object.entries(ASSET_COUNT_LIMITS)) {
    const n = counts[cat] ?? 0;
    if (n === 0) continue; // categoria zerada é coberta por outro insight
    if (n > max || n < min) {
      const alvo = exact ? `${max}` : `${min}-${max}`;
      alerts.push({
        key: `count:${cat}`, ticker: null, classe: cat, severity: 'warning',
        criterio: 'Quantidade de ativos fora do alvo',
        atual: `${n}`, limite: alvo,
        detalhe: n > max
          ? `${n} ativos na classe — alvo ${alvo}`
          : `${n} ativos na classe — alvo ${alvo} (faltam ${min - n})`,
      });
    }
  }

  // Críticos primeiro, depois atenção (ordem estável dentro de cada grupo)
  alerts.sort((a, b) => (b.severity === 'critical' ? 1 : 0) - (a.severity === 'critical' ? 1 : 0));
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  return { alerts, criticalCount, warningCount: alerts.length - criticalCount };
}

export const STATUS_META = {
  ok:      { icon: '✅', color: '#3fb950', label: 'Dentro dos critérios avaliáveis' },
  warn:    { icon: '⚠️', color: '#f59e0b', label: 'Ponto de atenção' },
  fail:    { icon: '❌', color: '#f85149', label: 'Fora dos critérios Kraken' },
  unknown: { icon: '—',  color: '#484f58', label: 'Dados insuficientes' },
};
