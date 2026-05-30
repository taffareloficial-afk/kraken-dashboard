import { KRAKEN_MODEL } from '../constants';

/**
 * calcPMData — Preço Médio com reset ao zerar posição.
 *
 * Processa lançamentos em ordem cronológica:
 *   Compra : qty += quantity; custo += total
 *   Venda  : custo -= custo * (qtd_vendida / qtd_atual); qty -= qtd_vendida
 *            se qty <= 0 após venda → ZERAR qty=0 e custo=0 (reset do PM)
 *
 * Retorna: { [ticker]: { pm, qtyAtual, totalInvestido, gcRealizado } }
 *   pm             = custo / qty  (null se posição zerada)
 *   qtyAtual       = quantidade líquida atual
 *   totalInvestido = pm × qtyAtual (custo da posição aberta)
 *   gcRealizado    = ganho de capital já realizado nas vendas
 */
export function calcPMData(lancamentos) {
  const ops = (lancamentos ?? [])
    .filter(l => l.category === 'operacao' && (l.type?.toLowerCase?.() === 'compra' || l.type?.toLowerCase?.() === 'venda'))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const state = {}; // ticker → { qty, cost, gcRealizado }

  for (const op of ops) {
    const ticker = op.ticker;
    if (!ticker) continue;
    const qty   = parseFloat(op.quantity) || 0;
    if (!qty) continue;
    const total = parseFloat(op.total) || (parseFloat(op.price) || 0) * qty;

    if (!state[ticker]) state[ticker] = { qty: 0, cost: 0, gcRealizado: 0 };
    const s = state[ticker];

    const typeNorm = op.type?.toLowerCase?.();
    if (typeNorm === 'compra') {
      s.qty  += qty;
      s.cost += total;
    } else if (typeNorm === 'venda') {
      if (s.qty > 0) {
        // Redução proporcional do custo médio
        const fraction      = Math.min(qty / s.qty, 1); // clamp para evitar custo negativo
        const costReduction = s.cost * fraction;
        s.gcRealizado += total - costReduction;
        s.cost        -= costReduction;
        s.qty         -= qty;
      }
      // Resetar se a posição foi zerada (ou ficou negativa por erro de dados)
      if (s.qty <= 0) {
        s.qty  = 0;
        s.cost = 0;
      }
    }
  }

  const result = {};
  for (const [ticker, s] of Object.entries(state)) {
    const qtyAtual = Math.max(0, s.qty);
    result[ticker] = {
      pm:             qtyAtual > 0 ? s.cost / qtyAtual : null,
      qtyAtual,
      totalInvestido: qtyAtual > 0 ? s.cost : 0,
      gcRealizado:    s.gcRealizado,
    };
  }
  return result;
}

/**
 * calcTWR — Time-Weighted Return via Modified Dietz approximation.
 *
 * Fórmula:
 *   TWR = (V_fim + Proventos − V_início − Aportes_líquidos)
 *         / (V_início + Σ(Aporte_i × w_i))
 *
 *   w_i = (D − d_i) / D
 *   D   = dias do primeiro lançamento até hoje
 *   d_i = dias do primeiro lançamento até o aporte i
 *   Compra → aporte positivo · Venda → aporte negativo
 *
 * V_início = 0 (carteira começa do zero no primeiro lançamento).
 *
 * Retorna o TWR em %, ou null se não houver dados suficientes para o cálculo.
 */
export function calcTWR(lancamentos, patrimonioAtual, proventos = 0) {
  const ops = (lancamentos ?? [])
    .filter(l => l.category === 'operacao' && (l.type?.toLowerCase?.() === 'compra' || l.type?.toLowerCase?.() === 'venda') && l.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (ops.length === 0 || !(patrimonioAtual > 0)) return null;

  const MS_PER_DAY = 86_400_000;
  const parseDate  = iso => new Date(`${iso}T12:00:00`);
  const startDate  = parseDate(ops[0].date);
  const endDate    = new Date();
  const D          = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY));

  let aportesLiquidos   = 0;   // Σ compras − Σ vendas
  let aportesPonderados = 0;   // Σ aporte_i × w_i

  for (const op of ops) {
    const qty = parseFloat(op.quantity) || 0;
    if (!qty) continue;
    const total = parseFloat(op.total) || (parseFloat(op.price) || 0) * qty;
    if (!total) continue;

    const signed = op.type?.toLowerCase?.() === 'compra' ? total : -total;
    aportesLiquidos += signed;

    const d_i = Math.max(0, Math.round((parseDate(op.date) - startDate) / MS_PER_DAY));
    const w_i = (D - d_i) / D;
    aportesPonderados += signed * w_i;
  }

  const numerador   = patrimonioAtual + proventos - aportesLiquidos;
  const denominador = aportesPonderados;

  if (!(denominador > 0)) return null;

  return (numerador / denominador) * 100;
}

/**
 * Computes a 0-100 portfolio health score based on deviation from the
 * Kraken model. 100 = perfectly balanced; 0 = maximally off.
 *
 * Formula: score = max(0, round(100 - totalAbsDeviation * 0.75))
 *
 * Since allocations must sum to 100%, totalAbsDev = 2 × Σ positive deviations.
 * A portfolio with no rebalancing needed scores 100; one heavily concentrated
 * in a single category scores near 0.
 */
export function calcHealthScore(currentAllocation) {
  if (!currentAllocation) return null;
  const vals = Object.values(currentAllocation);
  if (vals.every(v => v === 0)) return null;

  const totalAbsDev = Object.keys(KRAKEN_MODEL).reduce((sum, cat) => {
    return sum + Math.abs((currentAllocation[cat] ?? 0) - KRAKEN_MODEL[cat]);
  }, 0);

  return Math.max(0, Math.round(100 - totalAbsDev * 0.75));
}

export function getScoreStyle(score) {
  if (score === null || score === undefined) {
    return { color: '#484f58', barColor: '#21262d', label: '—' };
  }
  if (score >= 80) return { color: '#3fb950', barColor: '#3fb950', label: 'Carteira saudável' };
  if (score >= 60) return { color: '#3fb950', barColor: '#3fb950', label: 'Ajustes pontuais recomendados' };
  if (score >= 40) return { color: '#f59e0b', barColor: '#f59e0b', label: 'Rebalanceamento recomendado' };
  if (score >= 20) return { color: '#f59e0b', barColor: '#f59e0b', label: 'Carteira desbalanceada' };
  return { color: '#f85149', barColor: '#f85149', label: 'Atenção: grande desvio do modelo' };
}

/**
 * Generates dynamic insights based on real portfolio data.
 * Returns an array of insight objects sorted by priority (highest first).
 */
export function generateInsights({
  currentAllocation,
  assets,
  lancamentos,
  proventosRows,
  totalValue,
  dailyPnL,
}) {
  if (!totalValue || totalValue === 0) return [];
  const insights = [];

  const fmtBRL = v =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const fmtDate = iso => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // ── 1. Category over/under-allocation ──────────────────────────────────
  Object.entries(KRAKEN_MODEL).forEach(([cat, target]) => {
    const current = currentAllocation[cat] ?? 0;
    const diff = current - target;

    if (diff >= 8) {
      // Find 1-2 most underweight categories to redirect to
      const underCats = Object.entries(KRAKEN_MODEL)
        .filter(([c]) => (currentAllocation[c] ?? 0) < KRAKEN_MODEL[c] - 2)
        .sort((a, b) =>
          ((currentAllocation[a[0]] ?? 0) - KRAKEN_MODEL[a[0]]) -
          ((currentAllocation[b[0]] ?? 0) - KRAKEN_MODEL[b[0]])
        )
        .slice(0, 2)
        .map(([c]) => c);

      const redirectText = underCats.length > 0
        ? ` Direcione os próximos aportes para ${underCats.join(' e ')}.`
        : '';

      insights.push({
        type: 'warning',
        icon: 'balance',
        title: `${cat} acima da meta`,
        text: `${cat} representam ${current.toFixed(1)}% da carteira, ${diff.toFixed(1)}pp acima da meta de ${target}%.${redirectText}`,
        priority: diff * 2,
      });
    } else if (current < 0.5 && target >= 15) {
      // Category completely absent
      insights.push({
        type: 'tip',
        icon: 'missing',
        title: `${cat} não alocado`,
        text: `Você não possui ativos em ${cat}. A meta Kraken é ${target}% — considere incluir essa categoria nos próximos aportes.`,
        priority: target,
      });
    }
  });

  // ── 2. Individual asset return (requires buy lancamentos) ──────────────
  const pmData = calcPMData(lancamentos);

  (assets ?? []).forEach(asset => {
    const d = pmData[asset.ticker];
    if (!d || d.pm == null || d.qtyAtual <= 0 || asset.price <= 0) return;
    const avgCost   = d.pm;
    const returnPct = ((asset.price - avgCost) / avgCost) * 100;

    if (returnPct <= -5) {
      insights.push({
        type: 'warning',
        icon: 'down',
        title: `${asset.ticker} com retorno negativo`,
        text: `${asset.ticker} está com rentabilidade de ${returnPct.toFixed(1)}% desde a compra (PM médio: ${fmtBRL(avgCost)}). Avalie se mantém a posição.`,
        priority: Math.abs(returnPct) * 1.5,
      });
    } else if (returnPct >= 15) {
      insights.push({
        type: 'success',
        icon: 'up',
        title: `${asset.ticker} com bom retorno`,
        text: `${asset.ticker} acumula +${returnPct.toFixed(1)}% desde a compra (PM médio: ${fmtBRL(avgCost)}). Boa performance!`,
        priority: 8,
      });
    }
  });

  // ── 3. Next dividend payments ──────────────────────────────────────────
  const futureRows = (proventosRows ?? [])
    .filter(r => r.isFuture)
    .sort((a, b) => (a.dataEx ?? '').localeCompare(b.dataEx ?? ''));

  if (futureRows.length > 0) {
    const earliest  = futureRows[0];
    const days      = Math.ceil(
      (new Date(earliest.dataEx + 'T12:00:00') - new Date()) / 86_400_000
    );
    const sameDate  = futureRows.filter(r => r.dataEx === earliest.dataEx);
    const tickers   = [...new Set(sameDate.map(r => r.ticker))];
    const daysLabel = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
    const verb      = tickers.length === 1 ? 'paga' : 'pagam';

    insights.push({
      type: 'info',
      icon: 'calendar',
      title: 'Proventos próximos',
      text: `Próximo provento estimado ${daysLabel} — ${tickers.join(', ')} ${verb} em ${fmtDate(earliest.dataEx)}.`,
      priority: Math.max(0, 40 - days),
    });
  }

  // ── 4. Notable daily P&L (>= 1%) ──────────────────────────────────────
  const pnlBase = Math.max(totalValue - dailyPnL, 1);
  const pnlPct  = totalValue > 0 ? (dailyPnL / pnlBase) * 100 : 0;

  if (Math.abs(pnlPct) >= 1) {
    const sign = pnlPct >= 0;
    insights.push({
      type: sign ? 'success' : 'warning',
      icon: sign ? 'up' : 'down',
      title: sign ? 'Variação positiva hoje' : 'Queda expressiva hoje',
      text: `Sua carteira variou ${sign ? '+' : ''}${fmtBRL(dailyPnL)} (${sign ? '+' : ''}${pnlPct.toFixed(2)}%) neste pregão.`,
      priority: Math.abs(pnlPct) * 2,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

/**
 * Given an investment amount, returns how to split it across categories
 * to move the portfolio closer to the Kraken model.
 */
export function calcSplit(currentAllocation, categoryValues, totalValue, contribution) {
  const newTotal = totalValue + contribution;

  const suggestions = Object.entries(KRAKEN_MODEL)
    .map(([cat, target]) => {
      const targetValue   = newTotal * (target / 100);
      const currentValue  = categoryValues[cat] ?? 0;
      const gap           = targetValue - currentValue;
      return { cat, target, currentPct: currentAllocation[cat] ?? 0, gap };
    })
    .filter(s => s.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  if (suggestions.length === 0) return [];

  const totalGap = suggestions.reduce((s, x) => s + x.gap, 0);
  return suggestions.map(s => ({
    ...s,
    suggested:  Math.min(s.gap, (s.gap / totalGap) * contribution),
    splitPct:   (s.gap / totalGap) * 100,
    newValue:   (categoryValues[s.cat] ?? 0) + Math.min(s.gap, (s.gap / totalGap) * contribution),
    newPct:     ((categoryValues[s.cat] ?? 0) + Math.min(s.gap, (s.gap / totalGap) * contribution)) / newTotal * 100,
  }));
}
