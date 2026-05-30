/**
 * TickerTape — Faixa de cotações animada abaixo do TabNav.
 *
 * - Mostra os ativos da carteira do usuário com preço e variação do dia
 * - Animação contínua da direita para a esquerda (CSS @keyframes)
 * - Itens duplicados para loop seamless (-50% translateX)
 * - Sticky logo abaixo do TabNav (top: 96 = header 54 + tabnav 42)
 */

const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// ── Single ticker item ─────────────────────────────────────────────────────────

function TickerItem({ asset, isFirst }) {
  const pos   = asset.changePercent >= 0;
  const color = pos ? '#3fb950' : '#f85149';

  return (
    <span
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        7,
        padding:    '0 18px',
        whiteSpace: 'nowrap',
        borderLeft: isFirst ? 'none' : '1px solid #1e2430',
      }}
    >
      {/* Ticker symbol */}
      <span
        className="mono"
        style={{ fontWeight: 700, color: '#c9d1d9', fontSize: 11, letterSpacing: '0.04em' }}
      >
        {asset.ticker}
      </span>

      {/* Current price */}
      <span
        className="mono"
        style={{ color: '#8b949e', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
      >
        {fmtBRL(asset.price)}
      </span>

      {/* Daily % change */}
      <span
        className="mono"
        style={{ color, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {pos ? '+' : ''}{asset.changePercent.toFixed(2)}%
      </span>
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TickerTape({ assets }) {
  // Only show assets with valid price data
  const items = (assets ?? []).filter(a => a.price > 0 && a.changePercent != null);

  if (!items.length) return null;

  // Duplicate for seamless loop — animate 0% → -50%
  const doubled = [...items, ...items];

  // Duration scales with number of assets so speed stays consistent
  const duration = Math.max(25, items.length * 8);

  return (
    <div
      style={{
        position:   'sticky',
        top:        96,     // header (≈54px) + TabNav (42px)
        zIndex:     39,     // below TabNav (40)
        height:     32,
        overflow:   'hidden',
        background: '#060a10',
        borderBottom: '1px solid #131920',
        display:    'flex',
        alignItems: 'center',
      }}
    >
      {/* Scrolling inner track */}
      <div
        style={{
          display:   'inline-flex',
          alignItems:'center',
          width:     'max-content',
          animation: `ticker-scroll ${duration}s linear infinite`,
        }}
      >
        {doubled.map((asset, i) => (
          <TickerItem
            key={`${asset.ticker}-${i}`}
            asset={asset}
            isFirst={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
