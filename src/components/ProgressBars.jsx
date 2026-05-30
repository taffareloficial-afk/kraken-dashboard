import { KRAKEN_MODEL, CATEGORY_COLORS, CATEGORY_ICONS, ALERT_THRESHOLD } from '../constants';

const fmt = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

function DeviationBadge({ diff }) {
  const abs = Math.abs(diff);
  let color, label;
  if (abs < 2) {
    color = '#3fb950'; label = '✓ Na meta';
  } else if (abs < ALERT_THRESHOLD) {
    color = '#f59e0b'; label = diff > 0 ? `+${diff.toFixed(1)}% acima` : `${diff.toFixed(1)}% abaixo`;
  } else {
    color = '#f85149'; label = diff > 0 ? `+${diff.toFixed(1)}% ACIMA` : `${diff.toFixed(1)}% ABAIXO`;
  }
  return (
    <span
      className="text-xs mono font-semibold px-2 py-0.5 rounded-md"
      style={{ background: color + '20', color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

export default function ProgressBars({ currentAllocation, categoryValues, totalValue }) {
  return (
    <div className="card fade-in">
      <h2 className="text-sm font-medium mb-3" style={{ color: '#8b949e' }}>
        Progresso por categoria
      </h2>

      <div className="space-y-4">
        {Object.entries(KRAKEN_MODEL).map(([cat, target]) => {
          const current = currentAllocation[cat] ?? 0;
          const diff = current - target;
          const catValue = categoryValues[cat] ?? 0;
          const color = CATEGORY_COLORS[cat];

          // Bar widths capped at 100
          const currentWidth = Math.min(current, 100);
          const targetMark = Math.min(target, 100);

          return (
            <div key={cat}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium" style={{ color: '#c9d1d9' }}>
                  {CATEGORY_ICONS[cat]} {cat}
                </span>
                <DeviationBadge diff={diff} />
              </div>

              {/* Progress bar */}
              <div className="relative progress-bar-bg h-2.5">
                {/* Actual fill */}
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${currentWidth}%`, background: color }}
                />
                {/* Target marker line */}
                <div
                  className="absolute top-0 h-full w-0.5 rounded-full"
                  style={{ left: `${targetMark}%`, background: '#e6edf380', transform: 'translateX(-50%)' }}
                />
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-3 text-xs">
                  <span style={{ color }}>
                    <span className="mono font-semibold">{current.toFixed(1)}%</span>
                    <span style={{ color: '#484f58' }}> atual</span>
                  </span>
                  <span style={{ color: '#484f58' }}>|</span>
                  <span style={{ color: '#8b949e' }}>
                    <span className="mono">{target}%</span>
                    <span> meta</span>
                  </span>
                </div>
                <span className="text-xs mono" style={{ color: '#8b949e' }}>
                  {fmt(catValue)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale hint */}
      <div className="flex justify-between mt-4 pt-3 text-xs mono" style={{ borderTop: '1px solid #1a1f27', color: '#30363d' }}>
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
