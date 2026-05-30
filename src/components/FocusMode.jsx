import { useEffect } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import KrakenLogo from './KrakenLogo';

const fmt = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export default function FocusMode({ totalValue, dailyPnL, onClose }) {
  const pnlPos  = dailyPnL >= 0;
  const pnlBase = Math.max(totalValue - dailyPnL, 1);
  const pnlPct  = totalValue > 0 ? (dailyPnL / pnlBase) * 100 : 0;

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         500,
        background:     '#030712',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         'pointer',
        animation:      'focusFadeIn 300ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Radial glow behind the number */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          background:    'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(29,78,216,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ✕ close button — top-right corner */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Fechar (Esc)"
        style={{
          position:        'absolute',
          top:             20,
          right:           24,
          background:      'transparent',
          border:          '1px solid #21262d',
          borderRadius:    8,
          color:           '#484f58',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           36,
          height:          36,
          transition:      'background 200ms ease, color 200ms ease, border-color 200ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background    = '#161b22';
          e.currentTarget.style.color         = '#e6edf3';
          e.currentTarget.style.borderColor   = '#30363d';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background    = 'transparent';
          e.currentTarget.style.color         = '#484f58';
          e.currentTarget.style.borderColor   = '#21262d';
        }}
      >
        <X size={16} />
      </button>

      {/* Logo */}
      <KrakenLogo size={40} id="fm" />

      {/* Label */}
      <p
        style={{
          color:         '#484f58',
          fontSize:      11,
          marginTop:     16,
          marginBottom:  32,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight:    500,
        }}
      >
        Patrimônio Total
      </p>

      {/* Big mono value */}
      <p
        className="mono font-bold"
        style={{
          fontSize:           'clamp(2.4rem, 8vw, 5rem)',
          color:              '#e6edf3',
          letterSpacing:      '-2px',
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
          textAlign:          'center',
          padding:            '0 24px',
        }}
      >
        {fmt(totalValue)}
      </p>

      {/* Daily P&L */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
        {pnlPos
          ? <TrendingUp   size={18} color="#3fb950" />
          : <TrendingDown size={18} color="#f85149" />
        }
        <span
          className="mono"
          style={{
            color:              pnlPos ? '#3fb950' : '#f85149',
            fontSize:           '1.3rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pnlPos ? '+' : ''}{fmt(dailyPnL)}
          <span style={{ opacity: 0.55, fontSize: '1rem' }}>
            {' '}({pnlPos ? '+' : ''}{pnlPct.toFixed(2)}%)
          </span>
        </span>
      </div>

      {/* Exit hint */}
      <p
        style={{
          position:      'absolute',
          bottom:        32,
          color:         '#30363d',
          fontSize:      11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Clique em qualquer lugar ou Esc para sair
      </p>
    </div>
  );
}
