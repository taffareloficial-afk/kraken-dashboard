/**
 * ProventosProximos — Aba Proventos.
 *
 * - Tabs: Próximos (futuros) / Recentes (pagos)
 * - Barra lateral colorida de urgência por dias restantes
 * - Tabela completa no desktop, cards no mobile
 * - Zebra stripes + hover nas linhas
 * - Badges de tipo vibrantes
 */

import { useState } from 'react';
import {
  Calendar, RefreshCw, CheckCircle, Clock,
  TrendingUp, ChevronRight,
} from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtBRLTotal = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso + 'T12:00:00') - new Date()) / 86_400_000);
}

// Urgency config: color + label based on days to ex-date
function urgencyConfig(days) {
  if (days === null) return { color: '#484f58', label: 'Próximo',   bg: '#161b22' };
  if (days <= 0)    return { color: '#f85149', label: 'Hoje/venc.', bg: '#2d1215' };
  if (days <= 7)    return { color: '#f85149', label: `${days}d`,   bg: '#2d1215' };
  if (days <= 15)   return { color: '#f59e0b', label: `${days}d`,   bg: '#2c1f06' };
  if (days <= 30)   return { color: '#3fb950', label: `${days}d`,   bg: '#0d2c1a' };
  if (days <= 60)   return { color: '#3b82f6', label: `${days}d`,   bg: '#0d1e2e' };
  return              { color: '#484f58',   label: `${days}d`,   bg: '#161b22' };
}

// ── Tipo badge ────────────────────────────────────────────────────────────────

const TIPO_STYLES = {
  'Rendimento':  { bg: '#0d2c1a', color: '#3fb950', border: '#1a4731' },
  'Dividendo':   { bg: '#0d1e2e', color: '#58a6ff', border: '#1e3a5f' },
  'JCP':         { bg: '#1a1a2e', color: '#a78bfa', border: '#3d2a7a' },
  'Amortização': { bg: '#2c1f06', color: '#f59e0b', border: '#6e4c1a' },
};

function TipoBadge({ tipo }) {
  const s = TIPO_STYLES[tipo] ?? TIPO_STYLES['Rendimento'];
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 5, padding: '3px 9px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {tipo}
    </span>
  );
}

// ── Status cell ───────────────────────────────────────────────────────────────

function StatusBadge({ isProjected, dataEx, dataPagamento }) {
  // Aba Próximos: o provento ainda NÃO foi recebido (pagamento >= hoje).
  // A contagem é até a DATA DE PAGAMENTO — não a data-ex (que pode já ter
  // passado). Nunca rotular como "Confirmado/Pago" antes do pagamento.
  const refDate = dataPagamento || dataEx;
  const days = daysUntil(refDate);
  const { color, label } = urgencyConfig(days);

  const text =
    days === null ? 'A receber'
    : days <= 0   ? 'Recebe hoje'
    : days === 1  ? 'Recebe amanhã'
    : `a receber em ${label}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {isProjected
          ? <TrendingUp size={12} color={color} />
          : <Clock      size={12} color={color} />
        }
        <span style={{ fontSize: 12, fontWeight: 600, color }}>
          {text}
        </span>
      </div>
      {dataPagamento && (
        <span className="mono" style={{ fontSize: 10, color: '#484f58' }}>
          {isProjected ? 'est. pag. ' : 'pag. '}{fmtDate(dataPagamento)}
        </span>
      )}
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[120, 80, 40, 90, 80, 90, 80].map((w, i) => (
        <td key={i} style={{ padding: '15px 16px', borderBottom: '1px solid var(--c-b3)' }}>
          <div className="skeleton rounded" style={{ height: 14, width: w }} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-b3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="skeleton rounded" style={{ width: 80, height: 16 }} />
        <div className="skeleton rounded" style={{ width: 70, height: 16 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="skeleton rounded" style={{ width: 100, height: 12 }} />
        <div className="skeleton rounded" style={{ width: 70, height: 12 }} />
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function ProventoCard({ row, shares, recordedAmount, isLast }) {
  const days      = daysUntil(row.dataPagamento || row.dataEx);
  const urg       = urgencyConfig(days);
  const qty       = shares ?? 0;
  // Recentes: use real recorded amount when available; Próximos: estimate
  const displayValue = recordedAmount != null
    ? recordedAmount
    : (qty > 0 ? row.valor * qty : row.valor);
  const isReal = recordedAmount != null;

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--c-b3)',
      borderLeft: `3px solid ${urg.color}`,
      background: 'transparent',
    }}>
      {/* Row 1: ticker + total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono font-bold" style={{ color: '#e6edf3', fontSize: 15 }}>
            {row.ticker}
          </span>
          <TipoBadge tipo={row.tipo} />
          {!isReal && qty > 0 && (
            <span style={{ fontSize: 11, color: '#484f58' }}>{qty} cotas</span>
          )}
        </div>
        <span className="mono font-bold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {fmtBRL(displayValue)}
        </span>
      </div>

      {/* Row 2: dates + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={11} color="var(--c-tx4)" />
          <span className="mono" style={{ color: '#8b949e', fontSize: 12 }}>
            ex: {fmtDate(row.dataEx)}
          </span>
          {row.dataPagamento && (
            <>
              <span style={{ color: '#30363d', fontSize: 11 }}>·</span>
              <span className="mono" style={{ color: '#484f58', fontSize: 11 }}>
                pag: {fmtDate(row.dataPagamento)}
              </span>
            </>
          )}
        </div>
        <StatusBadge
          isProjected={row.isProjected}
          dataEx={row.dataEx}
          dataPagamento={row.dataPagamento}
        />
      </div>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function ProventoRow({ row, shares, recordedAmount, idx, isLast }) {
  const days    = daysUntil(row.dataPagamento || row.dataEx);
  const urg     = urgencyConfig(days);
  const zebraBg = idx % 2 === 1 ? '#080c11' : 'transparent';
  const border  = { borderBottom: isLast ? 'none' : '1px solid var(--c-b3)' };
  const qty     = shares ?? 0;
  // Recentes: use real recorded amount when available; Próximos: estimate from qty × valor
  const isReal       = recordedAmount != null;
  const displayValue = isReal ? recordedAmount : (qty > 0 ? row.valor * qty : null);

  return (
    <tr
      style={{ background: zebraBg, transition: 'background 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f1318'; }}
      onMouseLeave={e => { e.currentTarget.style.background = zebraBg; }}
    >
      {/* Urgency bar + Ativo */}
      <td style={{ padding: '15px 16px', position: 'relative', ...border }}>
        {/* Colored left bar — absolute so it doesn't affect cell padding */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: urg.color, borderRadius: '0 2px 2px 0',
        }} />
        <span className="mono font-semibold" style={{ color: '#e6edf3', fontSize: 14 }}>
          {row.ticker}
        </span>
      </td>

      {/* Tipo */}
      <td style={{ padding: '15px 16px', ...border }}>
        <TipoBadge tipo={row.tipo} />
      </td>

      {/* Qtd */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <span className="mono" style={{ color: qty > 0 ? '#c9d1d9' : '#30363d', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {qty > 0 ? qty.toLocaleString('pt-BR') : '—'}
        </span>
      </td>

      {/* Valor Est. / Valor Real */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        {isReal ? (
          /* Recentes — valor registrado no lançamento */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="mono font-semibold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(displayValue)}
            </span>
            <span style={{ fontSize: 9, color: '#3fb95066', fontWeight: 600, letterSpacing: '0.04em' }}>
              REGISTRADO
            </span>
          </div>
        ) : displayValue != null ? (
          /* Próximos — estimativa por qtd × R$/cota */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="mono font-semibold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(displayValue)}
            </span>
            <span className="mono" style={{ color: '#484f58', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(row.valor)}/cota
            </span>
          </div>
        ) : (
          <span className="mono font-semibold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {fmtBRL(row.valor)}
          </span>
        )}
      </td>

      {/* Data Ex */}
      <td style={{ padding: '15px 16px', ...border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
          <span className="mono" style={{ color: '#c9d1d9', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDate(row.dataEx)}
          </span>
        </div>
      </td>

      {/* Data Pagamento */}
      <td className="col-tablet-hide" style={{ padding: '15px 16px', ...border }}>
        {row.dataPagamento
          ? <span className="mono" style={{ color: '#8b949e', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {fmtDate(row.dataPagamento)}
            </span>
          : <span style={{ color: '#30363d' }}>—</span>
        }
      </td>

      {/* Status */}
      <td style={{ padding: '15px 16px', ...border }}>
        <StatusBadge
          isProjected={row.isProjected}
          dataEx={row.dataEx}
          dataPagamento={row.dataPagamento}
        />
      </td>
    </tr>
  );
}

// ── Recentes: card (mobile) ───────────────────────────────────────────────────

function RecentCard({ entry, isLast }) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--c-b3)',
      borderLeft: '3px solid #3fb950',
    }}>
      {/* Row 1: ticker + valor */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono font-bold" style={{ color: '#e6edf3', fontSize: 15 }}>
            {entry.ticker}
          </span>
          <TipoBadge tipo={entry.tipo} />
        </div>
        <span className="mono font-bold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {entry.value > 0 ? fmtBRL(entry.value) : '—'}
        </span>
      </div>
      {/* Row 2: data + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={11} color="var(--c-tx4)" />
          <span className="mono" style={{ color: '#8b949e', fontSize: 12 }}>
            {fmtDate(entry.date)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={12} color="#3fb950" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#3fb950' }}>Registrado</span>
        </div>
      </div>
    </div>
  );
}

// ── Recentes: row (desktop) ───────────────────────────────────────────────────

function RecentRow({ entry, idx, isLast }) {
  const zebraBg = idx % 2 === 1 ? '#080c11' : 'transparent';
  const border  = { borderBottom: isLast ? 'none' : '1px solid var(--c-b3)' };
  return (
    <tr
      style={{ background: zebraBg, transition: 'background 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f1318'; }}
      onMouseLeave={e => { e.currentTarget.style.background = zebraBg; }}
    >
      {/* Ativo */}
      <td style={{ padding: '15px 16px', position: 'relative', ...border }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: '#3fb950', borderRadius: '0 2px 2px 0',
        }} />
        <span className="mono font-semibold" style={{ color: '#e6edf3', fontSize: 14 }}>
          {entry.ticker}
        </span>
      </td>
      {/* Tipo */}
      <td style={{ padding: '15px 16px', ...border }}>
        <TipoBadge tipo={entry.tipo} />
      </td>
      {/* Qtd */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <span className="mono" style={{ color: entry.shares > 0 ? '#c9d1d9' : '#30363d', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {entry.shares > 0 ? entry.shares.toLocaleString('pt-BR') : '—'}
        </span>
      </td>
      {/* Valor Total */}
      <td style={{ padding: '15px 16px', textAlign: 'right', ...border }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span className="mono font-semibold" style={{ color: '#3fb950', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {entry.value > 0 ? fmtBRL(entry.value) : '—'}
          </span>
          <span style={{ fontSize: 9, color: '#3fb95066', fontWeight: 600, letterSpacing: '0.04em' }}>
            REGISTRADO
          </span>
        </div>
      </td>
      {/* Data / Pagamento — colSpan=2 ocupa as duas colunas anteriores */}
      <td colSpan={2} style={{ padding: '15px 16px', ...border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} color="var(--c-tx4)" style={{ flexShrink: 0 }} />
          <span className="mono" style={{ color: '#c9d1d9', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDate(entry.date)}
          </span>
        </div>
      </td>
      {/* Status */}
      <td style={{ padding: '15px 16px', ...border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={12} color="#3fb950" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#3fb950' }}>Registrado</span>
        </div>
      </td>
    </tr>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#484f58' }}>
      <Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
      <p style={{ fontSize: 13 }}>{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PERIODO_OPTIONS = [
  { key: 'todos',       label: 'Todos'        },
  { key: 'este_mes',    label: 'Este mês'     },
  { key: 'proximo_mes', label: 'Próximo mês'  },
  { key: '3m',          label: '3 meses'      },
  { key: '6m',          label: '6 meses'      },
  { key: '12m',         label: '12 meses'     },
];

function filterByPeriodo(rows, periodo) {
  if (periodo === 'todos') return rows;
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  return rows.filter(r => {
    const dateStr = r.dataPagamento || r.dataEx;
    if (!dateStr) return periodo === 'todos';
    const d = new Date(dateStr + 'T12:00:00');

    if (periodo === 'este_mes')
      return d.getFullYear() === year && d.getMonth() === month;

    if (periodo === 'proximo_mes') {
      const nm = new Date(year, month + 1, 1);
      return d.getFullYear() === nm.getFullYear() && d.getMonth() === nm.getMonth();
    }

    const months = periodo === '3m' ? 3 : periodo === '6m' ? 6 : 12;
    const limit  = new Date(year, month + months + 1, 0); // last day of target month
    return d >= now && d <= limit;
  });
}

export default function ProventosProximos({ rows, loading, error, lastFetch, refresh, adjustedPortfolio = [], lancamentos = [] }) {
  const [tab, setTab]             = useState('proximos'); // 'proximos' | 'recentes'
  const [periodo, setPeriodo]     = useState('todos');

  // ticker → number of shares the user currently holds
  const sharesMap = Object.fromEntries(
    adjustedPortfolio.map(a => [a.ticker, a.shares ?? 0])
  );

  // "Próximo" = pagamento ainda não ocorreu (pagamento >= hoje), independente
  // da data-ex já ter passado. Inclui proventos já-ex que ainda vão pagar e
  // exclui os já pagos. Fallback para data-ex quando não há data de pagamento.
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureRows = rows.filter(r =>
    r.dataPagamento ? r.dataPagamento >= todayStr : r.isFuture
  );

  // ── Recentes: lançamentos diretos — sem matching com calendário ───────────
  // Mostra todos os lançamentos do usuário com category='provento' e tipo
  // Dividendo / Rendimento / JCP / Amortização, dos últimos 12 meses.
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Capitaliza o tipo para exibição no TipoBadge (ProventoForm salva lowercase)
  const capType = t => {
    if (!t) return '—';
    const lc = t.toLowerCase();
    if (lc === 'jcp') return 'JCP';
    if (lc === 'amortização' || lc === 'amortizacao') return 'Amortização';
    return lc.charAt(0).toUpperCase() + lc.slice(1);
  };

  const recentLancamentos = lancamentos
    .filter(l =>
      l.category === 'provento' &&
      l.ticker &&
      l.date &&
      l.date >= cutoffStr
    )
    .map(l => ({
      ticker: l.ticker,
      tipo:   capType(l.type),
      date:   l.date,
      value:  Number(l.amount ?? l.total ?? l.price ?? 0),
      shares: sharesMap[l.ticker] ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredFutureRows = filterByPeriodo(futureRows, periodo);
  const activeRows = tab === 'proximos' ? filteredFutureRows : [];

  const totalEstimado = activeRows.reduce((sum, row) => {
    const qty = sharesMap[row.ticker] ?? 0;
    return sum + (qty > 0 ? row.valor * qty : row.valor);
  }, 0);

  const COLS = [
    { label: 'Ativo',      align: 'left',  tabletHide: false, width: '12%' },
    { label: 'Tipo',       align: 'left',  tabletHide: false, width: '14%' },
    { label: 'Qtd',        align: 'right', tabletHide: false, width:  '8%' },
    { label: 'Valor Est.', align: 'right', tabletHide: false, width: '16%' },
    { label: 'Data Ex',    align: 'left',  tabletHide: false, width: '14%' },
    { label: 'Pagamento',  align: 'left',  tabletHide: true,  width: '14%' },
    { label: 'Status',     align: 'left',  tabletHide: false, width: '22%' },
  ];

  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
        padding: '16px 20px',
        borderBottom: '1px solid var(--c-b2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color="#3b82f6" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>
            Proventos
          </h2>
          {!loading && futureRows.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: '#0d1e2e', color: '#58a6ff', border: '1px solid #1e3a5f',
              borderRadius: 5, padding: '2px 8px',
            }}>
              {futureRows.length} próximos
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastFetch && (
            <span style={{ fontSize: 11, color: '#484f58' }}>
              {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="btn-inline"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 7,
              background: '#161b22', border: '1px solid var(--c-b1)',
              color: '#8b949e', cursor: 'pointer', fontSize: 11,
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {!loading && <span>Atualizar</span>}
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--c-b2)',
        background: '#080c11',
        padding: '0 20px',
      }}>
        {[
          { key: 'proximos', label: 'Próximos', count: futureRows.length        },
          { key: 'recentes', label: 'Recentes', count: recentLancamentos.length },
        ].map(({ key, label, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="btn-inline"
              style={{
                padding: '10px 16px',
                fontSize: 12, fontWeight: active ? 600 : 400,
                color:   active ? '#e6edf3' : '#484f58',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
                cursor: 'pointer', transition: 'color 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: -1,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? '#1c3a5a' : '#161b22',
                  color: active ? '#58a6ff' : '#484f58',
                  border: `1px solid ${active ? '#3b82f640' : '#21262d'}`,
                  borderRadius: 4, padding: '1px 5px',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filtro de período (só na aba Próximos) ──────────────────────── */}
      {tab === 'proximos' && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
          padding: '10px 20px',
          borderBottom: '1px solid var(--c-b2)',
          background: 'var(--c-bg)',
        }}>
          {PERIODO_OPTIONS.map(opt => {
            const active = periodo === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setPeriodo(opt.key)}
                className="btn-inline"
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 11, fontWeight: active ? 700 : 400,
                  background: active ? '#1c3a5a' : 'var(--c-b2)',
                  color:      active ? '#58a6ff' : 'var(--c-tx3)',
                  border:     `1px solid ${active ? '#3b82f660' : 'var(--c-b1)'}`,
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: '12px 20px 0',
          padding: '8px 12px', borderRadius: 8,
          background: '#2d1215', border: '1px solid #6e1c1f', color: '#f85149',
          fontSize: 12,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Mobile card view ────────────────────────────────────────────── */}
      <div className="mobile-asset-cards">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : tab === 'proximos' ? (
          activeRows.length === 0
            ? <EmptyState label={periodo === 'todos' ? 'Nenhum provento futuro estimado no momento' : `Nenhum provento estimado para ${PERIODO_OPTIONS.find(o => o.key === periodo)?.label.toLowerCase()}`} />
            : activeRows.map((row, i) => (
                <ProventoCard
                  key={`${row.ticker}-${row.dataEx}-${i}`}
                  row={row}
                  shares={sharesMap[row.ticker]}
                  isLast={i === activeRows.length - 1}
                />
              ))
        ) : (
          recentLancamentos.length === 0
            ? <EmptyState label="Nenhum provento registrado nos últimos 12 meses" />
            : recentLancamentos.map((entry, i) => (
                <RecentCard
                  key={`${entry.ticker}-${entry.date}-${i}`}
                  entry={entry}
                  isLast={i === recentLancamentos.length - 1}
                />
              ))
        )}
      </div>

      {/* ── Desktop table view ──────────────────────────────────────────── */}
      <div className="desktop-asset-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <colgroup>
            {COLS.map((col, i) => (
              <col key={i} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map((col, i) => {
                // Recentes: merge "Data Ex" + "Pagamento" → uma coluna "Data / Pagamento"
                if (tab === 'recentes' && col.label === 'Pagamento') return null;

                let label   = col.label;
                let colSpan = 1;
                if (tab === 'recentes' && col.label === 'Data Ex') {
                  label   = 'Data / Pagamento';
                  colSpan = 2;
                }
                if (tab === 'recentes' && col.label === 'Valor Est.') label = 'Valor Total';

                return (
                  <th
                    key={i}
                    colSpan={colSpan}
                    className={col.tabletHide ? 'col-tablet-hide' : ''}
                    style={{
                      padding: '11px 16px',
                      textAlign: col.align,
                      fontSize: 11, fontWeight: 600, color: '#484f58',
                      whiteSpace: 'nowrap', userSelect: 'none',
                      borderBottom: '1px solid var(--c-b1)',
                    }}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : tab === 'proximos' ? (
              activeRows.length === 0
                ? <tr><td colSpan={7}><EmptyState label={periodo === 'todos' ? 'Nenhum provento futuro estimado no momento' : `Nenhum provento estimado para ${PERIODO_OPTIONS.find(o => o.key === periodo)?.label.toLowerCase()}`} /></td></tr>
                : activeRows.map((row, i) => (
                    <ProventoRow
                      key={`${row.ticker}-${row.dataEx}-${i}`}
                      row={row}
                      shares={sharesMap[row.ticker]}
                      idx={i}
                      isLast={i === activeRows.length - 1}
                    />
                  ))
            ) : (
              recentLancamentos.length === 0
                ? <tr><td colSpan={7}><EmptyState label="Nenhum provento registrado nos últimos 12 meses" /></td></tr>
                : recentLancamentos.map((entry, i) => (
                    <RecentRow
                      key={`${entry.ticker}-${entry.date}-${i}`}
                      entry={entry}
                      idx={i}
                      isLast={i === recentLancamentos.length - 1}
                    />
                  ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer legend ───────────────────────────────────────────────── */}
      {!loading && (tab === 'proximos' ? activeRows.length > 0 : recentLancamentos.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16,
          padding: '10px 20px',
          borderTop: '1px solid var(--c-b2)',
        }}>
          {tab === 'proximos' ? (
            <>
              {/* Urgency legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                {[
                  { color: '#f85149', label: '≤7d' },
                  { color: '#f59e0b', label: '≤15d' },
                  { color: '#3fb950', label: '≤30d' },
                  { color: '#3b82f6', label: '≤60d' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 10, color: '#484f58' }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Total estimado do período */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={11} color="#3fb950" />
                <span style={{ fontSize: 11, color: '#484f58' }}>
                  Total estimado{periodo !== 'todos' ? ` (${PERIODO_OPTIONS.find(o => o.key === periodo)?.label.toLowerCase()})` : ''}:
                </span>
                <span className="mono font-bold" style={{ fontSize: 13, color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtBRLTotal(totalEstimado)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={10} color="var(--c-tx4)" />
              <span style={{ fontSize: 10, color: '#484f58' }}>
                Proventos registrados via lançamentos · últimos 12 meses
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
