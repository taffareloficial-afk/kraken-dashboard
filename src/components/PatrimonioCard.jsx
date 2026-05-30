import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

const fmt = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

function Skeleton({ w = 'w-32', h = 'h-8' }) {
  return <div className={`skeleton ${w} ${h}`} />;
}

// ── Compact PnL pill ──────────────────────────────────────────────────────────
function PnLPill({ label, pnl, pct, loading }) {
  if (loading) {
    return <div className="skeleton rounded-md" style={{ width: 110, height: 22 }} />;
  }
  if (pnl == null || pct == null) return null;
  const pos = pnl >= 0;
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        padding:      '3px 8px',
        borderRadius: 6,
        background:   pos ? '#0d2c1a' : '#2d1215',
        border:       `1px solid ${pos ? '#1a4731' : '#6e1c1f'}`,
      }}
    >
      {pos
        ? <TrendingUp  size={10} color="#3fb950" />
        : <TrendingDown size={10} color="#f85149" />
      }
      <span
        className="mono text-xs font-semibold"
        style={{ color: pos ? '#3fb950' : '#f85149', fontVariantNumeric: 'tabular-nums' }}
      >
        {pos ? '+' : ''}{fmtPct(pct)}
      </span>
      <span className="text-xs" style={{ color: '#484f58' }}>{label}</span>
    </div>
  );
}

export default function PatrimonioCard({
  assets,
  totalValue,
  dailyPnL,
  loading,
  categoryValues,
  onFocusClick,
  // Historical PnL — passed from parent after usePortfolioHistory
  weeklyPnL,   // { pnl, pct } | null
  monthlyPnL,  // { pnl, pct } | null
  histLoading,
}) {
  const animatedTotal = useAnimatedValue(loading ? 0 : totalValue, 700);
  const animatedPnL   = useAnimatedValue(loading ? 0 : dailyPnL,   700);

  const displayTotal = loading ? totalValue : animatedTotal;
  const displayPnL   = loading ? dailyPnL   : animatedPnL;
  const pnlPct   = displayTotal > 0 ? (displayPnL / (displayTotal - displayPnL)) * 100 : 0;
  const positive = dailyPnL >= 0;

  return (
    <div className="card fade-in" style={{ padding: '20px 24px', overflow: 'hidden' }}>
      {/* Subtle brand gradient glow — decorative overlay */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          background:    'radial-gradient(ellipse 55% 70% at 0% 50%, rgba(29,78,216,0.09) 0%, rgba(109,40,217,0.04) 50%, transparent 80%)',
          pointerEvents: 'none',
          borderRadius:  'inherit',
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* ── Left: total value + PnL rows ─────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wallet size={13} color="#484f58" />
            <span className="text-xs font-medium" style={{ color: '#484f58', letterSpacing: '0.02em' }}>
              Patrimônio total
            </span>
          </div>

          {loading ? (
            <Skeleton w="w-56" h="h-12" />
          ) : (
            <p
              className="mono font-bold"
              onClick={onFocusClick}
              style={{
                fontSize:           '2.75rem',
                lineHeight:         1.05,
                color:              '#e6edf3',
                letterSpacing:      '-1.5px',
                cursor:             onFocusClick ? 'pointer' : 'default',
                userSelect:         'none',
                transition:         'opacity 200ms ease-out',
              }}
              title={onFocusClick ? 'Clique para modo foco' : undefined}
            >
              {fmt(displayTotal)}
            </p>
          )}

          {/* ── Daily PnL (primary) ──────────────────────────────────── */}
          <div className="flex items-center gap-2 mt-1.5">
            {loading ? (
              <Skeleton w="w-36" h="h-4" />
            ) : (
              <>
                {positive
                  ? <TrendingUp  size={13} color="#3fb950" />
                  : <TrendingDown size={13} color="#f85149" />
                }
                <span
                  className="text-sm mono font-medium"
                  style={{ color: positive ? '#3fb950' : '#f85149' }}
                >
                  {positive ? '+' : ''}{fmt(displayPnL)}
                </span>
                <span className="text-xs" style={{ color: '#484f58' }}>
                  ({positive ? '+' : ''}{pnlPct.toFixed(2)}%) hoje
                </span>
              </>
            )}
          </div>

          {/* ── Weekly + Monthly pills ───────────────────────────────── */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PnLPill
              label="7 dias"
              pnl={weeklyPnL?.pnl ?? null}
              pct={weeklyPnL?.pct ?? null}
              loading={histLoading}
            />
            <PnLPill
              label="30 dias"
              pnl={monthlyPnL?.pnl ?? null}
              pct={monthlyPnL?.pct ?? null}
              loading={histLoading}
            />
          </div>
        </div>

        {/* ── Right: category breakdown ─────────────────────────────── */}
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {Object.entries(categoryValues)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => {
              const color = CATEGORY_COLORS[cat] ?? '#e6edf3';
              return (
                <div
                  key={cat}
                  className="flex flex-col gap-0.5 min-w-[88px]"
                  style={{
                    background:  color + '0d',
                    borderRadius: 8,
                    padding:     '8px 12px',
                    borderLeft:  `2px solid ${color}40`,
                  }}
                >
                  <span className="text-xs" style={{ color: '#484f58' }}>{cat}</span>
                  {loading ? (
                    <Skeleton w="w-20" h="h-4" />
                  ) : (
                    <span className="text-sm mono font-semibold" style={{ color }}>
                      {fmt(val)}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
