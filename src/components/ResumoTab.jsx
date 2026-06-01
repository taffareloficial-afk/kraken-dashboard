/**
 * ResumoTab — layout estilo Investidor10 para a aba Resumo.
 *
 *  1. Faixa de 4 cards de resumo (topo)
 *  2. Seção central 2 colunas: barras mensais | donuts + legenda
 *  3. "Meus Ativos" agrupados por categoria, linhas expansíveis
 */

import { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown,
  TrendingUp, TrendingDown,
  Wallet, Gift, BarChart2 as BarIcon, Percent,
  Upload, ClipboardList,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { KRAKEN_MODEL, CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { calcPMData } from '../utils/portfolio';
import { useIsDark } from '../ThemeContext';
import PatrimonioChart from './PatrimonioChart';

// ── Formatting ────────────────────────────────────────────────────────────────

const fmtBRL = (v, compact = false) => {
  if (v == null || isNaN(v)) return '—';
  if (compact && Math.abs(v) >= 1000)
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};
const fmtPct = (v) => {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
};
const sign = (v) => (v == null || isNaN(v) ? 'var(--c-tx3)' : v >= 0 ? '#3fb950' : '#f85149');

// ── Top summary card ──────────────────────────────────────────────────────────

/**
 * placeholder — shown instead of main value when there is no data yet.
 * sub        — secondary line below the main value (string or number).
 *              If number: displayed as fmtPct with sign color.
 *              If string: displayed as-is in muted gray.
 */
function SummaryCard({ label, main, mainColor, sub, subLabel, placeholder, icon: Icon, iconColor, titleColor, loading }) {
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 90, padding: '20px 22px' }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={26} color={iconColor} />
        <span style={{ fontSize: 16, color: titleColor ?? '#1A1A1A', fontWeight: 500, letterSpacing: '0.02em' }}>
          {label}
        </span>
      </div>

      {/* Main value / skeleton / placeholder */}
      {loading ? (
        <div className="skeleton rounded" style={{ height: 36, width: '75%' }} />
      ) : placeholder ? (
        <p style={{ fontSize: 12, color: 'var(--c-tx5)', fontStyle: 'italic', lineHeight: 1.4, flex: 1 }}>
          {placeholder}
        </p>
      ) : (
        <p
          className="mono"
          style={{
            fontSize:           '24px',
            fontWeight:         700,
            letterSpacing:      '-0.5px',
            color:              mainColor ?? '#D0D0D0',
            fontVariantNumeric: 'tabular-nums',
            lineHeight:         1.1,
          }}
        >
          {main}
        </p>
      )}

      {/* Secondary info */}
      {!loading && !placeholder && sub != null && (
        <p style={{
          fontSize:           14,
          fontFamily:         'JetBrains Mono, monospace',
          fontVariantNumeric: 'tabular-nums',
          color:              typeof sub === 'number' ? sign(sub) : 'var(--c-tx4)',
          marginTop:          -2,
        }}>
          {typeof sub === 'number' ? fmtPct(sub) : sub}
          {subLabel && <span style={{ color: 'var(--c-tx5)', marginLeft: 4 }}>{subLabel}</span>}
        </p>
      )}
    </div>
  );
}

// ── Dual metric card (Variação + Rentabilidade side-by-side) ──────────────────

function DualMetricCard({
  label1, main1, mainColor1, icon1: Icon1, iconColor1,
  label2, main2, mainColor2, icon2: Icon2, iconColor2,
  titleColor,
  loading
}) {
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 90, padding: '20px 22px' }}
    >
      {/* Labels row */}
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon1 size={26} color={iconColor1} />
          <span style={{ fontSize: 16, color: titleColor ?? '#1A1A1A', fontWeight: 500, letterSpacing: '0.02em' }}>
            {label1}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon2 size={26} color={iconColor2} />
          <span style={{ fontSize: 16, color: titleColor ?? '#1A1A1A', fontWeight: 500, letterSpacing: '0.02em' }}>
            {label2}
          </span>
        </div>
      </div>

      {/* Values row */}
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        {loading ? (
          <>
            <div className="skeleton rounded" style={{ height: 32, width: '100%' }} />
            <div className="skeleton rounded" style={{ height: 32, width: '100%' }} />
          </>
        ) : (
          <>
            <p
              className="mono"
              style={{
                flex: 1,
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                color: mainColor1 ?? '#000000',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {main1}
            </p>
            <p
              className="mono"
              style={{
                flex: 1,
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                color: mainColor2 ?? '#000000',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {main2}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Donut (single) ────────────────────────────────────────────────────────────

const RADIAN = Math.PI / 180;

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

function Donut({ data, title }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--c-tx3)', textAlign: 'center', marginBottom: 6 }}>{title}</p>
      <div style={{ height: 175 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={data.length > 1 ? 2 : 0}
              dataKey="value"
              labelLine={false}
              label={DonutLabel}
              isAnimationActive={false}
              stroke="transparent"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} stroke="var(--c-surface)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0];
                return (
                  <div className="card-sm" style={{ fontSize: 11 }}>
                    <span style={{ color: d.payload.fill, fontWeight: 700 }}>{d.name}</span>
                    <span className="mono" style={{ color: 'var(--c-tx1)', marginLeft: 8 }}>{d.value.toFixed(1)}%</span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Allocation card: two donuts + legend ──────────────────────────────────────

function AllocationSection({ currentAllocation, categoryValues, totalValue }) {
  const hasData = totalValue > 0;

  const currentData = hasData
    ? Object.entries(KRAKEN_MODEL)
        .map(([cat]) => ({ name: cat, value: currentAllocation[cat] ?? 0, fill: CATEGORY_COLORS[cat] }))
        .filter(d => d.value > 0.01)
    : [{ name: 'Sem dados', value: 1, fill: 'var(--c-b1)' }];

  const targetData = Object.entries(KRAKEN_MODEL).map(([cat, pct]) => ({
    name: cat, value: pct, fill: CATEGORY_COLORS[cat],
  }));

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-tx3)', marginBottom: 12, flexShrink: 0 }}>
        Alocação atual vs Modelo Kraken
      </h2>

      {/* Two donuts — fixed size, don't grow */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Donut data={currentData} title="Atual" />
        <Donut data={targetData} title="Modelo Kraken" />
      </div>

      {/* Legend — grows to fill remaining height, rows distributed evenly */}
      <div style={{
        borderTop:      '1px solid var(--c-b2)',
        paddingTop:     12,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'space-between',
        flex:           1,
      }}>
        {Object.entries(KRAKEN_MODEL).map(([cat, target]) => {
          const current = currentAllocation[cat] ?? 0;
          const diff    = current - target;
          const color   = CATEGORY_COLORS[cat];
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: 'var(--c-tx2)', flex: 1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: '1.4em', textAlign: 'center', flexShrink: 0 }}>{CATEGORY_ICONS[cat]}</span>
                {cat}
              </span>
              <span className="mono" style={{ color, minWidth: 42, textAlign: 'right', fontWeight: 600 }}>{current.toFixed(1)}%</span>
              <span style={{ color: 'var(--c-tx4)', fontSize: 11 }}>vs</span>
              <span className="mono" style={{ color: 'var(--c-tx3)', minWidth: 32 }}>{target}%</span>
              <span
                className="mono"
                style={{
                  color: Math.abs(diff) < 2 ? '#3fb950' : diff > 0 ? '#f59e0b' : '#f85149',
                  minWidth: 52, textAlign: 'right', fontWeight: 700,
                }}
              >
                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Individual asset row (inside expanded category) ───────────────────────────
// Columns: Ativo · Qtd · Preço Médio · Preço Atual · Var. dia · Rentabilidade · Saldo
// On mobile (<768px): hides Qtd, Preço Médio, Rentabilidade (class resumo-col-sm-hide)

function AssetRow({ asset, avgCost }) {
  const returnPct = avgCost > 0 ? (asset.price - avgCost) / avgCost * 100 : null;
  const catColor  = CATEGORY_COLORS[asset.type] ?? 'var(--c-tx3)';
  const mono      = { fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        8,
      padding:    '11px 24px 11px 44px',
      borderTop:  '1px solid #0d1117',
      background: 'var(--c-s4)',
    }}>
      {/* 1 · Ativo */}
      <div style={{ flex: 1.5, minWidth: 0 }}>
        <span className="mono font-semibold" style={{ color: catColor, fontSize: 13 }}>{asset.ticker}</span>
        <span style={{ color: 'var(--c-tx4)', marginLeft: 6, fontSize: 11 }}>{asset.name}</span>
      </div>

      {/* 2 · Quantidade — hidden on mobile */}
      <div className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right', ...mono, color: 'var(--c-tx3)', fontSize: 13 }}>
        {asset.shares.toLocaleString('pt-BR')}
      </div>

      {/* 3 · Preço Médio — hidden on mobile */}
      <div className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right', ...mono, color: 'var(--c-tx3)', fontSize: 13 }}>
        {avgCost > 0
          ? fmtBRL(avgCost)
          : <span style={{ color: 'var(--c-tx5)' }}>—</span>
        }
      </div>

      {/* 4 · Preço Atual */}
      <div style={{ flex: 1, textAlign: 'right', ...mono, color: 'var(--c-tx2)', fontSize: 13 }}>
        {fmtBRL(asset.price)}
      </div>

      {/* 5 · Variação dia */}
      <div style={{ flex: 1, textAlign: 'right', ...mono, color: sign(asset.changePercent), fontSize: 13 }}>
        {fmtPct(asset.changePercent)}
      </div>

      {/* 6 · Rentabilidade total — hidden on mobile */}
      <div className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right', ...mono, color: sign(returnPct), fontSize: 13 }}>
        {returnPct != null
          ? fmtPct(returnPct)
          : <span style={{ color: 'var(--c-tx5)' }}>—</span>
        }
      </div>

      {/* 7 · Saldo */}
      <div style={{ flex: 1, textAlign: 'right', ...mono, color: 'var(--c-tx1)', fontSize: 13, fontWeight: 600 }}>
        {fmtBRL(asset.totalValue)}
      </div>
    </div>
  );
}

// ── Category header row ───────────────────────────────────────────────────────

function CategoryRow({ stat, isExpanded, onToggle, avgCostByTicker }) {
  const { cat, assets, value, dailyPct, returnPct, alloc, target } = stat;
  const color = CATEGORY_COLORS[cat] ?? 'var(--c-tx3)';
  const diff  = alloc - target;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Category header */}
      <button
        onClick={onToggle}
        className="btn-inline resumo-cat-btn"
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        12,
          width:      '100%',
          padding:    '16px 24px',
          minHeight:  60,
          background: 'transparent',
          border:     'none',
          cursor:     'pointer',
          textAlign:  'left',
        }}
      >
        {/* Expand icon */}
        {isExpanded
          ? <ChevronDown  size={15} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
          : <ChevronRight size={15} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
        }

        {/* Color dot + name */}
        <div className="resumo-cat-name" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 2, minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-tx1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ display: 'inline-block', width: '1.4em', textAlign: 'center' }}>{CATEGORY_ICONS[cat]}</span>
            {' '}{cat}
          </span>
          <span
            className="resumo-cat-hide"
            style={{
              fontSize: 11, color: 'var(--c-tx4)',
              background: 'var(--c-s2)', borderRadius: 4,
              padding: '2px 7px', flexShrink: 0,
            }}
          >
            {assets.length} {assets.length === 1 ? 'ativo' : 'ativos'}
          </span>
        </div>

        {/* Value */}
        <div style={{ flex: 1, textAlign: 'right', minWidth: 100 }}>
          <span className="mono font-semibold" style={{ fontSize: 15, color: 'var(--c-tx1)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtBRL(value, true)}
          </span>
        </div>

        {/* Daily % — hidden on mobile */}
        <div className="resumo-cat-hide" style={{ flex: 1, textAlign: 'right', minWidth: 76 }}>
          <span className="mono" style={{ fontSize: 14, color: sign(dailyPct), fontVariantNumeric: 'tabular-nums' }}>
            {fmtPct(dailyPct)}
          </span>
        </div>

        {/* Return since purchase — hidden on mobile */}
        <div className="resumo-cat-hide" style={{ flex: 1, textAlign: 'right', minWidth: 80 }}>
          <span className="mono" style={{ fontSize: 14, color: sign(returnPct), fontVariantNumeric: 'tabular-nums' }}>
            {returnPct != null ? fmtPct(returnPct) : <span style={{ color: 'var(--c-tx5)' }}>—</span>}
          </span>
          <div style={{ fontSize: 11, color: 'var(--c-tx4)', marginTop: 2 }}>desde compra</div>
        </div>

        {/* Alloc % vs target — hidden on mobile */}
        <div className="resumo-cat-hide" style={{ flex: 1, textAlign: 'right', minWidth: 96 }}>
          <span className="mono font-semibold" style={{ fontSize: 14, color, fontVariantNumeric: 'tabular-nums' }}>
            {alloc.toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--c-tx4)', marginLeft: 4 }}>
            / {target}%
          </span>
          <div
            style={{
              fontSize: 11, fontWeight: 600, marginTop: 2,
              color: Math.abs(diff) < 2 ? '#3fb950' : diff > 0 ? '#f59e0b' : '#f85149',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
          </div>
        </div>
      </button>

      {/* Expanded asset rows */}
      {isExpanded && (
        <>
          {/* Sub-header */}
          <div style={{
            display: 'flex', gap: 8, padding: '7px 24px 7px 44px',
            background: 'var(--c-s3)', borderTop: '1px solid var(--c-b3)',
            fontSize: 10, color: 'var(--c-tx5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <span style={{ flex: 1.5 }}>Ativo</span>
            <span className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right' }}>Qtd</span>
            <span className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right' }}>Preço Médio</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Preço Atual</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Var. dia</span>
            <span className="resumo-col-sm-hide" style={{ flex: 1, textAlign: 'right' }}>Rentab.</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Saldo</span>
          </div>
          {assets.map(asset => (
            <AssetRow
              key={asset.ticker}
              asset={asset}
              avgCost={avgCostByTicker[asset.ticker] ?? 0}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Ações', 'FIIs', 'ETFs', 'Renda Fixa', 'Cripto'];

export default function ResumoTab({
  assets, totalValue, dailyPnL, loading, histLoading,
  categoryValues, currentAllocation, chartData,
  benchmarkSeries, assetPerf, cdiByPeriod,
  lancamentos, proventosStats,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const isDark = useIsDark();

  // Dynamic colors based on theme
  const titleColor = isDark ? '#FFFFFF' : '#1A1A1A';
  const numberColorNeutral = isDark ? '#FFFFFF' : '#000000';

  // Helper function: get color based on theme and value semantics
  // valueType: 'neutral' | 'value' (auto-detect sign) | 'positive' | 'negative'
  const getNumberColor = (value, valueType = 'neutral') => {
    if (valueType === 'neutral') {
      return isDark ? '#FFFFFF' : '#1A1A1A';
    }

    // Auto-detect sign from numeric value
    if (valueType === 'value' && typeof value === 'number' && !isNaN(value)) {
      return value >= 0 ? '#00AA44' : '#EE3333';
    }

    // Explicit positive/negative
    if (valueType === 'positive') return '#00AA44';
    if (valueType === 'negative') return '#EE3333';

    // Default to neutral
    return isDark ? '#FFFFFF' : '#1A1A1A';
  };

  const toggle = (cat) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  // ── PM-based financial data (com reset ao zerar posição) ──────────────
  //
  // gcNaoRealizado é computado NO MESMO LOOP que totalInvestido usando
  // asset.price × asset.shares (mesmos ativos, mesma base). Isso evita
  // a inconsistência de usar totalValue (que inclui ativos sem PM) vs
  // totalInvestido (que exclui ativos sem PM).
  //
  // Lucro Total   = GC_realizado + GC_não_realizado + Proventos
  // Rentabilidade = Lucro Total / totalInvestido × 100
  const financialData = useMemo(() => {
    // Aguarda preços de mercado carregarem (ao menos 1 ativo com price > 0)
    if (!assets.length || assets.every(a => !(a.price > 0))) return null;

    const pmData  = calcPMData(lancamentos);
    const hasBuys = Object.values(pmData).some(
      d => d.totalInvestido > 0 || d.gcRealizado !== 0
    );
    if (!hasBuys) return null;

    // GC realizado: todos os tickers (inclui posições já fechadas)
    let gcRealizado  = 0;
    const pmByTicker = {};
    for (const [ticker, d] of Object.entries(pmData)) {
      gcRealizado += d.gcRealizado;
      if (d.pm != null) pmByTicker[ticker] = d.pm;
    }

    // Total investido (PM × shares) e valor de mercado (price × shares)
    // no mesmo loop → gcNaoRealizado = Σ(price − PM) × shares (consistente)
    let totalInvestido = 0;
    let marketValue    = 0;
    for (const asset of assets) {
      if (asset.shares <= 0 || !(asset.price > 0)) continue; // pula preços não carregados
      const pm = pmByTicker[asset.ticker];
      if (pm == null) continue;
      totalInvestido += pm          * asset.shares;
      marketValue    += asset.price * asset.shares;
    }

    const gcNaoRealizado = marketValue - totalInvestido; // Σ(price − PM) × shares
    const gcTotal        = gcRealizado + gcNaoRealizado;

    return { totalInvestido, gcRealizado, gcNaoRealizado, gcTotal, pmByTicker };
  }, [lancamentos, assets]);   // totalValue não é dep — marketValue vem de assets.price

  const proventos12M = useMemo(() => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return lancamentos
      .filter(l => l.category === 'provento' && l.date >= cutoffStr)
      .reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  }, [lancamentos]);

  // Lucro Total alinhado ao Investidor10: considera apenas as POSIÇÕES ATUAIS.
  //   Lucro Total   = GC não realizado (patrimônio − investido) + proventos
  // GC realizado (ganhos de vendas passadas) é excluído — não faz parte do
  // resultado das posições abertas que o usuário acompanha hoje.
  //
  // Rentabilidade: TWR via Modified Dietz — leva em conta o TIMING dos aportes
  // para que comparações com benchmarks (CDI, IBOV) sejam justas. A fórmula
  // simples (lucro/investido) subestima retornos quando o usuário aporta ao
  // longo do tempo, já que aportes recentes não tiveram tempo de render.
  const totalInvested  = financialData?.totalInvestido ?? 0;
  const gcNaoRealizado = financialData?.gcNaoRealizado ?? null;
  const totalProventos = proventosStats?.totalGeral    ?? 0;
  // Lucro Total = ganho de capital (Σ preço atual×qtd − PM×qtd) + proventos.
  // O ganho de capital respeita valores negativos (ativos abaixo do PM).
  const lucroTotal     = financialData != null ? financialData.gcNaoRealizado + totalProventos : null;

  // Variação TOTAL acumulada (só capital): (valor atual − investido) / investido
  const variacaoTotal  = (financialData != null && totalInvested > 0)
    ? (gcNaoRealizado / totalInvested) * 100
    : null;

  // Rentabilidade = Lucro Total (capital + proventos) / Total Investido
  const rentabilidade  = (financialData != null && totalInvested > 0)
    ? (lucroTotal / totalInvested) * 100
    : null;

  const dailyPct       = totalValue > 0 ? dailyPnL / Math.max(totalValue - dailyPnL, 1) * 100 : 0;

  // ── Category stats ─────────────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    if (!assets.length) return [];
    const pmByTicker = financialData?.pmByTicker ?? {};

    return CATEGORY_ORDER.map(cat => {
      const catAssets = assets.filter(a => a.type === cat && a.shares > 0);
      if (!catAssets.length) return null;

      const value     = catAssets.reduce((s, a) => s + a.price * a.shares, 0);
      const prevValue = catAssets.reduce((s, a) => s + (a.price - (a.change || 0)) * a.shares, 0);
      const dailyPct  = prevValue > 0 ? (value - prevValue) / prevValue * 100 : 0;

      // Custo e valor de mercado usando PM × asset.shares (fonte de verdade)
      let catCost = 0, catMarketOpen = 0;
      for (const asset of catAssets) {
        if (asset.shares <= 0) continue;
        const pm = pmByTicker[asset.ticker];
        if (pm == null) continue;
        catCost      += pm * asset.shares;
        catMarketOpen += asset.price * asset.shares;
      }
      const returnPct = catCost > 0 ? (catMarketOpen - catCost) / catCost * 100 : null;

      const alloc  = totalValue > 0 ? value / totalValue * 100 : 0;
      const target = KRAKEN_MODEL[cat] ?? 0;

      return { cat, assets: catAssets, value, dailyPct, returnPct, alloc, target };
    }).filter(Boolean);
  }, [assets, financialData, lancamentos, totalValue]);

  const noBuyData    = !loading && !financialData;
  const noBuyHint    = 'Registre compras em Lançamentos';

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── 1. Top 4 summary cards (CSS grid handles columns) ───────────── */}
      <div className="summary-cards-grid">

        {/* Patrimônio Total */}
        <SummaryCard
          label="Patrimônio Total"
          main={fmtBRL(totalValue)}
          mainColor={getNumberColor(null, 'neutral')}
          sub={dailyPct}
          subLabel="hoje"
          icon={Wallet}
          iconColor="#3b82f6"
          titleColor={titleColor}
          loading={loading}
        />

        {/* Lucro Total */}
        <SummaryCard
          label="Lucro Total"
          main={noBuyData ? null : fmtBRL(lucroTotal)}
          mainColor={noBuyData ? getNumberColor(null, 'neutral') : getNumberColor(lucroTotal, 'value')}
          sub={noBuyData ? null : `${fmtBRL(gcNaoRealizado, true)} · Prov ${fmtBRL(totalProventos, true)}`}
          placeholder={noBuyData ? noBuyHint : undefined}
          icon={TrendingUp}
          iconColor="#3fb950"
          titleColor={titleColor}
          loading={loading}
        />

        {/* Proventos 12M */}
        <SummaryCard
          label="Proventos Recebidos 12M"
          main={fmtBRL(proventos12M)}
          mainColor={getNumberColor(null, 'neutral')}
          sub={totalProventos > 0 ? `${fmtBRL(totalProventos, true)} histórico total` : null}
          icon={Gift}
          iconColor="#10b981"
          titleColor={titleColor}
          loading={loading}
        />

        {/* Variação + Rentabilidade (side-by-side) */}
        <DualMetricCard
          label1="Variação"
          main1={noBuyData ? null : fmtPct(variacaoTotal)}
          mainColor1={noBuyData ? getNumberColor(null, 'neutral') : getNumberColor(variacaoTotal, 'value')}
          icon1={(variacaoTotal ?? 0) >= 0 ? TrendingUp : TrendingDown}
          iconColor1={(variacaoTotal ?? 0) >= 0 ? '#00AA44' : '#EE3333'}
          label2="Rentabilidade"
          main2={noBuyData ? null : fmtPct(rentabilidade)}
          mainColor2={noBuyData ? getNumberColor(null, 'neutral') : getNumberColor(rentabilidade, 'value')}
          icon2={Percent}
          iconColor2="#8b5cf6"
          titleColor={titleColor}
          loading={loading}
        />
      </div>

      {/* ── 2. Charts row ───────────────────────────────────────────────── */}
      <div className="resumo-chart-grid stagger-item" style={{ '--i': 1 }}>
        {/* Left: monthly bar chart (60%) */}
        <div style={{ alignSelf: 'start' }}>
          <PatrimonioChart
            chartData={chartData}
            loading={histLoading}
            benchmarkSeries={benchmarkSeries}
            assetPerf={assetPerf}
            cdiByPeriod={cdiByPeriod}
            lancamentos={lancamentos}
            assets={assets}
            initialType="line"
            initialPeriod="1Y"
            chartHeight={260}
          />
        </div>

        {/* Right: donuts + legend — stretches to match left column height */}
        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
          <AllocationSection
            currentAllocation={currentAllocation}
            categoryValues={categoryValues}
            totalValue={totalValue}
          />
        </div>
      </div>

      {/* ── 3. Meus Ativos ──────────────────────────────────────────────── */}
      <div className="stagger-item" style={{ '--i': 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <BarIcon size={16} color="var(--c-tx3)" />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-tx1)' }}>Meus Ativos</h2>
          <span style={{ fontSize: 12, color: 'var(--c-tx4)' }}>por categoria</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton rounded-lg" style={{ height: 68 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryStats.map(stat => (
              <CategoryRow
                key={stat.cat}
                stat={stat}
                isExpanded={expanded.has(stat.cat)}
                onToggle={() => toggle(stat.cat)}
                avgCostByTicker={financialData?.pmByTicker ?? {}}
              />
            ))}
            {categoryStats.length === 0 && (
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:           16,
                padding:       '36px 24px',
                borderRadius:  12,
                background:    'var(--c-s2)',
                border:        '1px dashed var(--c-b4)',
                textAlign:     'center',
              }}>
                <div style={{
                  width:          52,
                  height:         52,
                  borderRadius:   '50%',
                  background:     'rgba(59,130,246,0.08)',
                  border:         '1px solid rgba(59,130,246,0.2)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                }}>
                  <ClipboardList size={24} color="#3b82f6" />
                </div>

                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-tx1)', marginBottom: 6 }}>
                    Nenhum ativo registrado
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--c-tx4)', lineHeight: 1.5, maxWidth: 320 }}>
                    Acesse a aba <strong style={{ color: 'var(--c-tx2)' }}>Lançamentos</strong> para adicionar suas compras,
                    ou importe seus dados de outro dispositivo.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          6,
                    padding:      '6px 14px',
                    borderRadius: 8,
                    background:   'rgba(59,130,246,0.08)',
                    border:       '1px solid rgba(59,130,246,0.2)',
                    fontSize:     12,
                    color:        '#3b82f6',
                    fontWeight:   600,
                  }}>
                    <ClipboardList size={12} />
                    Aba Lançamentos → Adicionar
                  </div>
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          6,
                    padding:      '6px 14px',
                    borderRadius: 8,
                    background:   'rgba(139,92,246,0.08)',
                    border:       '1px solid rgba(139,92,246,0.2)',
                    fontSize:     12,
                    color:        '#8b5cf6',
                    fontWeight:   600,
                  }}>
                    <Upload size={12} />
                    Lançamentos → Importar JSON
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
