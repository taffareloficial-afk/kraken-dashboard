/**
 * AssetTable — Carteira tab.
 *
 * Features:
 *  - Category filter pills (Todos / Ações / FIIs / ETFs / Renda Fixa / Cripto)
 *  - View-mode toggle: flat list ↔ grouped by category
 *  - 8 columns: Ativo, Tipo, Qtd, Preço, Var. dia, 30d, % Cart., Total
 *  - Tablet (768-1023px): hides Tipo, Qtd, 30d, % Cart.
 *  - Mobile (<768px): card view
 */

import { useState, useMemo } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  LayoutList, Layers, ChevronDown, ChevronRight,
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { calcPMData } from '../utils/portfolio';
import { useSparklines } from '../hooks/useSparklines';
import Sparkline from './Sparkline';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_CATS  = ['Todos', 'Ações', 'FIIs', 'ETFs', 'Renda Fixa', 'Cripto'];
const CAT_ORDER = ['Ações', 'FIIs', 'ETFs', 'Renda Fixa', 'Cripto'];

const COLS = [
  { key: 'ticker',        label: 'Ativo',    align: 'left',   noSort: false, tabletHide: false },
  { key: 'type',          label: 'Tipo',     align: 'left',   noSort: false, tabletHide: true  },
  { key: 'shares',        label: 'Qtd',      align: 'right',  noSort: false, tabletHide: true  },
  { key: 'pm',            label: 'PM',       align: 'right',  noSort: true,  tabletHide: true  },
  { key: 'price',         label: 'Preço',    align: 'right',  noSort: false, tabletHide: false },
  { key: 'changePercent', label: 'Var. dia', align: 'right',  noSort: false, tabletHide: false },
  { key: 'sparkline',     label: '30d',      align: 'center', noSort: true,  tabletHide: true  },
  { key: 'allocPct',      label: '% Cart.',  align: 'right',  noSort: true,  tabletHide: true  },
  { key: 'totalValue',    label: 'Total',    align: 'right',  noSort: false, tabletHide: false },
];

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ArrowUpDown size={11} color="var(--c-tx5)" />;
  return sort.dir === 'asc'
    ? <ArrowUp   size={11} color="#3b82f6" />
    : <ArrowDown size={11} color="#3b82f6" />;
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {COLS.map((col, i) => (
        <td
          key={col.key}
          className={col.tabletHide ? 'col-tablet-hide' : ''}
          style={{ padding: '15px 16px', borderBottom: '1px solid var(--c-b3)' }}
        >
          <div className="skeleton rounded" style={{ height: 14, width: i === 0 ? 110 : 56 }} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0' }}>
      <div>
        <div className="skeleton rounded" style={{ width: 80,  height: 16, marginBottom: 6 }} />
        <div className="skeleton rounded" style={{ width: 130, height: 12 }} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="skeleton rounded" style={{ width: 80, height: 16, marginBottom: 6 }} />
        <div className="skeleton rounded" style={{ width: 52, height: 12 }} />
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, onSelect, sparkData, portfolioTotal, pm }) {
  const positive  = asset.changePercent >= 0;
  const catColor  = CATEGORY_COLORS[asset.type] ?? 'var(--c-tx3)';
  const allocPct  = portfolioTotal > 0 ? (asset.totalValue / portfolioTotal * 100) : 0;
  const pmReturn  = pm != null && asset.price > 0 ? (asset.price - pm) / pm * 100 : null;
  const pmPos     = pmReturn != null && pmReturn >= 0;

  return (
    <div
      onClick={() => onSelect?.(asset)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, padding: '13px 0',
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span className="mono font-bold" style={{ color: 'var(--c-tx1)', fontSize: 15 }}>
            {asset.ticker}
          </span>
          <span style={{
            background: catColor + '18', color: catColor,
            borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600,
          }}>
            {asset.type}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#484f58', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mono" style={{ color: 'var(--c-tx3)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtBRL(asset.price)}
          </span>
          <span>·</span>
          <span>{asset.shares.toLocaleString('pt-BR')} cotas</span>
          <span>·</span>
          <span>{allocPct.toFixed(1)}%</span>
          {pmReturn != null && (
            <>
              <span>·</span>
              <span className="mono" style={{ color: pmPos ? '#3fb950' : '#f85149', fontVariantNumeric: 'tabular-nums' }}>
                PM {fmtPct(pmReturn)}
              </span>
            </>
          )}
          {sparkData && (
            <Sparkline prices={sparkData} ticker={asset.ticker} positive={positive} width={48} height={20} />
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="mono font-semibold" style={{ color: 'var(--c-tx1)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {fmtBRL(asset.totalValue)}
        </div>
        <div className="mono" style={{ color: positive ? '#3fb950' : '#f85149', fontSize: 12, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {fmtPct(asset.changePercent)}
        </div>
      </div>
    </div>
  );
}

// ── Desktop asset row ─────────────────────────────────────────────────────────

function AssetRow({ asset, sparklines, portfolioTotal, isLast, onSelect, indent, pm }) {
  const positive = asset.changePercent >= 0;
  const catColor = CATEGORY_COLORS[asset.type] ?? 'var(--c-tx3)';
  const allocPct = portfolioTotal > 0 ? (asset.totalValue / portfolioTotal * 100) : 0;
  const rowBg    = indent ? '#080c11' : 'transparent';
  const border   = { borderBottom: isLast ? 'none' : '1px solid var(--c-b3)' };
  const pmReturn = pm != null && asset.price > 0 ? (asset.price - pm) / pm * 100 : null;
  const pmPos    = pmReturn != null && pmReturn >= 0;

  return (
    <tr
      onClick={() => onSelect?.(asset)}
      style={{ background: rowBg, transition: 'background 0.12s', cursor: onSelect ? 'pointer' : 'default' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f1318'; }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
    >
      {/* Ativo */}
      <td style={{ padding: '15px 16px', paddingLeft: indent ? 36 : 16, ...border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono font-semibold" style={{ color: 'var(--c-tx1)', fontSize: 14 }}>
                {asset.ticker}
              </span>
              <span className="row-actions" style={{
                fontSize: 10, color: '#3b82f6',
                background: '#1d4ed820', border: '1px solid #1d4ed840',
                borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap',
              }}>
                Ver →
              </span>
            </div>
            <div style={{ color: '#484f58', fontSize: 11, marginTop: 2 }}>{asset.name}</div>
          </div>
        </div>
      </td>

      {/* Tipo */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', ...border }}>
        <span style={{
          background: catColor + '18', color: catColor,
          borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 600,
        }}>
          {asset.type}
        </span>
      </td>

      {/* Qtd */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <span className="mono" style={{ color: 'var(--c-tx3)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {asset.shares.toLocaleString('pt-BR')}
        </span>
      </td>

      {/* PM */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        {pm != null ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="mono" style={{ color: 'var(--c-tx2)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(pm)}
            </span>
            {pmReturn != null && (
              <span className="mono" style={{ color: pmPos ? '#3fb950' : '#f85149', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                {fmtPct(pmReturn)}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: '#30363d', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* Preço */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <span className="mono" style={{ color: 'var(--c-tx2)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {fmtBRL(asset.price)}
        </span>
      </td>

      {/* Var. dia */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span className="mono font-semibold" style={{ color: positive ? '#3fb950' : '#f85149', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPct(asset.changePercent)}
          </span>
          <span className="mono" style={{ color: positive ? '#3fb95055' : '#f8514955', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {positive ? '+' : ''}{fmtBRL(asset.change)}
          </span>
        </div>
      </td>

      {/* Sparkline + 30d % */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', ...border }}>
        {(() => {
          const prices = sparklines[asset.ticker];
          // undefined = ainda carregando · null/insuficiente = resolvido sem dados
          if (prices === undefined) {
            return <div className="skeleton rounded" style={{ width: 80, height: 40 }} />;
          }
          if (!prices || prices.length < 2) {
            return <span style={{ color: 'var(--c-tx4)', fontSize: 12 }}>—</span>;
          }
          const change30d = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
          const pos30d    = change30d >= 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Sparkline prices={prices} ticker={asset.ticker} positive={pos30d} width={80} height={26} />
              <span
                className="mono"
                style={{
                  color: pos30d ? '#3fb950' : '#f85149',
                  fontSize: 11, fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtPct(change30d)}
              </span>
            </div>
          );
        })()}
      </td>

      {/* % Carteira */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="mono" style={{ color: 'var(--c-tx2)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {allocPct.toFixed(1)}%
          </span>
          <div style={{ width: 52, height: 3, background: '#161b22', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(allocPct * 2, 100)}%`, height: '100%', background: catColor, borderRadius: 2 }} />
          </div>
        </div>
      </td>

      {/* Total */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <span className="mono font-semibold" style={{ color: 'var(--c-tx1)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {fmtBRL(asset.totalValue)}
        </span>
      </td>
    </tr>
  );
}

// ── Category group header row (grouped mode) ──────────────────────────────────

function CategoryGroupHeader({ cat, assets, portfolioTotal, isExpanded, onToggle }) {
  const color      = CATEGORY_COLORS[cat] ?? 'var(--c-tx3)';
  const groupTotal = assets.reduce((s, a) => s + a.totalValue, 0);
  const groupAlloc = portfolioTotal > 0 ? (groupTotal / portfolioTotal * 100) : 0;
  const dailyDelta = assets.reduce((s, a) => s + (a.change ?? 0) * a.shares, 0);
  const prevTotal  = groupTotal - dailyDelta;
  const dailyPct   = prevTotal > 0 ? (dailyDelta / prevTotal * 100) : 0;
  const pos        = dailyDelta >= 0;

  return (
    <tr
      onClick={onToggle}
      style={{ cursor: 'pointer', background: '#0a0e14' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0c1116'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#0a0e14'; }}
    >
      <td
        colSpan={COLS.length}
        style={{
          padding: '11px 16px',
          borderTop: '2px solid #21262d',
          borderBottom: '1px solid var(--c-b1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isExpanded
            ? <ChevronDown  size={14} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
            : <ChevronRight size={14} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
          }
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-tx1)' }}>
            {CATEGORY_ICONS[cat]} {cat}
          </span>
          <span style={{
            fontSize: 11, color: '#484f58',
            background: '#161b22', borderRadius: 4, padding: '1px 6px',
          }}>
            {assets.length} {assets.length === 1 ? 'ativo' : 'ativos'}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className="mono" style={{ color: pos ? '#3fb950' : '#f85149', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {fmtPct(dailyPct)} hoje
            </span>
            <span className="mono font-semibold" style={{ color, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {groupAlloc.toFixed(1)}%
            </span>
            <span className="mono font-semibold" style={{ color: 'var(--c-tx1)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(groupTotal)}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssetTable({ assets, loading, onSelectAsset, lancamentos = [] }) {
  const [sort,           setSort]           = useState({ field: 'totalValue', dir: 'desc' });
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [viewMode,       setViewMode]       = useState('flat');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(CAT_ORDER));
  const sparklines = useSparklines(assets);

  const portfolioTotal = useMemo(
    () => assets.reduce((s, a) => s + a.totalValue, 0),
    [assets]
  );

  // PM (preço médio) por ticker — com reset ao zerar posição (calcPMData)
  const pmMap = useMemo(() => {
    const pmData = calcPMData(lancamentos);
    const result = {};
    for (const [ticker, d] of Object.entries(pmData)) {
      if (d.pm != null) result[ticker] = d.pm;
    }
    return result;
  }, [lancamentos]);

  const toggleSort = (field, noSort) => {
    if (noSort) return;
    setSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleGroup = (cat) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Filtered + sorted list
  const filteredSorted = useMemo(() => {
    const list = activeCategory === 'Todos'
      ? assets
      : assets.filter(a => a.type === activeCategory);
    return [...list].sort((a, b) => {
      const mul = sort.dir === 'asc' ? 1 : -1;
      const va  = a[sort.field] ?? 0;
      const vb  = b[sort.field] ?? 0;
      return typeof va === 'string' ? mul * va.localeCompare(vb) : mul * (va - vb);
    });
  }, [assets, activeCategory, sort]);

  // Grouped data (for grouped view)
  const groupedData = useMemo(() =>
    CAT_ORDER
      .map(cat => ({ cat, assets: filteredSorted.filter(a => a.type === cat) }))
      .filter(g => g.assets.length > 0),
    [filteredSorted]
  );

  // Only show filter pills for categories present in the portfolio
  const availableFilters = useMemo(() => {
    const present = new Set(assets.map(a => a.type));
    return ALL_CATS.filter(c => c === 'Todos' || present.has(c));
  }, [assets]);

  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
        padding: '16px 20px',
        borderBottom: '1px solid var(--c-b2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-tx3)' }}>Carteira</h2>
          {!loading && (
            <span style={{
              fontSize: 11, color: '#484f58',
              background: '#161b22', borderRadius: 4, padding: '2px 8px',
            }}>
              {assets.length} {assets.length === 1 ? 'ativo' : 'ativos'}
            </span>
          )}
        </div>

        {/* View-mode toggle */}
        <div style={{
          display: 'flex', gap: 2,
          background: '#161b22', borderRadius: 6, padding: 2,
          border: '1px solid var(--c-b1)',
        }}>
          {[
            { key: 'flat',    Icon: LayoutList, title: 'Lista plana'   },
            { key: 'grouped', Icon: Layers,     title: 'Por categoria' },
          ].map(({ key, Icon, title }) => {
            const active = viewMode === key;
            return (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className="btn-inline"
                title={title}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 26, borderRadius: 4, border: 'none',
                  background: active ? '#21262d' : 'transparent',
                  color:      active ? '#58a6ff'  : '#484f58',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category filter pills ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        padding: '10px 20px',
        borderBottom: '1px solid var(--c-b2)',
        background: '#080c11',
      }}>
        {availableFilters.map(cat => {
          const active = activeCategory === cat;
          const color  = cat === 'Todos' ? '#58a6ff' : (CATEGORY_COLORS[cat] ?? 'var(--c-tx3)');
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="btn-inline"
              style={{
                padding: '4px 12px', borderRadius: 20,
                fontSize: 11, fontWeight: active ? 700 : 500,
                background: active ? color + '22' : 'transparent',
                border:     `1px solid ${active ? color + '66' : '#21262d'}`,
                color:      active ? color : '#484f58',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {cat !== 'Todos' ? `${CATEGORY_ICONS[cat]} ` : ''}{cat}
            </button>
          );
        })}
      </div>

      {/* ── Mobile card view ──────────────────────────────────────────── */}
      <div className="mobile-asset-cards" style={{ padding: '0 20px' }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ borderBottom: i < 4 ? '1px solid var(--c-b3)' : 'none' }}>
                <SkeletonCard />
              </div>
            ))
          : filteredSorted.map((asset, i) => (
              <div
                key={asset.ticker}
                style={{ borderBottom: i < filteredSorted.length - 1 ? '1px solid var(--c-b3)' : 'none' }}
              >
                <AssetCard
                  asset={asset}
                  onSelect={onSelectAsset}
                  sparkData={sparklines[asset.ticker]}
                  portfolioTotal={portfolioTotal}
                  pm={pmMap[asset.ticker]}
                />
              </div>
            ))
        }
        {!loading && filteredSorted.length === 0 && (
          <p style={{ textAlign: 'center', padding: '32px 0', color: '#484f58', fontSize: 13 }}>
            Nenhum ativo nesta categoria.
          </p>
        )}
      </div>

      {/* ── Desktop table view ────────────────────────────────────────── */}
      <div className="desktop-asset-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key, col.noSort)}
                  className={col.tabletHide ? 'col-tablet-hide' : ''}
                  style={{
                    padding: '11px 16px',
                    textAlign: col.align,
                    fontSize: 11, fontWeight: 600,
                    color:  sort.field === col.key ? '#58a6ff' : '#484f58',
                    cursor: col.noSort ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--c-b1)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {!col.noSort && <SortIcon field={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Loading */}
          {loading && (
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          )}

          {/* Flat list */}
          {!loading && viewMode === 'flat' && (
            <tbody>
              {filteredSorted.map((asset, i) => (
                <AssetRow
                  key={asset.ticker}
                  asset={asset}
                  sparklines={sparklines}
                  portfolioTotal={portfolioTotal}
                  isLast={i === filteredSorted.length - 1}
                  onSelect={onSelectAsset}
                  indent={false}
                  pm={pmMap[asset.ticker]}
                />
              ))}
            </tbody>
          )}

          {/* Grouped by category */}
          {!loading && viewMode === 'grouped' && groupedData.map(({ cat, assets: grpAssets }) => (
            <tbody key={cat}>
              <CategoryGroupHeader
                cat={cat}
                assets={grpAssets}
                portfolioTotal={portfolioTotal}
                isExpanded={expandedGroups.has(cat)}
                onToggle={() => toggleGroup(cat)}
              />
              {expandedGroups.has(cat) && grpAssets.map((asset, i) => (
                <AssetRow
                  key={asset.ticker}
                  asset={asset}
                  sparklines={sparklines}
                  portfolioTotal={portfolioTotal}
                  isLast={i === grpAssets.length - 1}
                  onSelect={onSelectAsset}
                  indent
                  pm={pmMap[asset.ticker]}
                />
              ))}
            </tbody>
          ))}
        </table>

        {/* Empty state */}
        {!loading && filteredSorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#484f58', fontSize: 13 }}>
            Nenhum ativo para a categoria selecionada.
          </div>
        )}
      </div>
    </div>
  );
}
