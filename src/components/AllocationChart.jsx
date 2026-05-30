import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { KRAKEN_MODEL, CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';

const RADIAN = Math.PI / 180;

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {(percent * 100).toFixed(1)}%
    </text>
  );
}

function CustomTooltip({ active, payload, categoryValues, totalValue }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const catVal = categoryValues?.[d.name] ?? 0;
  const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
  return (
    <div className="card-sm text-xs" style={{ minWidth: 160 }}>
      <p className="font-semibold mb-2" style={{ color: d.payload.fill }}>{d.name}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#8b949e' }}>Atual</span>
          <span className="mono font-semibold" style={{ color: '#e6edf3' }}>{d.value.toFixed(1)}%</span>
        </div>
        {catVal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#8b949e' }}>Valor</span>
            <span className="mono font-semibold" style={{ color: d.payload.fill }}>{fmtBRL(catVal)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#8b949e' }}>Meta</span>
          <span className="mono" style={{ color: '#484f58' }}>{KRAKEN_MODEL[d.name] ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data, empty, categoryValues, totalValue }) {
  return (
    // Fixed pixel height so ResponsiveContainer has a concrete parent measurement
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={data.length > 1 ? 2 : 0}
            dataKey="value"
            labelLine={false}
            label={empty ? undefined : CustomLabel}
            // Disable animation to prevent transition-bug from loading→data state
            isAnimationActive={false}
            stroke="transparent"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} stroke="#0d1117" strokeWidth={2} />
            ))}
          </Pie>
          {!empty && (
            <Tooltip
              content={<CustomTooltip categoryValues={categoryValues} totalValue={totalValue} />}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AllocationChart({ currentAllocation, totalValue, categoryValues = {} }) {
  // Build current-allocation data — always 5 categories, 0 for missing ones
  const hasData = totalValue > 0;

  const currentData = hasData
    ? Object.entries(KRAKEN_MODEL)
        .map(([cat, target]) => ({
          name: cat,
          value: currentAllocation[cat] ?? 0,
          target,
          fill: CATEGORY_COLORS[cat],
        }))
        .filter(d => d.value > 0.01)   // skip truly-zero slices
    : [{ name: 'Sem dados', value: 1, fill: '#21262d' }];

  const targetData = Object.entries(KRAKEN_MODEL).map(([cat, target]) => ({
    name: cat,
    value: target,
    fill: CATEGORY_COLORS[cat],
  }));

  return (
    <div className="card fade-in">
      <h2 className="text-sm font-medium mb-3" style={{ color: '#8b949e' }}>
        Alocação atual vs Modelo Kraken
      </h2>

      <div className="donut-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* Current allocation */}
        <div>
          <p className="text-xs text-center mb-2" style={{ color: '#8b949e' }}>Atual</p>
          <DonutChart data={currentData} empty={!hasData} categoryValues={categoryValues} totalValue={totalValue} />
        </div>

        {/* Kraken model */}
        <div>
          <p className="text-xs text-center mb-2" style={{ color: '#8b949e' }}>Modelo Kraken</p>
          <DonutChart data={targetData} empty={false} />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1a1f27' }}>
        <div className="flex flex-col gap-2">
          {Object.entries(KRAKEN_MODEL).map(([cat, target]) => {
            const current = currentAllocation[cat] ?? 0;
            const diff = current - target;
            const color = CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span style={{ color: '#c9d1d9' }}>{CATEGORY_ICONS[cat]} {cat}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono" style={{ color }}>
                    {current.toFixed(1)}%
                  </span>
                  <span style={{ color: '#484f58' }}>vs</span>
                  <span className="mono" style={{ color: '#8b949e' }}>{target}%</span>
                  <span
                    className="mono font-semibold"
                    style={{
                      color: Math.abs(diff) < 2 ? '#3fb950' : diff < 0 ? '#f85149' : '#f59e0b',
                      minWidth: 44,
                      textAlign: 'right',
                    }}
                  >
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
