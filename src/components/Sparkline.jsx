/**
 * Sparkline — mini SVG area+line chart for 30-day price history.
 * No axes, no labels. Just the shape of the price movement.
 */
export default function Sparkline({ prices, ticker, positive, width = 64, height = 26 }) {
  // Show skeleton while loading
  if (!prices || prices.length < 2) {
    return (
      <div
        className="skeleton rounded"
        style={{ width, height, display: 'inline-block' }}
      />
    );
  }

  const W = width;
  const H = height;
  const PAD = 3; // vertical padding so line doesn't clip

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || Math.abs(min) * 0.02 || 1;

  const pts = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * W,
    y: PAD + (H - PAD * 2) - ((p - min) / range) * (H - PAD * 2),
  }));

  // SVG path helpers
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  const color   = positive ? '#3fb950' : '#f85149';
  const gradId  = `spark-${ticker ?? 'x'}-${positive ? 'g' : 'r'}`;
  const lastPt  = pts[pts.length - 1];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Last point dot */}
      <circle cx={lastPt.x} cy={lastPt.y} r={2} fill={color} />
    </svg>
  );
}
