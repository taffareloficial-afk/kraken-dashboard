import { useState, useEffect } from 'react';
import { Target, TrendingUp, Clock } from 'lucide-react';

const LS_KEY = 'kraken_goal_v1';

const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtBRL2 = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function loadGoal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') ?? { target: 50000, monthly: 500 };
  } catch {
    return { target: 50000, monthly: 500 };
  }
}

function timeLabel(months) {
  if (!isFinite(months) || months <= 0) return '—';
  if (months < 1)  return 'menos de 1 mês';
  if (months < 12) return `~${Math.ceil(months)} ${Math.ceil(months) === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rem   = Math.ceil(months % 12);
  if (rem === 0) return `~${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `~${years} ${years === 1 ? 'ano' : 'anos'} e ${rem} ${rem === 1 ? 'mês' : 'meses'}`;
}

// ── Editable number input ─────────────────────────────────────────────────────
function GoalInput({ label, value, onChange, min = 0, step = 100 }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#484f58', display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#0a0e14', border: '1px solid #21262d',
          borderRadius: 8, padding: '7px 10px',
        }}
      >
        <span style={{ fontSize: 12, color: '#484f58' }}>R$</span>
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => onChange(Math.max(min, Number(e.target.value)))}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#e6edf3',
            fontFamily: 'JetBrains Mono, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 13,
            fontWeight: 600,
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GoalTracker({ totalValue, loading }) {
  const [goal, setGoalState] = useState(loadGoal);

  // Persist whenever goal changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(goal));
  }, [goal]);

  const setTarget  = v => setGoalState(prev => ({ ...prev, target: v }));
  const setMonthly = v => setGoalState(prev => ({ ...prev, monthly: v }));

  const current   = loading ? 0 : totalValue;
  const target    = goal.target;
  const monthly   = goal.monthly;
  const remaining = Math.max(0, target - current);
  const progress  = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const achieved  = current >= target && target > 0;

  // Linear estimate (ignoring appreciation)
  const monthsRemaining = monthly > 0 ? remaining / monthly : Infinity;

  // Color: green if >= 80%, yellow if >= 40%, red otherwise
  const barColor = progress >= 80 ? '#3fb950' : progress >= 40 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="card fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Target size={13} color="#8b5cf6" />
        <h2 className="text-sm font-medium" style={{ color: '#8b949e' }}>Meta de patrimônio</h2>
      </div>

      {/* Achievement banner */}
      {achieved && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0d2c1a', border: '1px solid #1a4731',
            borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <p style={{ color: '#3fb950', fontWeight: 700, fontSize: 13 }}>Meta atingida!</p>
            <p style={{ color: '#484f58', fontSize: 11 }}>
              Sua carteira superou a meta de {fmtBRL(target)}.
            </p>
          </div>
        </div>
      )}

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <GoalInput
          label="Meta de patrimônio"
          value={goal.target}
          onChange={setTarget}
          min={0}
          step={5000}
        />
        <GoalInput
          label="Aporte mensal estimado"
          value={goal.monthly}
          onChange={setMonthly}
          min={0}
          step={100}
        />
      </div>

      {/* Progress bar */}
      {target > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="mono text-xs font-semibold" style={{ color: barColor }}>
              {loading ? '—' : fmtBRL(current)}
            </span>
            <span className="mono text-xs" style={{ color: '#484f58' }}>
              meta {fmtBRL(target)}
            </span>
          </div>
          <div style={{ background: '#161b22', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: barColor,
                borderRadius: 99,
                transition: 'width 0.8s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="mono text-xs font-bold" style={{ color: barColor }}>
              {progress.toFixed(1)}%
            </span>
            <span className="text-xs" style={{ color: '#484f58' }}>
              {achieved ? 'concluída' : `faltam ${fmtBRL(remaining)}`}
            </span>
          </div>
        </>
      )}

      {/* Stats row */}
      {target > 0 && !achieved && (
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 8, marginTop: 12,
          }}
        >
          {/* Time estimate */}
          <div
            style={{
              background: '#161b22', border: '1px solid #21262d',
              borderRadius: 10, padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Clock size={11} color="#484f58" />
              <span style={{ fontSize: 10, color: '#484f58', fontWeight: 500 }}>Estimativa</span>
            </div>
            <p className="mono font-semibold" style={{ color: '#e6edf3', fontSize: 13 }}>
              {loading ? '—' : timeLabel(monthsRemaining)}
            </p>
            <p style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>
              com aportes de {fmtBRL2(monthly)}/mês
            </p>
          </div>

          {/* Monthly needed to reach goal in 1 year */}
          <div
            style={{
              background: '#161b22', border: '1px solid #21262d',
              borderRadius: 10, padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <TrendingUp size={11} color="#484f58" />
              <span style={{ fontSize: 10, color: '#484f58', fontWeight: 500 }}>Para atingir em 1 ano</span>
            </div>
            <p className="mono font-semibold" style={{ color: '#e6edf3', fontSize: 13 }}>
              {loading ? '—' : fmtBRL2(Math.max(0, remaining / 12))}
              <span style={{ fontSize: 10, color: '#484f58', fontWeight: 400 }}>/mês</span>
            </p>
            <p style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>
              estimativa linear · sem rendimentos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
