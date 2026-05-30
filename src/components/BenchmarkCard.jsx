/**
 * BenchmarkCard — Carteira vs CDI vs IBOVESPA
 * Shows a normalized % performance LineChart for the selected period.
 * Below the chart: comparison badges (bate/perde + alpha).
 */

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, CheckCircle2, XCircle } from 'lucide-react';

// ── Formatting helpers ────────────────────────────────────────────────────────

const fmtPct = (v, sign = true) => {
  if (v == null || isNaN(v)) return 'N/D';
  const s = sign && v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
};

function fmtAxisDate(dateStr, period) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return period === 'month' ? `${+d}/${m}` : months[+m - 1];
}

function fmtTooltipDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Series config ─────────────────────────────────────────────────────────────

const SERIES = [
  { key: 'portfolio', label: 'Carteira',  color: '#3b82f6', dot: false },
  { key: 'cdi',       label: 'CDI',       color: '#f59e0b', dot: false },
  { key: 'ibov',      label: 'IBOVESPA',  color: '#10b981', dot: false },
];

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function BenchmarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  // Build map from dataKey → value
  const vals = {};
  payload.forEach(p => { vals[p.dataKey] = p.value; });

  return (
    <div style={{
      background:   '#161b22',
      border:       '1px solid #21262d',
      borderRadius: 8,
      padding:      '8px 12px',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
      minWidth:     130,
    }}>
      <p style={{ fontSize: 11, color: '#484f58', marginBottom: 6 }}>
        {fmtTooltipDate(label)}
      </p>
      {SERIES.map(({ key, label: seriesLabel, color }) => {
        const v = vals[key];
        if (v == null) return null;
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#8b949e' }}>{seriesLabel}</span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: v >= 0 ? color : '#f85149',
              fontFamily: 'JetBrains Mono, monospace',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtPct(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <div className="skeleton rounded" style={{ width: 70, height: 26 }} />
        <div className="skeleton rounded" style={{ width: 70, height: 26 }} />
      </div>
      <div className="skeleton rounded" style={{ height: 160 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <div className="skeleton rounded" style={{ height: 20, flex: 1 }} />
        <div className="skeleton rounded" style={{ height: 20, flex: 1 }} />
      </div>
    </div>
  );
}

// ── Comparison badges ─────────────────────────────────────────────────────────

function ComparisonBadges({ portfolio, cdi, ibov }) {
  if (portfolio == null) return null;

  const cdiBeat  = cdi  != null ? cdi  > portfolio : null;
  const ibovBeat = ibov != null ? ibov > portfolio : null;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      {cdi != null && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: cdiBeat ? '#f85149' : '#3fb950',
        }}>
          {cdiBeat ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
          <span>{cdiBeat ? 'Perde' : 'Bate'} CDI</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            ({fmtPct(portfolio - cdi)})
          </span>
        </span>
      )}
      {ibov != null && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: ibovBeat ? '#f85149' : '#3fb950',
        }}>
          {ibovBeat ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
          <span>{ibovBeat ? 'Perde' : 'Bate'} IBOV</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            ({fmtPct(portfolio - ibov)})
          </span>
        </span>
      )}
    </div>
  );
}

// ── Period tabs ───────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'month', label: '30 dias' },
  { key: 'ytd',   label: 'No ano'  },
];

// ── Main card ─────────────────────────────────────────────────────────────────

export default function BenchmarkCard({ monthly, yearly, cdi, ibov, benchmarkSeries, loading }) {
  const [period, setPeriod] = useState('month');

  // Select the active series
  const seriesData = benchmarkSeries?.[period] ?? null;

  // Scalar values for the selected period
  const portfolioScalar = period === 'month' ? (monthly?.pct ?? null) : (yearly?.pct ?? null);
  const cdiScalar       = period === 'month' ? (cdi?.month ?? null)   : (cdi?.ytd ?? null);
  const ibovScalar      = period === 'month' ? (ibov?.month ?? null)  : (ibov?.ytd ?? null);

  // Ticks: ~6 evenly spaced
  const ticks = (() => {
    if (!seriesData?.length) return [];
    const n    = Math.min(6, seriesData.length);
    const step = Math.floor((seriesData.length - 1) / (n - 1 || 1));
    return Array.from({ length: n }, (_, i) =>
      seriesData[Math.min(i * step, seriesData.length - 1)]?.date
    ).filter(Boolean);
  })();

  // Y-axis domain — symmetric around 0 with some padding
  const yDomain = (() => {
    if (!seriesData?.length) return ['auto', 'auto'];
    const allVals = seriesData.flatMap(d =>
      [d.portfolio, d.ibov, d.cdi].filter(v => v != null)
    );
    if (!allVals.length) return ['auto', 'auto'];
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = Math.max((max - min) * 0.12, 0.5);
    return [
      Math.floor((min - pad) * 10) / 10,
      Math.ceil((max + pad)  * 10) / 10,
    ];
  })();

  return (
    <div className="card fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart2 size={13} color="#8b5cf6" />
        <h2 className="text-sm font-medium" style={{ color: '#8b949e' }}>
          Benchmark
        </h2>
        <span style={{
          fontSize: 10, color: '#8b5cf6',
          background: '#1a1a2e', border: '1px solid #3d2a7a',
          borderRadius: 4, padding: '1px 6px', fontWeight: 600,
        }}>
          CDI · IBOVESPA
        </span>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            {/* Period tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => {
                const active = p.key === period;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className="btn-inline"
                    style={{
                      padding:      '4px 12px',
                      borderRadius: 5,
                      fontSize:     11,
                      fontWeight:   active ? 700 : 400,
                      background:   active ? '#1a1a2e' : 'transparent',
                      border:       `1px solid ${active ? '#3d2a7a' : '#21262d'}`,
                      color:        active ? '#8b5cf6' : '#484f58',
                      cursor:       'pointer',
                      transition:   'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {SERIES.map(({ key, label, color }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 2, borderRadius: 1, background: color }} />
                  <span style={{ fontSize: 10, color: '#484f58' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          {seriesData?.length ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={seriesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#161b22" vertical={false} />

                <ReferenceLine y={0} stroke="#21262d" strokeWidth={1} />

                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  tickFormatter={(d) => fmtAxisDate(d, period)}
                  tick={{ fill: '#484f58', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={yDomain}
                  tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  tick={{ fill: '#484f58', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />

                <Tooltip
                  content={<BenchmarkTooltip />}
                  cursor={{ stroke: '#30363d', strokeWidth: 1, strokeDasharray: '4 2' }}
                />

                {SERIES.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={key === 'portfolio' ? 2 : 1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: color, stroke: '#0d1117', strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#484f58' }}>Dados insuficientes para o período.</span>
            </div>
          )}

          {/* Comparison badges */}
          <ComparisonBadges
            portfolio={portfolioScalar}
            cdi={cdiScalar}
            ibov={ibovScalar}
          />

          {/* Disclaimer */}
          <p style={{ fontSize: 10, color: '#30363d', marginTop: 12, lineHeight: 1.5 }}>
            CDI via BCB (série 4391). IBOVESPA via Yahoo Finance (^BVSP).
            Retornos normalizados a partir do início do período — base 0%.
          </p>
        </>
      )}
    </div>
  );
}
