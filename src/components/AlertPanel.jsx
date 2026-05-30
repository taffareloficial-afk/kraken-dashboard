import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { KRAKEN_MODEL, CATEGORY_COLORS, CATEGORY_ICONS, ALERT_THRESHOLD } from '../constants';

export default function AlertPanel({ currentAllocation }) {
  const alerts = Object.entries(KRAKEN_MODEL)
    .map(([cat, target]) => ({
      cat,
      target,
      current: currentAllocation[cat] ?? 0,
      diff: (currentAllocation[cat] ?? 0) - target,
    }))
    .filter(a => Math.abs(a.diff) >= ALERT_THRESHOLD)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const warnings = Object.entries(KRAKEN_MODEL)
    .map(([cat, target]) => ({
      cat,
      target,
      current: currentAllocation[cat] ?? 0,
      diff: (currentAllocation[cat] ?? 0) - target,
    }))
    .filter(a => Math.abs(a.diff) >= 2 && Math.abs(a.diff) < ALERT_THRESHOLD);

  return (
    <div className="card fade-in">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={15} color={alerts.length > 0 ? '#f85149' : '#3fb950'} />
        <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
          Painel de Alertas
        </h2>
        {alerts.length > 0 && (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-full mono"
            style={{ background: '#f8514920', color: '#f85149', border: '1px solid #f8514940' }}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {/* Critical alerts */}
      {alerts.length === 0 && warnings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg"
          style={{ background: '#0d2c1a', border: '1px solid #1a4731' }}
        >
          <CheckCircle size={28} color="#3fb950" />
          <p className="text-sm font-medium" style={{ color: '#3fb950' }}>Carteira dentro dos limites</p>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            Nenhuma categoria desviou mais de {ALERT_THRESHOLD}% da meta
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(({ cat, target, current, diff }) => {
            const over = diff > 0;
            const color = CATEGORY_COLORS[cat];
            return (
              <div
                key={cat}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{
                  background: '#2d1215',
                  border: '1px solid #6e1c1f',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: color + '20' }}
                >
                  {CATEGORY_ICONS[cat]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: '#f85149' }}>
                      {cat}
                    </span>
                    <span
                      className="text-xs mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#f8514920', color: '#f85149' }}
                    >
                      {over ? '+' : ''}{diff.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                    Atual: <span className="mono" style={{ color }}>{current.toFixed(1)}%</span>
                    {' · '}Meta: <span className="mono">{target}%</span>
                    {' · '}
                    <span style={{ color: '#f85149' }}>
                      {over
                        ? `${diff.toFixed(1)}pp acima do limite`
                        : `${Math.abs(diff).toFixed(1)}pp abaixo do limite`}
                    </span>
                  </p>
                </div>
                {over ? <TrendingUp size={16} color="#f85149" /> : <TrendingDown size={16} color="#f85149" />}
              </div>
            );
          })}

          {/* Warnings */}
          {warnings.map(({ cat, target, current, diff }) => {
            const color = CATEGORY_COLORS[cat];
            return (
              <div
                key={cat}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: '#2c1f06', border: '1px solid #6e4c1a' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: color + '20' }}
                >
                  {CATEGORY_ICONS[cat]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>{cat}</span>
                    <span className="text-xs mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                    Atenção: desviando da meta. Atual: <span className="mono" style={{ color }}>{current.toFixed(1)}%</span>
                    {' · '}Meta: <span className="mono">{target}%</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
