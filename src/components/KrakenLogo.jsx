/**
 * KrakenLogo — Marca Kraken Dashboard.
 *
 * Conceito 4 — "Crescimento de Energia" (refinado):
 *  - K geométrico bold com gradiente azul royal → cyan
 *  - Gráfico de barras ascendente limpo (3 barras crescentes) no interior
 *  - Linha de tendência com ponta de seta ↗ atravessando as barras
 *
 * Props:
 *  size  — largura/altura em px (default 32)
 *  id    — sufixo único para o gradientId (evita conflito entre instâncias)
 */
export default function KrakenLogo({ size = 32, id = 'kl' }) {
  const g  = `kgr-${id}`;
  const gb = `kgrb-${id}`;

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
        {/* Variante mais clara para as barras (contraste sobre o K) */}
        <linearGradient id={gb} x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3aa0ff" />
          <stop offset="100%" stopColor="#7fe3ff" />
        </linearGradient>
      </defs>

      {/* ── K — haste vertical ──────────────────────────────────────────── */}
      <rect x="10" y="8" width="14" height="84" rx="3.5" fill={`url(#${g})`} />

      {/* ── K — braço superior (paralelogramo, sobe à direita) ──────────── */}
      <polygon points="24,38 24,52 52,30 52,16" fill={`url(#${g})`} />

      {/* ── K — braço inferior (paralelogramo, desce à direita) ─────────── */}
      <polygon points="24,48 24,62 52,84 52,70" fill={`url(#${g})`} />

      {/* ── Gráfico de barras ascendente (lado direito) ─────────────────── */}
      {/* baseline ~ y=78 · 3 barras crescentes */}
      <rect x="58" y="60" width="9" height="18" rx="2" fill={`url(#${gb})`} />
      <rect x="71" y="48" width="9" height="30" rx="2" fill={`url(#${gb})`} />
      <rect x="84" y="34" width="9" height="44" rx="2" fill={`url(#${gb})`} />

      {/* ── Linha de tendência crescente sobre as barras ────────────────── */}
      <line
        x1="55" y1="70"
        x2="90" y2="24"
        stroke="#ffffff"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.95"
      />

      {/* ── Ponta de seta ↗ ───────────────────────────────────────────── */}
      <polygon points="95,18 81,21 86,33" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}
