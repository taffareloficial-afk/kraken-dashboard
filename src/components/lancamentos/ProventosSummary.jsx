import { useState } from 'react';
import { TrendingUp, Calendar, Award } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants';

const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// Map ticker to its investment type (Ações, FIIs, ETFs, Renda Fixa, Cripto)
const TICKER_TYPES = {
  // Ações (sample - actual data comes from assets prop)
  'BBSE3': 'Ações', 'UNTP6': 'Ações', 'CPT511': 'Ações', 'IRDM11': 'Ações',
  'ITSA6': 'Ações', 'VALE3': 'Ações', 'HAPV3': 'Ações', 'CCIM3': 'Ações',
  'KLBN4': 'Ações', 'ENGI11': 'Ações', 'BRFS3': 'Ações', 'GOLL4': 'Ações',
  'MGLU3': 'Ações', 'RENT3': 'Ações', 'SIMH3': 'Ações', 'WEGE3': 'Ações',
  // FIIs
  'HGLG11': 'FIIs', 'TRXF11': 'FIIs', 'VISC11': 'FIIs', 'BRML11': 'FIIs',
  'MXRF11': 'FIIs', 'XPRD11': 'FIIs', 'KNRI11': 'FIIs', 'VGIP11': 'FIIs',
  // ETFs
  'BOVA11': 'ETFs', 'IVVB11': 'ETFs', 'SMAL11': 'ETFs', 'PIBB11': 'ETFs',
  // Cripto
  'BTC': 'Cripto', 'ETH': 'Cripto', 'SOL': 'Cripto', 'ADA': 'Cripto',
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-xl"
      style={{ background: '#161b22', border: '1px solid #21262d', flex: 1, minWidth: 130 }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} color={color} />
        <span className="text-xs" style={{ color: '#8b949e' }}>{label}</span>
      </div>
      <span className="mono font-bold text-lg" style={{ color, letterSpacing: '-0.5px' }}>
        {fmtBRL(value)}
      </span>
    </div>
  );
}

// Helper to get investment type for a ticker
function getTickerType(ticker, assets) {
  // Priority 1: Get type from assets array (most reliable)
  const asset = assets?.find(a => a.ticker === ticker);
  if (asset?.type) return asset.type;

  // Priority 2: Check if it's a known FII pattern (ends with 11)
  // FIIs in Brazil typically end with "11" (e.g., HGLG11, TRXF11, VISC11)
  if (ticker.endsWith('11') && /^[A-Z]+11$/.test(ticker)) {
    return 'FIIs';
  }

  // Priority 3: Check for known Renda Fixa patterns
  const upperTicker = ticker.toUpperCase();
  if (upperTicker.includes('CDB') ||
      upperTicker.includes('LCA') ||
      upperTicker.includes('LCI') ||
      upperTicker.includes('TESOURO') ||
      upperTicker.includes('SELIC') ||
      upperTicker.includes('IPCA')) {
    return 'Renda Fixa';
  }

  // Priority 4: Check TICKER_TYPES map
  if (TICKER_TYPES[ticker]) return TICKER_TYPES[ticker];

  // Priority 5: Infer from ticker pattern
  // Ações typically end in 3, 4, 5, 6, 7, 8, 9
  // ETFs sometimes end in 11 but we already filtered those above
  if (/[3456789]$/.test(ticker)) return 'Ações';

  // Cripto are usually short codes (BTC, ETH, SOL, etc)
  if (ticker.length <= 4) return 'Cripto';

  // Default to Ações for unknown stock-like patterns
  return 'Ações';
}

export default function ProventosSummary({ stats, assets = [] }) {
  const { totalMes, totalAno, totalGeral, totalPorAtivo } = stats;
  const [expandedSections, setExpandedSections] = useState(new Set(['Ações', 'FIIs', 'ETFs', 'Cripto', 'Renda Fixa']));

  // Categorize proventos by investment type
  const proventosByCategory = Object.entries(totalPorAtivo).reduce((acc, [ticker, value]) => {
    const type = getTickerType(ticker, assets);
    if (!acc[type]) acc[type] = [];
    acc[type].push({ ticker, value });
    return acc;
  }, {});

  // Calculate totals by category
  const categoryTotals = Object.entries(proventosByCategory).reduce((acc, [category, items]) => {
    acc[category] = items.reduce((s, item) => s + item.value, 0);
    return acc;
  }, {});

  const toggleSection = (category) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(category)) newSet.delete(category);
    else newSet.add(category);
    setExpandedSections(newSet);
  };

  const categories = ['Ações', 'FIIs', 'ETFs', 'Renda Fixa', 'Cripto'];
  const hasProventos = Object.keys(proventosByCategory).length > 0;

  return (
    <div className="card fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Award size={15} color="#f59e0b" />
        <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Resumo de Proventos</h2>
      </div>

      {/* Top stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard icon={Calendar} label="Mês atual"    value={totalMes}   color="#3b82f6" />
        <StatCard icon={TrendingUp} label="Ano atual"  value={totalAno}   color="#10b981" />
        <StatCard icon={Award}      label="Acumulado"  value={totalGeral} color="#f59e0b" />
      </div>

      {/* Categorized sections */}
      {hasProventos ? (
        <div style={{ marginTop: 20 }}>
          {categories.map((category) => {
            const items = proventosByCategory[category] || [];
            if (items.length === 0) return null;

            const categoryTotal = categoryTotals[category] || 0;
            const categoryColor = CATEGORY_COLORS[category] || '#8b949e';
            const categoryIcon = CATEGORY_ICONS[category] || '💰';
            const isExpanded = expandedSections.has(category);

            return (
              <div key={category} style={{ marginBottom: 16 }}>
                {/* Section header */}
                <div
                  onClick={() => toggleSection(category)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: categoryColor + '10',
                    border: `1px solid ${categoryColor}30`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = categoryColor + '18'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = categoryColor + '10'; }}
                >
                  <span style={{ fontSize: 16 }}>{categoryIcon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: categoryColor, margin: 0 }}>
                      {category}
                    </p>
                    <p style={{ fontSize: 11, color: '#8b949e', margin: '2px 0 0' }}>
                      {items.length} ativo{items.length !== 1 ? 's' : ''} • {fmtBRL(categoryTotal)}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, color: categoryColor, fontWeight: 600 }}>
                    {isExpanded ? '−' : '+'}
                  </span>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ marginTop: 8, paddingLeft: 8 }}>
                    {items
                      .sort((a, b) => b.value - a.value)
                      .map(({ ticker, value }) => {
                        const pct = categoryTotal > 0 ? (value / categoryTotal) * 100 : 0;
                        return (
                          <div key={ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            {/* Ticker badge */}
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: categoryColor,
                                background: categoryColor + '15',
                                border: `1px solid ${categoryColor}30`,
                                padding: '2px 6px',
                                borderRadius: 4,
                                width: 50,
                                textAlign: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {ticker}
                            </span>

                            {/* Progress bar */}
                            <div style={{ flex: 1, background: '#161b22', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  height: '100%',
                                  background: categoryColor,
                                  borderRadius: 4,
                                  transition: 'width 0.5s ease',
                                }}
                              />
                            </div>

                            {/* Value */}
                            <span
                              className="mono"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#3fb950',
                                textAlign: 'right',
                                minWidth: 65,
                              }}
                            >
                              {fmtBRL(value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-center mt-4 py-4" style={{ color: '#484f58' }}>
          Nenhum provento registrado ainda
        </p>
      )}
    </div>
  );
}
