/**
 * PatrimonioChart — AreaChart (linha, diário) / BarChart (barras, mensal).
 * Period selector: 1M, 3M, 6M, 1A  |  Chart-type toggle: linha / barras.
 *
 * Bar mode: one bar per completed calendar month (last trading-day value).
 * Line mode: daily data, unchanged.
 */

import { useState, useMemo } from 'react';
import { useIsDark } from '../ThemeContext';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, LineChart, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ── Formatting helpers ────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmtBRL = (v) =>
  v == null ? '—'
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtBRLFull = (v) =>
  v == null ? '—'
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = (v) => {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
};

function fmtAxisDate(dateStr, period) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return period === '1M' ? `${+d} ${MONTH_NAMES[+m - 1]}` : MONTH_NAMES[+m - 1];
}

function fmtTooltipDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Period config ─────────────────────────────────────────────────────────────

const PERIODS = [
  { key: '1M', label: '1M', days: 30  },
  { key: '3M', label: '3M', days: 90  },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1A', days: 365 },
];

// ── Helper to calculate PM data from lancamentos ────────────────────────────

function calcPMData(lancamentos) {
  const pmData = {};
  for (const op of (lancamentos ?? []).filter(l => l.category === 'operacao' && l.type === 'compra')) {
    const t = op.ticker;
    if (!pmData[t]) pmData[t] = { totalInvestido: 0, totalQty: 0, gcRealizado: 0 };
    pmData[t].totalInvestido += (op.total ?? op.price * op.quantity) || 0;
    pmData[t].totalQty += op.quantity || 0;
  }
  for (const [t, v] of Object.entries(pmData)) {
    v.pm = v.totalQty > 0 ? v.totalInvestido / v.totalQty : null;
  }
  return pmData;
}

// ── Helper to calculate "Valor Aplicado" by month using PM × cotas ───────────
//
// Investidor10 (and most brokerage platforms) define "Valor Aplicado" as
// the cost basis of CURRENT POSITIONS (PM × cotas ativas), not net cash flow
// (compras − vendas). When the user sells, the cost basis of remaining shares
// does NOT change — only the realized capital gain is materialized.
//
// Example:
//   Buy 100 @ R$ 10  → PM = R$ 10, qty = 100, Valor Aplicado = R$ 1.000
//   Sell 50 @ R$ 12  → PM = R$ 10, qty =  50, Valor Aplicado = R$  500 (not 400!)
//
// This function returns a map { 'YYYY-MM' → totalInvestido } where each month
// reflects the cost basis of positions held at end-of-month.
function calcInvestedValueByMonth(lancamentos) {
  const ops = (lancamentos ?? [])
    .filter(l => l.category === 'operacao' && (l.type === 'compra' || l.type === 'venda'))
    .filter(l => l.date && l.ticker)
    .sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      // Same date: compras first so PM is established before any sales
      if (a.type !== b.type) return a.type === 'compra' ? -1 : 1;
      // Same date and type: use createdAt as final tie-breaker
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

  if (typeof window !== 'undefined' && lancamentos?.length > 0 && ops.length === 0) {
    console.warn('[PatrimonioChart] No operacoes found! Total lancamentos:', lancamentos.length);
    console.warn('[PatrimonioChart] Sample lancamento:', lancamentos[0]);
  }

  // Running per-ticker state: { pm, qty }
  const state = {};
  const result = {};

  let lastMonthSnapshot = null;
  let lastMonth = null;

  for (const op of ops) {
    const t = op.ticker;
    const qty = parseFloat(op.quantity) || 0;
    const total = parseFloat(op.total) || ((parseFloat(op.price) || 0) * qty);

    if (!state[t]) state[t] = { pm: 0, qty: 0 };
    const s = state[t];

    if (op.type === 'compra') {
      // Weighted-average PM update
      const newQty = s.qty + qty;
      if (newQty > 0) {
        s.pm = (s.pm * s.qty + total) / newQty;
      }
      s.qty = newQty;
    } else if (op.type === 'venda') {
      // Selling does NOT change PM — only reduces quantity
      s.qty = Math.max(0, s.qty - qty);
      // Optional: if qty hits zero, keep PM at 0 (no remaining position)
      if (s.qty === 0) s.pm = 0;
    }

    // Snapshot total invested at this point
    const monthKey = op.date.slice(0, 7);
    const totalInvested = Object.values(state)
      .filter(v => v.qty > 0)
      .reduce((sum, v) => sum + v.pm * v.qty, 0);

    // Fill any gap months between lastMonth and current monthKey with previous value
    if (lastMonth && lastMonth < monthKey && lastMonthSnapshot != null) {
      // (No-op — we only record at each operation; gaps are handled by tooltip lookup)
    }

    result[monthKey] = totalInvested;
    lastMonth = monthKey;
    lastMonthSnapshot = totalInvested;
  }

  return result;
}

// ── Custom Tooltip (with colored legend) ──────────────────────────────────────

function CustomTooltip({ active, payload, label, isMonthly, lancamentos, assets }) {
  if (!active || !payload?.length) return null;
  const patrimonio = payload[0]?.value;

  // Calculate totalInvestido from lancamentos using cumulative method
  let totalInvestido = 0;

  if (lancamentos?.length) {
    const cumulativeInvested = calcInvestedValueByMonth(lancamentos);

    // Get the month key from the label
    let monthKey = null;
    if (isMonthly) {
      monthKey = label; // label is already YYYY-MM in bar mode
    } else if (label) {
      monthKey = label.slice(0, 7); // Extract YYYY-MM from YYYY-MM-DD
    }

    if (monthKey) {
      // First try exact match
      if (cumulativeInvested[monthKey] != null) {
        totalInvestido = cumulativeInvested[monthKey];
      } else {
        // If no data for that month, use the last available cumulative value up to that month
        const availableMonths = Object.keys(cumulativeInvested)
          .filter(m => m <= monthKey)
          .sort();
        if (availableMonths.length > 0) {
          totalInvestido = cumulativeInvested[availableMonths[availableMonths.length - 1]];
        }
      }
    }
  }

  const capitalGain = totalInvestido > 0 ? patrimonio - totalInvestido : 0;

  const legendItems = [
    { color: '#2563EB', label: 'Patrimônio', value: patrimonio },
    { color: '#22C55E', label: 'Valor Aplicado', value: totalInvestido },
    { color: capitalGain >= 0 ? '#86EFAC' : '#F87171', label: 'Ganho de Capital', value: capitalGain },
  ];

  return (
    <div style={{
      background:   'var(--c-s2)',
      border:       '1px solid var(--c-b1)',
      borderRadius: 8,
      padding:      '10px 12px',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
      minWidth:     240,
    }}>
      {/* Date header */}
      <p style={{ fontSize: 11, color: 'var(--c-tx4)', marginBottom: 8 }}>
        {isMonthly
          ? (() => {
              const [y, m] = (label ?? '').split('-');
              return `${MONTH_NAMES[+m - 1]} ${y}`;
            })()
          : fmtTooltipDate(label)
        }
      </p>

      {/* Colored legend items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {legendItems.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Color square */}
            <div style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: item.color,
              flexShrink: 0,
            }} />
            {/* Label + Value */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--c-tx3)' }}>
                {item.label}:
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--c-tx1)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {fmtBRLFull(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Period → data-key maps ────────────────────────────────────────────────────

const PERIOD_BENCH_KEY = { '1M': 'month', '3M': 'm3', '6M': 'm6', '1Y': 'ytd' };
const PERIOD_ASSET_KEY = { '1M': 'm1',    '3M': 'm3', '6M': 'm6', '1Y': 'ytd' };

// ── Period Summary Panel ──────────────────────────────────────────────────────

function SummaryCard({ title, children, style = {} }) {
  return (
    <div style={{
      flex:         '1 1 140px',
      minWidth:     0,
      padding:      '10px 12px',
      borderRadius: 8,
      background:   'var(--c-s2)',
      border:       '1px solid var(--c-b1)',
      ...style,
    }}>
      <p style={{ fontSize: 10, color: 'var(--c-tx4)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function PctLine({ pct, label, size = 13 }) {
  if (pct == null || isNaN(pct)) return <span style={{ fontSize: size, color: 'var(--c-tx4)' }}>—</span>;
  const pos = pct >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {pos
        ? <ArrowUpRight   size={12} color="#3fb950" style={{ flexShrink: 0 }} />
        : <ArrowDownRight size={12} color="#f85149" style={{ flexShrink: 0 }} />
      }
      <span style={{
        fontSize:           size,
        fontWeight:         700,
        color:              pos ? '#3fb950' : '#f85149',
        fontVariantNumeric: 'tabular-nums',
        fontFamily:         'JetBrains Mono, monospace',
      }}>
        {fmtPct(pct)}
      </span>
      {label && (
        <span style={{ fontSize: 9, color: 'var(--c-tx5)', marginLeft: 2 }}>{label}</span>
      )}
    </div>
  );
}

function PeriodSummaryPanel({ period, filteredData, benchmarkSeries, assetPerf, cdiByPeriod }) {
  const benchKey = PERIOD_BENCH_KEY[period];
  const assetKey = PERIOD_ASSET_KEY[period];

  // ── Portfolio period % ──
  const startValue = filteredData?.[0]?.value ?? null;
  const endValue   = filteredData?.length ? filteredData[filteredData.length - 1].value : null;
  const portPct    = (startValue && endValue) ? (endValue - startValue) / startValue * 100 : null;

  // ── CDI: use pre-computed scalar (avoids Map-lookup issues in time-series) ──
  const cdiPct = cdiByPeriod?.[period] ?? null;

  // ── IBOV from last benchmark point ──
  const benchSlice = benchmarkSeries?.[benchKey];
  const lastBench  = benchSlice?.[benchSlice.length - 1];
  const ibovPct    = lastBench?.ibov ?? null;

  // ── Best & worst assets ──
  const perfs = (assetPerf ?? [])
    .map(a => ({ ticker: a.ticker, pct: a[assetKey] }))
    .filter(a => a.pct != null);

  const bestCandidate  = perfs.length ? perfs.reduce((a, b) => b.pct > a.pct ? b : a) : null;
  const worstCandidate = perfs.length ? perfs.reduce((a, b) => b.pct < a.pct ? b : a) : null;

  // Só mostra "Maior alta" se houver pelo menos um ativo com variação positiva
  const best  = bestCandidate?.pct  > 0 ? bestCandidate  : null;
  // Só mostra "Maior queda" se houver pelo menos um ativo com variação negativa
  const worst = worstCandidate?.pct < 0 ? worstCandidate : null;

  // Only show if there's something to display
  const hasData = portPct != null || cdiPct != null || ibovPct != null || best != null;
  if (!hasData) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 10, color: 'var(--c-tx5)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Resumo do período
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>

        {/* 1 — Portfolio performance */}
        <SummaryCard title="Carteira">
          <PctLine pct={portPct} size={14} />
          {startValue != null && (
            <p style={{ fontSize: 9, color: 'var(--c-tx5)', marginTop: 3 }}>
              início: {fmtBRL(startValue)}
            </p>
          )}
        </SummaryCard>

        {/* 2 — CDI */}
        <SummaryCard title="CDI no período">
          <PctLine pct={cdiPct} size={14} />
          {portPct != null && cdiPct != null && (
            <p style={{ fontSize: 9, color: 'var(--c-tx5)', marginTop: 3 }}>
              {portPct >= cdiPct ? '✓ acima do CDI' : '✗ abaixo do CDI'}
            </p>
          )}
        </SummaryCard>

        {/* 3 — IBOV */}
        <SummaryCard title="IBOV no período">
          <PctLine pct={ibovPct} size={14} />
          {portPct != null && ibovPct != null && (
            <p style={{ fontSize: 9, color: 'var(--c-tx5)', marginTop: 3 }}>
              {portPct >= ibovPct ? '✓ acima do IBOV' : '✗ abaixo do IBOV'}
            </p>
          )}
        </SummaryCard>

        {/* 4 — Best asset */}
        <SummaryCard title="Maior alta">
          {best ? (
            <>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-tx1)' }}>
                {best.ticker}
              </span>
              <PctLine pct={best.pct} size={11} />
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--c-tx4)' }}>—</span>
          )}
        </SummaryCard>

        {/* 5 — Worst asset */}
        <SummaryCard title="Maior queda">
          {worst ? (
            <>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-tx1)' }}>
                {worst.ticker}
              </span>
              <PctLine pct={worst.pct} size={11} />
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--c-tx4)' }}>—</span>
          )}
        </SummaryCard>

      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChartSkeleton({ height = 180 }) {
  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {PERIODS.map(p => (
          <div key={p.key} className="skeleton rounded" style={{ width: 36, height: 26 }} />
        ))}
        <div className="skeleton rounded" style={{ width: 60, height: 26, marginLeft: 8 }} />
        <div className="skeleton rounded" style={{ width: 90, height: 26, marginLeft: 'auto' }} />
      </div>
      <div className="skeleton rounded" style={{ height }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PatrimonioChart({ chartData, loading, benchmarkSeries, assetPerf, cdiByPeriod, lancamentos, assets, initialType = 'line', initialPeriod = '6M', chartHeight = 180 }) {
  const isDark = useIsDark();
  const [period,    setPeriod]    = useState(initialPeriod);
  const [chartType, setChartType] = useState(initialType); // 'line' | 'bar'

  // Recharts SVG attrs can't use CSS vars — resolve from theme
  const gridColor  = isDark ? '#161b22' : '#e4e8ef';
  const tickColor  = isDark ? '#484f58' : '#6e7781';

  // ── Daily slice (line mode) ───────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!chartData?.length) return [];
    const days = PERIODS.find(p => p.key === period)?.days ?? 180;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return chartData.filter(d => d.date >= cutoffStr);
  }, [chartData, period]);

  // ── Monthly slice (bar mode) ──────────────────────────────────────────────
  // Group filteredData by YYYY-MM, keep last entry per completed month.
  // Appends the current month as a provisional bar (isCurrentMonth: true)
  // using the most recent point from chartData.
  const monthlyData = useMemo(() => {
    if (!filteredData.length) return [];
    const byMonth = new Map();
    for (const d of filteredData) {
      const monthKey = d.date.slice(0, 7); // YYYY-MM
      byMonth.set(monthKey, d);            // last entry wins (sorted ascending)
    }
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Completed months only
    const entries = Array.from(byMonth.entries())
      .filter(([month]) => month < currentMonth)
      .map(([month, d]) => ({ ...d, monthKey: month, isCurrentMonth: false }));

    // Add current month as provisional bar using the latest point from chartData
    const lastPoint = chartData?.length ? chartData[chartData.length - 1] : null;
    if (lastPoint) {
      entries.push({ ...lastPoint, monthKey: currentMonth, isCurrentMonth: true });
    }

    return entries;
  }, [filteredData, chartData]);

  // ── Choose active dataset ─────────────────────────────────────────────────
  const activeData   = chartType === 'bar' ? monthlyData : filteredData;
  const isMonthly    = chartType === 'bar';

  // ── Period performance ────────────────────────────────────────────────────
  const periodPerf = useMemo(() => {
    if (filteredData.length < 2) return null;
    const start = filteredData[0].value;
    const end   = filteredData[filteredData.length - 1].value;
    if (!start) return null;
    return { pnl: end - start, pct: (end - start) / start * 100 };
  }, [filteredData]);

  // ── X-axis ticks ─────────────────────────────────────────────────────────
  const ticks = useMemo(() => {
    if (!activeData.length) return [];
    if (isMonthly) {
      // Show all month labels (typically 1-12 bars)
      return activeData.map(d => d.monthKey ?? d.date);
    }
    const n    = Math.min(6, activeData.length);
    const step = Math.floor((activeData.length - 1) / (n - 1 || 1));
    return Array.from({ length: n }, (_, i) =>
      activeData[Math.min(i * step, activeData.length - 1)]?.date
    ).filter(Boolean);
  }, [activeData, isMonthly]);

  // ── Y-axis domain ─────────────────────────────────────────────────────────
  const yDomain = useMemo(() => {
    if (!activeData.length) return ['auto', 'auto'];
    const vals = activeData.map(d => d.value);
    const min  = Math.min(...vals);
    const max  = Math.max(...vals);
    const pad  = (max - min) * 0.08 || max * 0.05;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [activeData]);

  // ── Bar color (relative to first bar in period) ───────────────────────────
  const baseValue = activeData[0]?.value ?? 0;

  const pos = periodPerf == null || periodPerf.pct >= 0;

  // Shared chart props
  const sharedProps = {
    data:   activeData,
    margin: { top: 4, right: 4, left: 0, bottom: 0 },
  };

  const xAxisLine = isMonthly ? (
    <XAxis
      dataKey="monthKey"
      ticks={ticks}
      tickFormatter={(mk) => {
        const [, m] = (mk ?? '').split('-');
        return MONTH_NAMES[+m - 1] ?? '';
      }}
      tick={{ fill: tickColor, fontSize: 10 }}
      axisLine={false}
      tickLine={false}
    />
  ) : (
    <XAxis
      dataKey="date"
      ticks={ticks}
      tickFormatter={(d) => fmtAxisDate(d, period)}
      tick={{ fill: tickColor, fontSize: 10 }}
      axisLine={false}
      tickLine={false}
    />
  );

  const yAxisEl = (
    <YAxis
      domain={yDomain}
      tickFormatter={(v) => fmtBRL(v)}
      tick={{ fill: tickColor, fontSize: 10 }}
      axisLine={false}
      tickLine={false}
      width={72}
    />
  );

  const gridEl = (
    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
  );

  const tooltipEl = (
    <Tooltip
      content={<CustomTooltip isMonthly={isMonthly} lancamentos={lancamentos} assets={assets} />}
      cursor={{ fill: isMonthly ? 'rgba(255,255,255,0.03)' : 'none', stroke: isDark ? '#30363d' : '#bec4cc', strokeWidth: 1, strokeDasharray: '4 2' }}
    />
  );

  return (
    <div className="card fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <LineChart size={13} color="#3b82f6" />
        <h2 className="text-sm font-medium" style={{ color: 'var(--c-tx3)' }}>
          Histórico do Patrimônio
        </h2>
      </div>

      {loading || !chartData ? (
        <ChartSkeleton height={chartHeight} />
      ) : chartData.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--c-tx4)', padding: '40px 0', fontSize: 13 }}>
          Dados insuficientes para exibir o histórico.
        </div>
      ) : (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>

            {/* Period buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => {
                const active = p.key === period;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className="btn-inline"
                    style={{
                      padding:      '4px 10px',
                      borderRadius: 5,
                      fontSize:     11,
                      fontWeight:   active ? 700 : 400,
                      background:   active ? '#1c3a5a' : 'transparent',
                      border:       `1px solid ${active ? '#3b82f6' : 'var(--c-b1)'}`,
                      color:        active ? '#58a6ff' : 'var(--c-tx4)',
                      cursor:       'pointer',
                      transition:   'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Chart-type toggle */}
            <div style={{
              display: 'flex', gap: 2,
              background: 'var(--c-s2)', borderRadius: 6, padding: 2,
              border: '1px solid var(--c-b1)',
            }}>
              {[
                { key: 'line', Icon: LineChart, title: 'Linha (diário)'  },
                { key: 'bar',  Icon: BarChart2, title: 'Barras (mensal)' },
              ].map(({ key, Icon, title }) => {
                const active = chartType === key;
                return (
                  <button
                    key={key}
                    onClick={() => setChartType(key)}
                    className="btn-inline"
                    title={title}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      width:          28,
                      height:         24,
                      borderRadius:   4,
                      border:         'none',
                      background:     active ? 'var(--c-b1)' : 'transparent',
                      color:          active ? '#58a6ff' : 'var(--c-tx4)',
                      cursor:         'pointer',
                      transition:     'all 0.15s',
                    }}
                  >
                    <Icon size={12} />
                  </button>
                );
              })}
            </div>

            {/* Period performance badge */}
            {periodPerf && (
              <div style={{
                marginLeft:   'auto',
                display:      'flex',
                alignItems:   'center',
                gap:          5,
                padding:      '3px 9px',
                borderRadius: 6,
                background:   pos ? '#0d2c1a' : '#2d1215',
                border:       `1px solid ${pos ? '#1a4731' : '#6e1c1f'}`,
              }}>
                {pos
                  ? <TrendingUp   size={10} color="#3fb950" />
                  : <TrendingDown size={10} color="#f85149" />
                }
                <span style={{
                  fontSize:           11,
                  fontWeight:         700,
                  color:              pos ? '#3fb950' : '#f85149',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily:         'JetBrains Mono, monospace',
                }}>
                  {fmtPct(periodPerf.pct)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--c-tx4)' }}>
                  ({fmtBRL(periodPerf.pnl)})
                </span>
              </div>
            )}
          </div>

          {/* Subtitle for bar mode */}
          {isMonthly && (
            <p style={{ fontSize: 10, color: '#484f58', marginBottom: 8 }}>
              Último dia útil de cada mês concluído · <span style={{ opacity: 0.6 }}>barra atual em andamento</span>
            </p>
          )}

          {/* Chart */}
          {activeData.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#484f58' }}>
                {isMonthly
                  ? 'Nenhum mês concluído no período selecionado.'
                  : 'Sem dados para o período.'}
              </span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              {chartType === 'line' ? (
                <AreaChart {...sharedProps}>
                  <defs>
                    <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {gridEl}
                  {xAxisLine}
                  {yAxisEl}
                  {tooltipEl}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#patrimonioGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#0d1117', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <BarChart {...sharedProps} barCategoryGap="18%">
                  {gridEl}
                  {xAxisLine}
                  {yAxisEl}
                  {tooltipEl}
                  <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {activeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.value >= baseValue ? '#3b82f6' : '#f85149'}
                        fillOpacity={entry.isCurrentMonth ? 0.5 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          )}

          {/* Period summary panel */}
          <PeriodSummaryPanel
            period={period}
            filteredData={filteredData}
            benchmarkSeries={benchmarkSeries}
            assetPerf={assetPerf}
            cdiByPeriod={cdiByPeriod}
          />

          {/* Footer */}
          <p style={{ fontSize: 10, color: 'var(--c-tx5)', marginTop: 12 }}>
            Calculado com cotas atuais × preços históricos diários (Yahoo Finance / CoinGecko).
          </p>
        </>
      )}
    </div>
  );
}
