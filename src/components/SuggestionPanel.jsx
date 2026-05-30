import { useState } from 'react';
import { Lightbulb, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { KRAKEN_MODEL, CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { calcSplit } from '../utils/portfolio';

const fmtBRL = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// Suggested assets for categories without portfolio positions
const TICKER_MAP = {
  'Ações':      ['BBSE3', 'VALE3', 'ITUB4'],
  'FIIs':       ['TRXF11', 'HGLG11', 'VISC11'],
  'ETFs':       ['BOVA11', 'IVVB11', 'SMAL11'],
  'Renda Fixa': ['Tesouro Selic', 'CDB 100% CDI'],
  'Cripto':     ['BTC', 'ETH'],
};

/**
 * For a given category + suggested R$ amount:
 * - If user has assets in that category → distribute proportionally + compute quantities
 * - Otherwise → show ticker suggestions
 */
function getQuantitySuggestions(cat, suggestedAmount, assets) {
  const catAssets = (assets ?? []).filter(a => a.type === cat && a.price > 0 && a.shares > 0);
  if (catAssets.length === 0) return null;

  const totalCatValue = catAssets.reduce((s, a) => s + a.totalValue, 0);

  return catAssets.map(asset => {
    const share      = totalCatValue > 0 ? asset.totalValue / totalCatValue : 1 / catAssets.length;
    const allocValue = suggestedAmount * share;
    const qty        = Math.floor(allocValue / asset.price);
    const actual     = qty * asset.price;
    return { ticker: asset.ticker, price: asset.price, qty, actual };
  }).filter(x => x.qty > 0);
}

// ── Quick preset buttons ──────────────────────────────────────────────────────
const PRESETS = [500, 1000, 2000, 5000];

// ── Sub-components ────────────────────────────────────────────────────────────
function PresetBtn({ value, active, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      className="btn-inline text-xs px-2 py-1 rounded transition-colors"
      style={{
        background: active ? '#3b82f620' : 'transparent',
        color:      active ? '#3b82f6'   : '#484f58',
        border:     `1px solid ${active ? '#3b82f640' : '#21262d'}`,
        cursor:     'pointer',
        minHeight:  'unset',
      }}
    >
      {value >= 1000 ? `${value / 1000}k` : value}
    </button>
  );
}

// ── New-allocation mini-table ─────────────────────────────────────────────────
function NewAllocationTable({ suggestions, currentAllocation, categoryValues, totalValue, contribution }) {
  const newTotal = totalValue + contribution;
  if (newTotal <= 0) return null;

  const rows = Object.keys(KRAKEN_MODEL).map(cat => {
    const sug      = suggestions.find(s => s.cat === cat);
    const oldPct   = currentAllocation[cat] ?? 0;
    const oldVal   = categoryValues[cat] ?? 0;
    const addedVal = sug?.suggested ?? 0;
    const newVal   = oldVal + addedVal;
    const newPct   = (newVal / newTotal) * 100;
    const diff     = newPct - oldPct;
    const target   = KRAKEN_MODEL[cat];
    const color    = CATEGORY_COLORS[cat];
    return { cat, oldPct, newPct, diff, target, color };
  });

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #1a1f27', paddingTop: 14 }}>
      <p className="text-xs font-medium mb-2" style={{ color: '#484f58' }}>
        Nova alocação estimada após o aporte:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Category */}
            <span style={{ fontSize: 11, color: '#8b949e', width: 82, flexShrink: 0 }}>
              {CATEGORY_ICONS[r.cat]} {r.cat}
            </span>

            {/* Bar (new) */}
            <div
              style={{
                flex: 1, background: '#161b22',
                borderRadius: 99, height: 5, overflow: 'hidden', position: 'relative',
              }}
            >
              {/* Target marker */}
              <div
                style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${Math.min(r.target, 100)}%`,
                  width: 1, background: '#e6edf330', transform: 'translateX(-50%)',
                }}
              />
              <div
                style={{
                  width: `${Math.min(r.newPct, 100)}%`,
                  height: '100%', background: r.color,
                  borderRadius: 99, transition: 'width 0.6s ease',
                }}
              />
            </div>

            {/* Old → New */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>
                {r.oldPct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 10, color: '#30363d' }}>→</span>
              <span
                className="mono font-semibold"
                style={{ fontSize: 10, color: r.color, minWidth: 34, textAlign: 'right' }}
              >
                {r.newPct.toFixed(1)}%
              </span>
              {r.diff !== 0 && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9, color: r.diff > 0 ? '#3fb95080' : '#f8514980',
                    minWidth: 32, textAlign: 'right',
                  }}
                >
                  ({r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SuggestionPanel({ currentAllocation, categoryValues, totalValue, assets }) {
  const [contribution, setContribution] = useState(1000);

  const suggestions = calcSplit(currentAllocation, categoryValues, totalValue, contribution);
  const priority    = suggestions[0];

  return (
    <div className="card fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={13} color="#f59e0b" />
        <h2 className="text-sm font-medium" style={{ color: '#8b949e' }}>
          Simulador de aporte
        </h2>
      </div>

      {/* Contribution input */}
      <div
        className="flex items-center gap-3 p-2.5 rounded-lg mb-4"
        style={{ background: '#0a0e14', border: '1px solid #1a1f27' }}
      >
        <span className="text-xs font-medium" style={{ color: '#8b949e', whiteSpace: 'nowrap' }}>
          Quanto vou aportar
        </span>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs" style={{ color: '#8b949e' }}>R$</span>
          <input
            type="number"
            min={0}
            step={100}
            value={contribution}
            onChange={e => setContribution(Math.max(0, Number(e.target.value)))}
            className="flex-1 bg-transparent mono font-semibold text-sm outline-none"
            style={{ color: '#e6edf3', maxWidth: 120, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div className="flex gap-1">
          {PRESETS.map(v => (
            <PresetBtn
              key={v}
              value={v}
              active={contribution === v}
              onClick={setContribution}
            />
          ))}
        </div>
      </div>

      {/* Priority callout */}
      {priority && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg mb-4"
          style={{
            background: `${CATEGORY_COLORS[priority.cat]}10`,
            border:     `1px solid ${CATEGORY_COLORS[priority.cat]}30`,
          }}
        >
          <span className="text-2xl">{CATEGORY_ICONS[priority.cat]}</span>
          <div className="flex-1">
            <p className="text-xs font-medium mb-0.5" style={{ color: '#484f58' }}>
              Prioridade máxima
            </p>
            <p className="text-sm font-bold" style={{ color: CATEGORY_COLORS[priority.cat] }}>
              Aportar em {priority.cat}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
              Déficit de <span className="mono">{(priority.target - priority.currentPct).toFixed(1)}pp</span>
              {' · '}Sugestão: <span className="mono font-semibold">{fmtBRL(priority.suggested)}</span>
            </p>
          </div>
          <ArrowRight size={16} color={CATEGORY_COLORS[priority.cat]} />
        </div>
      )}

      {/* Full split — category rows with quantity breakdown */}
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#8b949e' }}>
            Carteira balanceada — qualquer categoria está ok para aportar.
          </p>
        ) : (
          suggestions.map(s => {
            const color       = CATEGORY_COLORS[s.cat];
            const qtyList     = getQuantitySuggestions(s.cat, s.suggested, assets);
            const fallbackTkrs = TICKER_MAP[s.cat] ?? [];

            return (
              <div key={s.cat}>
                <div className="flex items-center gap-3">
                  {/* Category label */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: 100 }}>
                    <span className="text-sm">{CATEGORY_ICONS[s.cat]}</span>
                    <span className="text-xs font-medium" style={{ color: '#c9d1d9' }}>{s.cat}</span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 progress-bar-bg h-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(s.splitPct, 100)}%`, background: color }}
                    />
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0" style={{ minWidth: 80 }}>
                    <p className="text-sm mono font-semibold" style={{ color }}>{fmtBRL(s.suggested)}</p>
                    <p className="text-xs mono" style={{ color: '#484f58' }}>
                      {s.splitPct.toFixed(0)}% do aporte
                    </p>
                  </div>
                </div>

                {/* Quantity breakdown */}
                {qtyList && qtyList.length > 0 ? (
                  <div style={{ marginTop: 6, paddingLeft: 108 }}>
                    {qtyList.map(q => (
                      <div
                        key={q.ticker}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, marginBottom: 3,
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            background: color + '15', color, border: `1px solid ${color}30`,
                            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                          }}
                        >
                          {q.ticker}
                        </span>
                        <span style={{ color: '#484f58' }}>
                          {q.qty} {q.qty === 1 ? 'cota' : 'cotas'}
                          {' × '}<span className="mono">{fmtBRL(q.price)}</span>
                          {' = '}<span className="mono" style={{ color: '#8b949e' }}>{fmtBRL(q.actual)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 5, paddingLeft: 108 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {fallbackTkrs.slice(0, 3).map(t => (
                        <span
                          key={t}
                          className="text-xs mono"
                          style={{
                            background: color + '15', color, border: `1px solid ${color}30`,
                            padding: '1px 7px', borderRadius: 4, fontSize: 10,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                      <span style={{ fontSize: 10, color: '#484f58', alignSelf: 'center' }}>
                        → compre via corretora
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New allocation table */}
      {suggestions.length > 0 && totalValue > 0 && (
        <NewAllocationTable
          suggestions={suggestions}
          currentAllocation={currentAllocation}
          categoryValues={categoryValues}
          totalValue={totalValue}
          contribution={contribution}
        />
      )}
    </div>
  );
}
