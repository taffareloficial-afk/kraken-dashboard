import { X, TrendingUp, TrendingDown, DollarSign, BarChart2, Target, Calendar } from 'lucide-react';
import { CATEGORY_COLORS, KRAKEN_MODEL } from '../constants';
import { calcPMData } from '../utils/portfolio';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = v =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const fmtDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color, sub }) {
  return (
    <div
      style={{
        background: '#161b22',
        borderRadius: 10,
        padding: '12px 14px',
        border: '1px solid #21262d',
      }}
    >
      <p className="text-xs" style={{ color: '#484f58', marginBottom: 4 }}>{label}</p>
      <p className="mono font-semibold text-sm" style={{ color: color ?? '#e6edf3' }}>{value}</p>
      {sub && <p className="text-xs mono" style={{ color: '#484f58', marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ── Dividend history row ──────────────────────────────────────────────────────
function DividendRow({ row, isLast }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '1px solid #161b22',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#0d2c1a',
            color: '#3fb950',
            border: '1px solid #1a4731',
          }}
        >
          {row.tipo}
        </span>
        <span className="mono text-xs" style={{ color: '#8b949e' }}>
          ex {fmtDate(row.dataEx)}
        </span>
      </div>
      <span className="mono text-xs font-semibold" style={{ color: '#3fb950' }}>
        {fmtBRL(row.valor)}/cota
      </span>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function AssetDrawer({ asset, lancamentos, proventosRows, onClose }) {
  if (!asset) return null;

  const catColor = CATEGORY_COLORS[asset.type] ?? '#8b949e';
  const positive = asset.changePercent >= 0;
  const target   = KRAKEN_MODEL[asset.type] ?? null;

  // ── Compute average cost (PM com reset ao zerar posição) ──────────────
  const pmData     = calcPMData(lancamentos ?? []);
  const tickerPM   = pmData[asset.ticker];
  const avgCost    = tickerPM?.pm ?? null;
  const totalReturn = avgCost != null && asset.price > 0
    ? ((asset.price - avgCost) / avgCost) * 100
    : null;

  // ── Filter dividend history for this ticker ────────────────────────────
  const dividends = (proventosRows ?? [])
    .filter(r => r.ticker === asset.ticker && !r.isProjected)
    .sort((a, b) => (b.dataEx ?? '').localeCompare(a.dataEx ?? ''))
    .slice(0, 8);

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 200,
        }}
      />

      {/* Drawer panel */}
      <div
        className="asset-drawer"
        style={{
          position: 'fixed',
          background: '#0d1117',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #21262d',
            position: 'sticky',
            top: 0,
            background: '#0d1117',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="mono font-bold"
              style={{ fontSize: 20, color: '#e6edf3', letterSpacing: '-0.5px' }}
            >
              {asset.ticker}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 5,
                background: catColor + '18',
                color: catColor,
              }}
            >
              {asset.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn-inline"
            style={{
              background: 'transparent',
              border: '1px solid #21262d',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: 'pointer',
              color: '#8b949e',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Name */}
          {asset.name && (
            <p className="text-sm" style={{ color: '#8b949e', marginBottom: -8 }}>
              {asset.name}
            </p>
          )}

          {/* Price hero */}
          <div>
            <p
              className="mono font-bold"
              style={{ fontSize: '1.9rem', color: '#e6edf3', letterSpacing: '-1px', lineHeight: 1.1 }}
            >
              {fmtBRL(asset.price)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {positive
                ? <TrendingUp size={14} color="#3fb950" />
                : <TrendingDown size={14} color="#f85149" />
              }
              <span
                className="mono text-sm font-semibold"
                style={{ color: positive ? '#3fb950' : '#f85149' }}
              >
                {fmtPct(asset.changePercent)}
              </span>
              <span className="mono text-sm" style={{ color: positive ? '#3fb95066' : '#f8514966' }}>
                ({positive ? '+' : ''}{fmtBRL(asset.change)}) hoje
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stat
              label="Cotas"
              value={asset.shares.toLocaleString('pt-BR')}
              color="#c9d1d9"
            />
            <Stat
              label="Total investido"
              value={fmtBRL(asset.totalValue)}
              color="#e6edf3"
            />
            {avgCost !== null && (
              <Stat
                label="PM médio"
                value={fmtBRL(avgCost)}
                color="#8b949e"
              />
            )}
            {totalReturn !== null && (
              <Stat
                label="Retorno total"
                value={fmtPct(totalReturn)}
                color={totalReturn >= 0 ? '#3fb950' : '#f85149'}
                sub={totalReturn >= 0 ? '↑ desde a compra' : '↓ desde a compra'}
              />
            )}
          </div>

          {/* Allocation vs model */}
          {target !== null && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#484f58' }}>
                <Target size={10} style={{ display: 'inline', marginRight: 5 }} />
                Alocação vs modelo
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    background: '#161b22',
                    borderRadius: 99,
                    height: 8,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min((asset.totalValue / (asset.totalValue / (asset.changePercent / 100 + 1) * 0 + asset.totalValue)) * 100, 100)}%`,
                      background: catColor,
                      height: '100%',
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span className="mono text-xs" style={{ color: catColor, minWidth: 36 }}>
                  {target}% meta
                </span>
              </div>
            </div>
          )}

          {/* Dividend history */}
          {dividends.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Calendar size={12} color="#484f58" />
                <p className="text-xs font-medium" style={{ color: '#484f58' }}>
                  Histórico de proventos
                </p>
              </div>
              <div
                style={{
                  background: '#0a0e14',
                  borderRadius: 10,
                  padding: '4px 14px',
                  border: '1px solid #1a1f27',
                }}
              >
                {dividends.map((row, i) => (
                  <DividendRow
                    key={`${row.dataEx}-${i}`}
                    row={row}
                    isLast={i === dividends.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No dividend data fallback */}
          {dividends.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 0',
                color: '#484f58',
                fontSize: 13,
              }}
            >
              <DollarSign size={20} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
              <p>Sem histórico de proventos confirmados</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
