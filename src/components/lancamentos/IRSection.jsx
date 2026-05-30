/**
 * IRSection — Controle de IR / Impostos na aba Lançamentos.
 *
 * Regras:
 *  - FIIs        → isentos para PF (Lei 11.033/04)
 *  - Ações/ETFs  → tributável se ganho > R$ 20.000/mês  (alíquota 15%)
 *  - Cripto      → tributável se ganho > R$ 35.000/mês  (alíquota 15%)
 *
 * PM usado: média ponderada de todas as compras registradas por ticker.
 * Ganho por venda: (preço_venda − PM) × quantidade_vendida.
 */

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Receipt } from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = v =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtMonth = iso => {
  const [y, m] = iso.split('-');
  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${labels[parseInt(m, 10) - 1]}/${y}`;
};

// ── Core IR computation ───────────────────────────────────────────────────────

function computeIR(lancamentos) {
  // Step 1 — Processar lançamentos em ordem cronológica, rastreando PM e
  // computando o ganho de cada venda com o PM vigente naquele momento
  // (com reset ao zerar posição — mesmo algoritmo de calcPMData).
  const ops = (lancamentos ?? [])
    .filter(l => l.category === 'operacao' && (l.type === 'compra' || l.type === 'venda'))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const state = {};   // ticker → { qty, cost }
  const vendaGains = [];   // { op (venda lancamento), gain, pmAtSale }

  for (const op of ops) {
    const ticker = op.ticker;
    if (!ticker) continue;
    const qty   = parseFloat(op.quantity) || 0;
    if (!qty) continue;
    const total = parseFloat(op.total) || (parseFloat(op.price) || 0) * qty;

    if (!state[ticker]) state[ticker] = { qty: 0, cost: 0 };
    const s = state[ticker];

    if (op.type === 'compra') {
      s.qty  += qty;
      s.cost += total;
    } else if (op.type === 'venda') {
      const pmAtSale = s.qty > 0 ? s.cost / s.qty : null;
      if (s.qty > 0) {
        const fraction      = Math.min(qty / s.qty, 1);
        const costReduction = s.cost * fraction;
        const gain          = total - costReduction;
        vendaGains.push({ op, gain, pmAtSale });
        s.cost -= costReduction;
        s.qty  -= qty;
      } else {
        vendaGains.push({ op, gain: 0, pmAtSale: null });
      }
      if (s.qty <= 0) { s.qty = 0; s.cost = 0; }
    }
  }

  // Step 2 — Acumular ganhos por mês + classe usando o ganho calculado acima
  const buckets = {};   // `${month}|${assetType}` → { month, assetType, totalGain, lines[] }

  vendaGains
    .filter(({ op }) => op.date)
    .forEach(({ op, gain, pmAtSale }) => {
      const month     = op.date.slice(0, 7);
      const assetType = op.assetType ?? 'Ações';
      const key       = `${month}|${assetType}`;

      if (!buckets[key]) buckets[key] = { month, assetType, totalGain: 0, lines: [] };
      buckets[key].totalGain += gain;
      buckets[key].lines.push({
        ticker:    op.ticker,
        qty:       parseFloat(op.quantity) || 0,
        sellPrice: parseFloat(op.price) || 0,
        pm:        pmAtSale,
        gain,
      });
    });

  // Step 3 — Classificar e calcular IR
  const rows = Object.values(buckets)
    .filter(b => b.totalGain > 0)
    .map(b => {
      let ir         = 0;
      let isento     = false;
      let statusNote = '';

      if (b.assetType === 'FIIs') {
        isento     = true;
        statusNote = 'FIIs isentos para PF';
      } else if (b.assetType === 'Cripto') {
        if (b.totalGain > 35_000) {
          ir         = b.totalGain * 0.15;
          statusNote = 'Ganho > R$ 35.000';
        } else {
          isento     = true;
          statusNote = 'Ganho ≤ R$ 35.000 (isento)';
        }
      } else {
        // Ações, ETFs, Renda Fixa — threshold R$ 20k
        if (b.totalGain > 20_000) {
          ir         = b.totalGain * 0.15;
          statusNote = 'Ganho > R$ 20.000';
        } else {
          isento     = true;
          statusNote = 'Ganho ≤ R$ 20.000 (isento)';
        }
      }

      return { ...b, ir, isento, statusNote };
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IRSection({ lancamentos = [] }) {
  const rows = useMemo(() => computeIR(lancamentos), [lancamentos]);

  const thisYear    = new Date().getFullYear().toString();
  const yearRows    = rows.filter(r => r.month.startsWith(thisYear));
  const totalIRYear = yearRows.reduce((s, r) => s + r.ir, 0);
  const hasDebt     = totalIRYear > 0;

  // Don't render if there are no sell operations at all
  const hasAnyVenda = lancamentos.some(l => l.category === 'operacao' && l.type === 'venda');
  if (!hasAnyVenda) return null;

  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        padding: '14px 20px',
        borderBottom: '1px solid var(--c-b2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={14} color="#f59e0b" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>IR / Impostos</h2>
          <span style={{
            fontSize: 11, color: '#484f58',
            background: '#161b22', borderRadius: 4, padding: '2px 8px',
          }}>
            {thisYear}
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#484f58', marginBottom: 2, letterSpacing: '0.05em' }}>
            IR DEVIDO {thisYear}
          </div>
          <div
            className="mono font-bold"
            style={{ fontSize: 16, color: hasDebt ? '#f85149' : '#3fb950' }}
          >
            {fmtBRL(totalIRYear)}
          </div>
        </div>
      </div>

      {/* ── Warning banner ─────────────────────────────────────────────── */}
      {hasDebt && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          margin: '12px 20px 0',
          padding: '10px 14px', borderRadius: 8,
          background: '#2c1a06', border: '1px solid #6e3a1a', color: '#f59e0b',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Você tem <strong>{fmtBRL(totalIRYear)}</strong> de IR a recolher em {thisYear}.{' '}
            Emita o DARF no <strong>e-CAC</strong> até o último dia útil do mês seguinte à venda.
          </span>
        </div>
      )}

      {/* ── No taxable gains message ────────────────────────────────────── */}
      {rows.length === 0 && (
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={14} color="#3fb950" />
          <span style={{ fontSize: 13, color: '#3fb950' }}>
            Nenhum ganho de capital tributável registrado.
          </span>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {[
                  { label: 'Mês',          align: 'left'  },
                  { label: 'Classe',       align: 'left'  },
                  { label: 'Ganho bruto',  align: 'right' },
                  { label: 'Classificação',align: 'right' },
                  { label: 'IR Devido',    align: 'right' },
                ].map(({ label, align }) => (
                  <th key={label} style={{
                    padding: '9px 16px', textAlign: align,
                    fontSize: 11, fontWeight: 600, color: '#484f58',
                    borderBottom: '1px solid var(--c-b1)',
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.month}-${row.assetType}`}
                  style={{ background: i % 2 === 1 ? '#080c11' : 'transparent' }}
                >
                  <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--c-b3)' }}>
                    <span className="mono" style={{ color: '#c9d1d9', fontSize: 13 }}>
                      {fmtMonth(row.month)}
                    </span>
                  </td>

                  <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--c-b3)' }}>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{row.assetType}</span>
                  </td>

                  <td style={{ padding: '13px 16px', textAlign: 'right', borderBottom: '1px solid var(--c-b3)' }}>
                    <span className="mono" style={{ color: '#3fb950', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtBRL(row.totalGain)}
                    </span>
                  </td>

                  <td style={{ padding: '13px 16px', textAlign: 'right', borderBottom: '1px solid var(--c-b3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                      {row.isento
                        ? <CheckCircle  size={12} color="#3fb950" />
                        : <AlertTriangle size={12} color="#f85149" />
                      }
                      <span style={{ fontSize: 11, color: row.isento ? '#3fb950' : '#f85149' }}>
                        {row.statusNote}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '13px 16px', textAlign: 'right', borderBottom: '1px solid var(--c-b3)' }}>
                    <span
                      className="mono font-semibold"
                      style={{
                        fontSize: 13, fontVariantNumeric: 'tabular-nums',
                        color: row.ir > 0 ? '#f85149' : '#484f58',
                      }}
                    >
                      {row.ir > 0 ? fmtBRL(row.ir) : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--c-b2)', marginTop: rows.length ? 0 : 8 }}>
        <p style={{ fontSize: 10, color: '#484f58', lineHeight: 1.5 }}>
          * PM calculado como média ponderada de todas as compras registradas.
          FIIs isentos (Lei 11.033/04). Ações/ETFs isentos se ganho ≤ R$ 20.000/mês.
          Cripto isento se ganho ≤ R$ 35.000/mês. Alíquota padrão: 15%.
          Este cálculo é uma estimativa — consulte um contador para declaração oficial.
        </p>
      </div>
    </div>
  );
}
