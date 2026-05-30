import {
  Zap, TrendingUp, TrendingDown,
  Info, Calendar, Target, Scale,
} from 'lucide-react';
import { calcHealthScore, getScoreStyle, generateInsights } from '../utils/portfolio';

// ── Icon resolver ─────────────────────────────────────────────────────────────
function InsightIcon({ type, size = 16, color }) {
  const props = { size, color };
  switch (type) {
    case 'up':       return <TrendingUp    {...props} />;
    case 'down':     return <TrendingDown  {...props} />;
    case 'calendar': return <Calendar      {...props} />;
    case 'missing':  return <Target        {...props} />;
    case 'balance':  return <Scale         {...props} />;
    default:         return <Info          {...props} />;
  }
}

// ── Insight style map ─────────────────────────────────────────────────────────
const TYPE_STYLE = {
  warning: { color: '#f59e0b', bg: '#2c1f0620', border: '#6e4c1a50' },
  info:    { color: '#3b82f6', bg: '#0d1e2e',   border: '#1e3a5f' },
  success: { color: '#3fb950', bg: '#0d2c1a',   border: '#1a4731' },
  tip:     { color: '#8b5cf6', bg: '#1a1a2e',   border: '#3d2a7a' },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonInsight() {
  return (
    <div
      style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        borderRadius: 10, background: '#161b22', border: '1px solid #21262d',
      }}
    >
      <div className="skeleton rounded-full flex-shrink-0" style={{ width: 28, height: 28 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton rounded" style={{ width: '40%', height: 13, marginBottom: 8 }} />
        <div className="skeleton rounded" style={{ width: '90%', height: 11, marginBottom: 4 }} />
        <div className="skeleton rounded" style={{ width: '70%', height: 11 }} />
      </div>
    </div>
  );
}

// ── Health Score strip ────────────────────────────────────────────────────────
function HealthScore({ score }) {
  const { color, barColor, label } = getScoreStyle(score);

  if (score === null) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 10,
        background: color + '10', border: `1px solid ${color}30`,
        marginBottom: 12,
      }}
    >
      {/* Score number */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <p
          className="mono font-bold"
          style={{ fontSize: 26, color, lineHeight: 1, letterSpacing: '-1px' }}
        >
          {score}
        </p>
        <p style={{ fontSize: 9, color: color + 'aa', fontWeight: 600, letterSpacing: '0.05em', marginTop: 1 }}>
          /100
        </p>
      </div>

      {/* Bar + label */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 6 }}>{label}</p>
        <div style={{ background: '#161b22', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div
            style={{
              width: `${score}%`,
              height: '100%',
              background: barColor,
              borderRadius: 99,
              transition: 'width 1s ease',
            }}
          />
        </div>
        <p style={{ fontSize: 10, color: '#484f58', marginTop: 4 }}>
          Saúde da carteira · baseado no desvio do Modelo Kraken
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InsightsPanel({
  currentAllocation,
  assets,
  lancamentos,
  proventosRows,
  totalValue,
  dailyPnL,
  categoryValues,
  loading,
}) {
  const score    = calcHealthScore(currentAllocation);
  const insights = loading
    ? []
    : generateInsights({ currentAllocation, assets, lancamentos, proventosRows, totalValue, dailyPnL });

  return (
    <>
      <div className="card fade-in">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} color="#f59e0b" />
          <h2 className="text-sm font-medium" style={{ color: '#8b949e' }}>
            Insights automáticos
          </h2>
          {!loading && insights.length > 0 && (
            <span
              style={{
                background: '#2c1f06', color: '#f59e0b',
                border: '1px solid #6e4c1a',
                fontSize: 11, padding: '1px 7px', borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {insights.length}
            </span>
          )}
        </div>

        {/* ── Health score ────────────────────────────────────────────── */}
        {loading
          ? (
            <div style={{ marginBottom: 12 }}>
              <div className="skeleton rounded-lg" style={{ height: 64 }} />
            </div>
          )
          : <HealthScore score={score} />
        }

        {/* ── Insights list ───────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <SkeletonInsight key={i} />)}
          </div>
        ) : insights.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#484f58' }}>
            <Zap size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>
              {totalValue > 0
                ? 'Tudo em ordem — nenhum alerta no momento.'
                : 'Aguardando dados da carteira…'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((ins, i) => {
              const s = TYPE_STYLE[ins.type] ?? TYPE_STYLE.info;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    background: s.bg, border: `1px solid ${s.border}`,
                  }}
                >
                  {/* Icon circle */}
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: s.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}
                  >
                    <InsightIcon type={ins.icon} size={14} color={s.color} />
                  </div>

                  {/* Text */}
                  <div>
                    <p style={{ color: s.color, fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                      {ins.title}
                    </p>
                    <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.6 }}>
                      {ins.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}
