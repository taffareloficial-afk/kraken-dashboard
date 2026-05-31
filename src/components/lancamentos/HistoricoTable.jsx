import React, { useState, useMemo } from 'react';
import { Trash2, Filter, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { classifyTicker } from '../../utils/assetClass';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtBRL = v =>
  (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = d => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// ── Asset class classification (lógica única compartilhada) ─────────────────────
const getTickerClass = (ticker, assetType) => ticker ? classifyTicker(ticker, assetType) : null;

const ASSET_CLASS_CFG = {
  'FII': { label: 'FII', bg: '#2d1a3d', color: '#a78bfa', border: '#6d28d9' },
  'Ação': { label: 'Ação', bg: '#0d1e2e', color: '#3b82f6', border: '#1e3a5f' },
  'Cripto': { label: 'Cripto', bg: '#2c1f06', color: '#f59e0b', border: '#6e4c1a' },
  'Renda Fixa': { label: 'Renda Fixa', bg: '#0d2c1a', color: '#3fb950', border: '#1a4731' },
  'ETF': { label: 'ETF', bg: '#2c2a06', color: '#fbbf24', border: '#78350f' },
};

function getAssetClassConfig(assetClass) {
  return ASSET_CLASS_CFG[assetClass] ||
    { label: assetClass || '—', bg: '#161b22', color: '#8b949e', border: '#21262d' };
}

function AssetClassBadge({ assetClass }) {
  const cfg = getAssetClassConfig(assetClass);
  return (
    <span style={{
      display: 'inline-block',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 6, fontSize: 11, fontWeight: 700,
      padding: '2px 9px', whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {cfg.label}
    </span>
  );
}

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CFG = {
  compra:      { label: 'Compra',      bg: '#0d2c1a', color: '#3fb950', border: '#1a4731' },
  venda:       { label: 'Venda',       bg: '#2d1215', color: '#f85149', border: '#6e1c1f' },
  dividendo:   { label: 'Dividendo',   bg: '#2c1f06', color: '#f59e0b', border: '#6e4c1a' },
  jcp:         { label: 'JCP',         bg: '#1a1a2e', color: '#8b5cf6', border: '#3d2a7a' },
  jscp:        { label: 'JSCP',        bg: '#1e1233', color: '#a855f7', border: '#4c2a6e' },
  rendimento:  { label: 'Rendimento',  bg: '#0d1e2e', color: '#3b82f6', border: '#1e3a5f' },
  amortização: { label: 'Amortiz.',    bg: '#1a1a2e', color: '#8b5cf6', border: '#3d2a7a' },
  restituição: { label: 'Restituição', bg: '#0d1e2e', color: '#3b82f6', border: '#1e3a5f' },
};

function typeCfg(type) {
  return TYPE_CFG[type?.toLowerCase()] ??
    { label: type ?? '—', bg: '#161b22', color: '#8b949e', border: '#21262d' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ type }) {
  const t = typeCfg(type);
  return (
    <span style={{
      display: 'inline-block',
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
      borderRadius: 6, fontSize: 11, fontWeight: 700,
      padding: '2px 9px', whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {t.label}
    </span>
  );
}

function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 11, color: '#8b949e' }}>Remover?</span>
      <button
        className="btn-inline"
        onClick={onConfirm}
        style={{
          padding: '3px 11px', borderRadius: 6,
          background: '#2d1215', border: '1px solid #6e1c1f',
          color: '#f85149', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Sim
      </button>
      <button
        className="btn-inline"
        onClick={onCancel}
        style={{
          padding: '3px 9px', borderRadius: 6,
          background: 'transparent', border: '1px solid #21262d',
          color: '#484f58', fontSize: 11, cursor: 'pointer',
        }}
      >
        Não
      </button>
    </div>
  );
}

function ExpandedDetails({ l }) {
  const isOp = l.category === 'operacao';
  const pairs = isOp
    ? [
        l.assetType ? ['Tipo de ativo', l.assetType]                              : null,
        ['Quantidade',    `${(+l.quantity).toLocaleString('pt-BR')} cotas`],
        ['Preço unit.',   fmtBRL(+l.price)],
        l.otherCosts > 0 ? ['Outros custos', fmtBRL(+l.otherCosts)]              : null,
        ['Total',         fmtBRL(+(l.total ?? l.price * l.quantity))],
        l.notes          ? ['Notas', l.notes]                                     : null,
      ].filter(Boolean)
    : [
        ['Categoria',       'Provento'],
        ['Sub-tipo',        l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : '—'],
        ['Valor recebido',  fmtBRL(+l.amount)],
      ];

  return (
    <div style={{
      margin: '2px 14px 10px',
      padding: '12px 18px',
      background: '#080c11',
      border: '1px solid #21262d',
      borderRadius: 8,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px 32px',
    }}>
      {pairs.map(([lbl, val]) => (
        <div key={lbl}>
          <p style={{ fontSize: 10, color: '#484f58', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, margin: '0 0 3px' }}>
            {lbl}
          </p>
          <p style={{ fontSize: 13, color: '#c9d1d9', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
            {val}
          </p>
        </div>
      ))}
      {l.autoLogged && (
        <div style={{ width: '100%', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#8b5cf6', background: '#1a1a2e', border: '1px solid #3d2a7a', borderRadius: 5, padding: '2px 8px' }}>
            ✦ Registrado automaticamente pelo sistema
          </span>
        </div>
      )}
      <div style={{ width: '100%', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#30363d', fontFamily: 'JetBrains Mono, monospace' }}>
          {l.id}
          {l.createdAt ? ` · criado em ${new Date(l.createdAt).toLocaleString('pt-BR')}` : ''}
          {l.updatedAt ? ` · editado em ${new Date(l.updatedAt).toLocaleString('pt-BR')}` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SEL_STYLE = {
  background: '#0d1117',
  border: '1px solid var(--c-b1)',
  borderRadius: 8, color: '#8b949e',
  padding: '6px 10px', fontSize: 12,
  cursor: 'pointer', height: 34,
};

const DATE_STYLE = {
  ...SEL_STYLE,
  fontFamily: 'JetBrains Mono, monospace',
  colorScheme: 'dark', width: 132,
};

const ICON_BTN = {
  background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '5px 6px',
  borderRadius: 6, color: '#484f58',
  display: 'flex', alignItems: 'center',
  transition: 'all 0.12s',
};

const TH_STYLE = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700,
  color: '#484f58', textTransform: 'uppercase',
  letterSpacing: '0.07em', whiteSpace: 'nowrap',
  background: 'transparent',
};

const TD_STYLE = {
  padding: '13px 14px',
  borderBottom: '1px solid #191e26',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoricoTable({ lancamentos, onRemove, onEdit }) {
  const [filterType,   setFilterType]   = useState('todos');
  const [filterClass,  setFilterClass]  = useState('todos');
  const [filterTicker, setFilterTicker] = useState('todos');
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [expandedId,   setExpandedId]   = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);

  // Collect unique tickers
  const tickers = useMemo(() => {
    const s = new Set(lancamentos.map(l => l.ticker).filter(Boolean));
    return ['todos', ...Array.from(s).sort()];
  }, [lancamentos]);

  // Collect unique asset classes
  const assetClasses = useMemo(() => {
    const s = new Set(
      lancamentos
        .map(l => getTickerClass(l.ticker, l.assetType))
        .filter(Boolean)
    );
    return ['todos', ...Array.from(s).sort()];
  }, [lancamentos]);

  // Sort + filter
  const filtered = useMemo(() =>
    [...lancamentos]
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .filter(l => {
        if (filterType   !== 'todos' && l.type?.toLowerCase() !== filterType) return false;
        if (filterClass  !== 'todos' && getTickerClass(l.ticker, l.assetType) !== filterClass) return false;
        if (filterTicker !== 'todos' && l.ticker !== filterTicker)            return false;
        if (filterFrom && l.date < filterFrom)                                return false;
        if (filterTo   && l.date > filterTo)                                  return false;
        return true;
      }),
    [lancamentos, filterType, filterClass, filterTicker, filterFrom, filterTo]);

  const hasFilters = filterType !== 'todos' || filterClass !== 'todos' || filterTicker !== 'todos' || filterFrom || filterTo;

  const clearFilters = () => {
    setFilterType('todos');
    setFilterClass('todos');
    setFilterTicker('todos');
    setFilterFrom('');
    setFilterTo('');
  };

  return (
    <div className="card fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color="var(--c-tx4)" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', margin: 0 }}>
              Histórico de Lançamentos
            </h2>
            <span style={{
              background: '#161b22', color: '#8b949e',
              border: '1px solid var(--c-b1)', borderRadius: 6,
              fontSize: 11, padding: '1px 7px',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {filtered.length}
            </span>
            {hasFilters && (
              <span style={{
                fontSize: 11, color: '#f59e0b',
                background: '#2c1f06', border: '1px solid #6e4c1a',
                borderRadius: 5, padding: '1px 7px',
              }}>
                filtrado
              </span>
            )}
          </div>

          {hasFilters && (
            <button
              className="btn-inline"
              onClick={clearFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'transparent', border: '1px solid #21262d', color: '#8b949e', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f85149'; e.currentTarget.style.color = '#f85149'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#8b949e'; }}
            >
              <X size={11} />
              Limpar filtros
            </button>
          )}
        </div>

        {/* ── Filter row ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Type */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={SEL_STYLE}>
            <option value="todos">Todos os tipos</option>
            <option value="compra">Compra</option>
            <option value="venda">Venda</option>
            <option value="dividendo">Dividendo</option>
            <option value="jcp">JCP</option>
            <option value="jscp">JSCP</option>
            <option value="rendimento">Rendimento</option>
          </select>

          {/* Asset Class */}
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={SEL_STYLE}>
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>{ac === 'todos' ? 'Todas as classes' : ac}</option>
            ))}
          </select>

          {/* Ticker */}
          <select value={filterTicker} onChange={e => setFilterTicker(e.target.value)} style={SEL_STYLE}>
            {tickers.map(t => (
              <option key={t} value={t}>{t === 'todos' ? 'Todos os ativos' : t}</option>
            ))}
          </select>

          {/* Date from */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#484f58' }}>De</span>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              style={DATE_STYLE}
            />
          </div>

          {/* Date to */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#484f58' }}>até</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              style={DATE_STYLE}
            />
          </div>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 8 }}>
          <span style={{ fontSize: 32 }}>📋</span>
          <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>Nenhum lançamento encontrado</p>
          <p style={{ color: '#484f58', fontSize: 12, margin: 0 }}>
            {lancamentos.length === 0
              ? 'Use o botão + Adicionar Lançamento para começar'
              : 'Tente ajustar os filtros'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', margin: '0 -16px' }}>
          <table style={{
            width: '100%', borderCollapse: 'separate', borderSpacing: 0,
            fontSize: 13, minWidth: 500,
          }}>
            <thead>
              <tr>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Data</th>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Tipo</th>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Classe</th>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Ativo</th>
                <th className="hist-col-md-hide" style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Qtd / Valor</th>
                <th className="hist-col-lg-hide" style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Preço unit.</th>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d' }}>Total</th>
                <th style={{ ...TH_STYLE, borderBottom: '2px solid #21262d', width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const isOp       = l.category === 'operacao';
                const isExpanded = expandedId === l.id;
                const confirming = confirmId  === l.id;
                const isOdd      = i % 2 === 1;
                const rowBg      = isOdd ? '#0f141a' : 'transparent';

                // Total & color
                const totalVal   = isOp ? +(l.total ?? l.price * l.quantity) : +l.amount;
                const tc         = typeCfg(l.type);
                const totalColor = isOp
                  ? (l.type === 'compra' ? '#8b949e' : '#3fb950')  // compra=neutral, venda=green
                  : tc.color;                                        // provento=accent
                const prefix = (isOp && l.type !== 'compra') ? '+' : ''; // no sign for compra

                return (
                  <React.Fragment key={l.id}>
                    <tr
                      style={{ background: rowBg }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1c2128'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                    >
                      {/* Data */}
                      <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#c9d1d9' }}>
                          {fmtDate(l.date)}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td style={TD_STYLE}>
                        <Badge type={l.type} />
                      </td>

                      {/* Classe */}
                      <td style={TD_STYLE}>
                        <AssetClassBadge assetClass={getTickerClass(l.ticker, l.assetType)} />
                      </td>

                      {/* Ativo */}
                      <td style={TD_STYLE}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>
                          {l.ticker}
                        </span>
                        {l.assetName && l.assetName !== l.ticker && (
                          <span style={{ fontSize: 10, color: '#484f58', display: 'block', marginTop: 1 }}>
                            {l.assetName}
                          </span>
                        )}
                      </td>

                      {/* Qtd / Valor — hidden on mobile */}
                      <td className="hist-col-md-hide" style={TD_STYLE}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#8b949e' }}>
                          {isOp ? (+l.quantity).toLocaleString('pt-BR') : fmtBRL(+l.amount)}
                        </span>
                      </td>

                      {/* Preço unit. — hidden on mobile + tablet */}
                      <td className="hist-col-lg-hide" style={TD_STYLE}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#8b949e' }}>
                          {isOp ? fmtBRL(+l.price) : '—'}
                        </span>
                      </td>

                      {/* Total */}
                      <td style={{ ...TD_STYLE, whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700, fontSize: 14, color: totalColor,
                        }}>
                          {prefix}{fmtBRL(totalVal)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...TD_STYLE, textAlign: 'right', paddingRight: 16, whiteSpace: 'nowrap' }}>
                        {confirming ? (
                          <DeleteConfirm
                            onConfirm={() => {
                              onRemove(l.id);
                              setConfirmId(null);
                              if (expandedId === l.id) setExpandedId(null);
                            }}
                            onCancel={() => setConfirmId(null)}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                            {/* Expand / collapse */}
                            <button
                              className="btn-inline row-actions"
                              onClick={() => setExpandedId(isExpanded ? null : l.id)}
                              title={isExpanded ? 'Recolher' : 'Ver detalhes'}
                              style={ICON_BTN}
                              onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; e.currentTarget.style.color = '#c9d1d9'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484f58'; }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {/* Edit */}
                            <button
                              className="btn-inline row-actions"
                              onClick={() => onEdit && onEdit(l)}
                              title="Editar lançamento"
                              style={ICON_BTN}
                              onMouseEnter={e => { e.currentTarget.style.background = '#0d1e2e'; e.currentTarget.style.color = '#3b82f6'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484f58'; }}
                            >
                              <Pencil size={13} />
                            </button>

                            {/* Delete */}
                            <button
                              className="btn-inline row-actions"
                              onClick={() => setConfirmId(l.id)}
                              title="Remover lançamento"
                              style={ICON_BTN}
                              onMouseEnter={e => { e.currentTarget.style.background = '#2d1215'; e.currentTarget.style.color = '#f85149'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484f58'; }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr style={{ background: rowBg }}>
                        <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid #191e26' }}>
                          <ExpandedDetails l={l} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
