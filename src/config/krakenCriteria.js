/**
 * Modelo Kraken v2.0 — Critérios centralizados (fonte única da verdade)
 * Versão: 2.0 | Atualizado: junho 2026
 *
 * Consumido por:
 *   - api/analyze.js        → interpola os valores no SYSTEM_PROMPT da análise IA
 *   - src/constants.js      → KRAKEN_MODEL (alocação alvo usada nos gráficos/insights)
 *
 * Mudou um critério? Altere AQUI e ele reflete no prompt da IA e no dashboard.
 */

export const KRAKEN_CRITERIA = {
  // ALOCAÇÃO ALVO (%) + quantidade de ativos por categoria
  // `count` = quantidade EXATA (meta fixa para a qual a carteira deve convergir)
  // `min`/`max` = faixa flexível (apenas Renda Fixa)
  allocation: {
    fiis:      { target: 40, count: 7 },          // exatamente 7 FIIs
    acoes:     { target: 25, count: 5 },          // exatamente 5 ações
    rendaFixa: { target: 20, min: 2, max: 3 },    // flexível: 2-3 ativos
    etfs:      { target: 10, count: 2 },          // exatamente 2 ETFs
    cripto:    { target: 5,  count: 1 },          // 1 ativo (BTC apenas)
    maxPerAsset: 10, // % máximo do patrimônio em um único ativo
  },

  // CRITÉRIOS DE ENTRADA - FIIs
  // max/min = mínimo para comprar · ideal = condição perfeita · eliminate = não comprar nunca
  fiis: {
    pVP:       { max: 1.05, ideal: 0.95, eliminate: 1.30 },
    // DY mínimo é DINÂMICO: Selic atual − selicSpread. `min` é o valor de
    // referência com Selic 14,5% (14,5 − 4 = 10,5) — usado como exemplo no prompt.
    dy:        { min: 10.5, selicSpread: 4, eliminateBelow: 6 }, // % a.a. (< 6% = sinal de amortização)
    vacancy:   { max: 10, ideal: 5, eliminate: 15 },             // %
    liquidity: { min: 1_000_000 },                               // R$/dia
    minTrackYears: 2, // histórico mínimo do fundo / de DY estável-crescente
    // Segmentos na ordem de preferência (1º = melhor)
    segments: ['Logística', 'Lajes Corporativas', 'Shopping', 'Híbrido', 'CRI/CRA'],
  },

  // CRITÉRIOS DE ENTRADA - AÇÕES
  acoes: {
    pL:         { max: 12, eliminate: 25 },                  // eliminação: P/L negativo ou > 25
    pVP:        { max: 3, idealCyclical: 2 },                // < 2,0 para setores cíclicos
    roe:        { min: 12, consistencyYears: 3, eliminateBelow: 10 }, // % (< 10% por 2 anos = eliminar)
    dy:         { min: 3, required: false },                 // Critério Ações DY: 3% (pref., não obrigatório)
    debtEbitda: { max: 3, idealNonFinancial: 2, eliminate: 4 },
    netMargin:  { min: 10 },                                 // %
    // Setores na ordem de preferência (1º = melhor)
    sectors: ['Energia Elétrica', 'Bancos Grandes', 'Telecom', 'Saneamento', 'Agronegócio exportador'],
  },

  // CRITÉRIOS DE ENTRADA - RENDA FIXA
  rendaFixa: {
    minCDI:      { min: 90 },        // % do CDI (piso absoluto)
    requiresFGC: true,
    term:        { min: 2, max: 4 }, // anos
    // Hierarquia de prioridade (1º = melhor)
    hierarchy: [
      'LCI/LCA ≥ 90% CDI (isenta de IR)',
      'CDB ≥ 90% CDI banco Tier 1 ou ≥ 100% CDI banco médio com FGC',
      'Tesouro IPCA+ ≥ IPCA + 5,5% a.a. (> 5 anos)',
      'Tesouro Selic (reserva de emergência)',
    ],
  },

  // CRITÉRIOS DE ENTRADA - ETFs
  etfs: {
    fee:       { max: 0.5, ideal: 0.1 }, // % a.a. (BOVA11 = 0,10%)
    liquidity: { min: 5_000_000 },       // R$/dia
    preferred: ['BOVA11 (Ibovespa)', 'IVVB11 (S&P 500, hedge de dólar)'],
  },

  // CRIPTO
  cripto: {
    allowedAssets: ['BTC'], // Apenas Bitcoin
    sellAbovePct: 7,        // só vender se a posição superar 7% do patrimônio
  },

  // SAÚDE FINANCEIRA & RISCO DE INSOLVÊNCIA (cenário de Selic alta)
  // Selic 14,5% encarece a dívida das empresas; alavancagem vira risco de
  // solvência. Estes critérios são de ELIMINAÇÃO (descartam o ativo
  // independente de preço) salvo onde indicado como "sinalizar".
  solvency: {
    // ── Ações ──
    // Dívida líquida/EBITDA acima disso = eliminação (antes era só atenção).
    // Espelha acoes.debtEbitda.eliminate; mantidos iguais de propósito.
    acoesDebtEbitdaEliminate: 4.0,
    // Prejuízo líquido em ≥ N dos últimos 4 trimestres = eliminação.
    acoesLossQuartersEliminate: 2,
    // RJ/recuperação extrajudicial própria, ou protocolo de pedido nos
    // últimos N meses = eliminação imediata.
    judicialRecoveryMonths: 12,
    // ── FIIs ──
    // Receita do fundo vinculada a inquilino(s) em recuperação judicial acima
    // deste % = eliminação (risco direto na distribuição).
    fiiTenantInRJMaxRevenuePct: 15,
    // FII alavancado: obrigações/dívidas acima deste % do PL em cenário de CDI
    // alto = SINALIZAR risco explicitamente (não elimina automaticamente).
    fiiLeverageWarnPctPL: 30,
    // Campo obrigatório por ativo no relatório.
    ratingLevels: ['BAIXO', 'MÉDIO', 'ALTO'],
  },

  // META GERAL
  targets: {
    dyPortfolio: 11,              // % a.a.
    minMonthlyContribution: 520,  // R$ (referência; o aporte real varia mês a mês)
    // Meta de longo prazo: renda passiva mensal aos 60 anos
    monthlyPassiveIncome: 8_000,  // R$/mês
    horizonYears: 24,             // anos até a meta (60 anos de idade)
  },
};

// Rótulos pt-BR usados nas categorias do app (assets.type, gráficos, prompt)
export const CATEGORY_LABELS = {
  fiis:      'FIIs',
  acoes:     'Ações',
  rendaFixa: 'Renda Fixa',
  etfs:      'ETFs',
  cripto:    'Cripto',
};

// Alocação alvo no formato { 'FIIs': 40, ... } — mantém compat com o restante do app
export const KRAKEN_MODEL = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [
    label,
    KRAKEN_CRITERIA.allocation[key].target,
  ])
);

// Limites de contagem no formato { 'FIIs': { min, max, exact }, ... }
// Categorias com `count` (meta exata) viram min = max = count, exact = true.
export const ASSET_COUNT_LIMITS = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const a = KRAKEN_CRITERIA.allocation[key];
    return [label, a.count != null
      ? { min: a.count, max: a.count, exact: true }
      : { min: a.min, max: a.max, exact: false }];
  })
);

// Rótulo da quantidade por categoria: "exatamente 7 ativos" ou "2 a 3 ativos"
export function countLabel(key) {
  const a = KRAKEN_CRITERIA.allocation[key];
  if (a.count != null) return a.count === 1 ? '1 ativo' : `exatamente ${a.count} ativos`;
  return `${a.min} a ${a.max} ativos`;
}

export default KRAKEN_CRITERIA;
