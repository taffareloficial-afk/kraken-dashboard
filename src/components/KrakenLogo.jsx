/**
 * KrakenLogo — Marca Kraken Dashboard.
 *
 * Design premium fintech (TradingView / Bloomberg style):
 *  - Fundo transparente (native dark mode)
 *  - K geométrico bold com gradiente azul royal → cyan
 *  - 3 corpos de candlestick ascendentes no interior do K
 *  - Linha de tendência crescente com ponta de seta ↗
 *
 * Props:
 *  size  — largura/altura em px (default 32)
 *  id    — sufixo único para o gradientId (evita conflito entre instâncias)
 */
export default function KrakenLogo({ size = 32, id = 'kl' }) {
  const g = `kgr-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kraken Dashboard"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        {/* Gradiente diagonal: azul profundo (baixo-esq) → cyan vivo (cima-dir) */}
        <linearGradient id={g} x1="5" y1="95" x2="95" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0047cc" />
          <stop offset="48%"  stopColor="#0080ff" />
          <stop offset="100%" stopColor="#00c4ff" />
        </linearGradient>
      </defs>

      {/* ── K — haste vertical ──────────────────────────────────────────── */}
      <rect x="11" y="8" width="15" height="84" rx="3" fill={`url(#${g})`} />

      {/* ── K — braço superior (paralelogramo) ─────────────────────────── */}
      {/* Origem na haste (x=26) em y=[36,50] → extremo (x=83) em y=[8,20] */}
      <polygon points="26,36 26,50 83,20 83,8" fill={`url(#${g})`} />

      {/* ── K — braço inferior (paralelogramo) ─────────────────────────── */}
      {/* Origem na haste (x=26) em y=[50,64] → extremo (x=83) em y=[80,92] */}
      <polygon points="26,50 26,64 83,92 83,80" fill={`url(#${g})`} />

      {/* ── Candlesticks — 3 barras ascendentes dentro do K ─────────────── */}
      {/* Wick 1 */}
      <line x1="38" y1="29" x2="38" y2="58" stroke={`url(#${g})`} strokeWidth="2.2" strokeLinecap="round" />
      {/* Body 1 */}
      <rect x="34.5" y="36" width="7" height="15" rx="1.5" fill={`url(#${g})`} />

      {/* Wick 2 */}
      <line x1="50" y1="20" x2="50" y2="49" stroke={`url(#${g})`} strokeWidth="2.2" strokeLinecap="round" />
      {/* Body 2 */}
      <rect x="46.5" y="27" width="7" height="15" rx="1.5" fill={`url(#${g})`} />

      {/* Wick 3 */}
      <line x1="62" y1="11" x2="62" y2="40" stroke={`url(#${g})`} strokeWidth="2.2" strokeLinecap="round" />
      {/* Body 3 */}
      <rect x="58.5" y="18" width="7" height="15" rx="1.5" fill={`url(#${g})`} />

      {/* ── Linha de tendência crescente ─────────────────────────────────── */}
      <line
        x1="4" y1="83"
        x2="79" y2="19"
        stroke={`url(#${g})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* ── Ponta de seta ↗ ───────────────────────────────────────────── */}
      <polygon points="91,11 77,17 83,29" fill={`url(#${g})`} />
    </svg>
  );
}
