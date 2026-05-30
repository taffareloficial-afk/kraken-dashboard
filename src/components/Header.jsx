import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Sun, Moon } from 'lucide-react';
import KrakenLogo from './KrakenLogo';

const fmtCurrency = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function useRelativeTime(lastUpdate) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!lastUpdate) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      if (secs < 8)        setLabel('agora');
      else if (secs < 120) setLabel(`há ${secs}s`);
      else                 setLabel(`há ${Math.floor(secs / 60)}m`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastUpdate]);
  return label;
}

export default function Header({
  lastUpdate, trading, onRefresh, loading,
  totalValue = 0, dailyPnL = 0,
  isDark, onToggleTheme,
  onLogoClick,  // navigate back to the Resumo tab
  syncNode,     // optional: <SyncBadge /> rendered before the theme toggle
}) {
  const relativeTime = useRelativeTime(lastUpdate);
  const syncInterval = trading ? '30s' : '5m';
  const pnlPct       = totalValue > 0 ? (dailyPnL / (totalValue - dailyPnL)) * 100 : 0;
  const pnlPositive  = dailyPnL >= 0;

  const btnBase = {
    background: 'transparent',
    border:     '1px solid var(--c-b1)',
    color:      'var(--c-tx3)',
    cursor:     'pointer',
    height:     32,
    borderRadius: 6,
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    padding:    '0 10px',
    fontSize:   12,
    transition: 'all 0.15s',
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background:     'var(--c-header-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom:   '1px solid var(--c-b1)',
      }}
    >
      {/* ── Main nav row ───────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between">
        {/* Logo — clicável para voltar ao Resumo */}
        <button
          onClick={onLogoClick}
          aria-label="Voltar para o Resumo"
          className="flex items-center gap-2.5"
          style={{
            background: 'transparent',
            border:     'none',
            padding:    0,
            cursor:     onLogoClick ? 'pointer' : 'default',
            textAlign:  'left',
          }}
        >
          <KrakenLogo size={36} id="hdr" />
          <div style={{ lineHeight: 1 }}>
            <h1
              style={{
                fontSize:      15,
                fontWeight:    700,
                color:         'var(--c-tx1)',
                letterSpacing: '-0.4px',
                marginBottom:  2,
              }}
            >
              Kraken
            </h1>
            <p
              style={{
                fontSize:      9.5,
                fontWeight:    500,
                color:         'var(--c-tx4)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Dashboard
            </p>
          </div>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--c-tx3)' }}>
          {/* Trading status */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full pulse-dot flex-shrink-0"
              style={{ background: trading ? '#3fb950' : 'var(--c-tx4)' }}
            />
            <span className="hidden sm:inline" style={{ color: trading ? 'var(--c-tx3)' : 'var(--c-tx4)' }}>
              {trading ? 'Pregão aberto' : 'Mercado fechado'}
            </span>
          </div>

          {/* Update info — desktop only */}
          <div className="desktop-only flex items-center gap-1" style={{ color: 'var(--c-tx4)' }}>
            <span>{relativeTime ? `Atualizado ${relativeTime}` : 'Carregando…'}</span>
            <span className="mx-1">·</span>
            <span>sync {syncInterval}</span>
          </div>

          {/* Cloud sync badge */}
          {syncNode}

          {/* Manual refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? 'Atualizando dados…' : 'Atualizar dados'}
            aria-busy={loading}
            className="btn-inline"
            style={{
              ...btnBase,
              color:  loading ? 'var(--c-tx5)' : 'var(--c-tx3)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = 'var(--c-tx2)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = loading ? 'var(--c-tx5)' : 'var(--c-tx3)'; }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* ── Theme toggle ─────────────────────────────────────────── */}
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
            aria-pressed={!isDark}
            className="btn-inline"
            style={{ ...btnBase, width: 32, padding: 0, justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = isDark ? '#f59e0b' : '#3b82f6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
          >
            {isDark
              ? <Sun  size={13} aria-hidden="true" />
              : <Moon size={13} aria-hidden="true" />
            }
          </button>
        </div>
      </div>

      {/* ── Mobile patrimônio strip ─────────────────────────────────────── */}
      {(totalValue > 0 || loading) && (
        <div
          className="mobile-only"
          style={{
            borderTop:      '1px solid var(--c-s2)',
            padding:        '7px 16px 8px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            12,
          }}
        >
          {loading ? (
            <div className="skeleton rounded" style={{ width: 140, height: 22 }} />
          ) : (
            <>
              <span
                className="mono font-bold"
                style={{ fontSize: '1.35rem', letterSpacing: '-1px', color: 'var(--c-tx1)', fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtCurrency(totalValue)}
              </span>

              <div className="flex items-center gap-1.5">
                {pnlPositive
                  ? <TrendingUp size={12} color="#3fb950" />
                  : <TrendingDown size={12} color="#f85149" />
                }
                <span
                  className="mono text-xs font-medium"
                  style={{ color: pnlPositive ? '#3fb950' : '#f85149', fontVariantNumeric: 'tabular-nums' }}
                >
                  {pnlPositive ? '+' : ''}{fmtCurrency(dailyPnL)}
                  <span style={{ opacity: 0.7 }}>
                    {' '}({pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Accent line — matches logo gradient */}
      <div style={{ height: 1.5, background: 'linear-gradient(90deg, #0047cc 0%, #0080ff 45%, #00c4ff 75%, transparent 100%)' }} />
    </header>
  );
}
