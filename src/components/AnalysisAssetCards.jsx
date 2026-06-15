/**
 * AnalysisAssetCards — renderiza a ETAPA 1 da Análise IA como cards visuais.
 *
 * A IA emite um bloco ```kraken-cards``` com JSON estruturado por ativo
 * (ver api/analyze.js). Aqui só a APRESENTAÇÃO: extraímos o bloco, calculamos
 * a nota 0–10 de forma padronizada/determinística e desenhamos os cards.
 *
 * Nada de lógica de análise — os status (pass/warn/fail), riscos e veredito
 * vêm prontos do modelo; a nota é derivada deles por uma fórmula fixa.
 *
 * Cores semânticas: verde=passa/top, amarelo=atenção/mínimo, vermelho=falha/risco.
 * Tema dark/light via variáveis --c-*; cores de status em hex (já usados no app).
 */
import { TrendingUp, AlertTriangle, CircleCheck, CircleX, MinusCircle, HelpCircle, ArrowRight } from 'lucide-react';

// ── Extrai o bloco kraken-cards do markdown ───────────────────────────────────
// Retorna { cards, cleaned, pending }:
//   cards   = array de ativos (ou null se ausente/ inválido)
//   cleaned = markdown sem o bloco (para o resto do relatório)
//   pending = bloco aberto mas ainda não fechado (streaming) → esconder
const FENCE = '```kraken-cards';
export function splitCardsFromMarkdown(md) {
  if (!md) return { cards: null, cleaned: md, pending: false };
  const open = md.indexOf(FENCE);
  if (open === -1) return { cards: null, cleaned: md, pending: false };

  const afterOpen = open + FENCE.length;
  const close = md.indexOf('```', afterOpen);
  if (close === -1) {
    // ainda chegando via streaming — esconde o bloco cru
    return { cards: null, cleaned: md.slice(0, open).trimEnd(), pending: true };
  }

  const json    = md.slice(afterOpen, close).trim();
  const cleaned = (md.slice(0, open) + md.slice(close + 3)).trim();
  try {
    const parsed = JSON.parse(json);
    const cards  = Array.isArray(parsed?.assets) ? parsed.assets : null;
    return { cards: cards?.length ? cards : null, cleaned: cards?.length ? cleaned : md, pending: false };
  } catch {
    // JSON inválido → não quebra: mostra o markdown original inteiro
    return { cards: null, cleaned: md, pending: false };
  }
}

// ── Nota 0–10 (fórmula fixa, determinística) ──────────────────────────────────
const W = { pass: 1.3, warn: 0.5, fail: -2.2, risk: -1.0, base: 5 };
function computeNota(card) {
  const crits = Array.isArray(card.criteria) ? card.criteria : [];
  const risks = Array.isArray(card.hidden_risks) ? card.hidden_risks.length : 0;
  let s = W.base;
  for (const c of crits) {
    if (c.status === 'pass') s += W.pass;
    else if (c.status === 'warn') s += W.warn;
    else if (c.status === 'fail') s += W.fail;
  }
  s += risks * W.risk;
  s = Math.max(0, Math.min(10, s));
  return Math.round(s * 10) / 10;
}

const notaColor  = n => (n >= 7 ? '#3fb950' : n >= 5 ? '#f59e0b' : '#f85149');
const notaLabel  = n => (n >= 7 ? 'bom' : n >= 5 ? 'mediano' : 'fraco');

const STATUS_COLOR = { pass: '#3fb950', warn: '#f59e0b', fail: '#f85149' };

const REC = {
  comprar:   { label: 'Comprar',   color: '#3fb950', bg: '#0d2c1a', border: '#1a4731', Icon: CircleCheck },
  manter:    { label: 'Manter',    color: '#f59e0b', bg: '#2c1f06', border: '#6e4c1a', Icon: MinusCircle },
  vender:    { label: 'Vender',    color: '#f85149', bg: '#2d1215', border: '#6e1c1f', Icon: CircleX },
  considere: { label: 'Considere', color: '#58a6ff', bg: '#0d1e2e', border: '#1e3a5f', Icon: HelpCircle },
};
const POT = {
  alto:  { label: 'Alto potencial',  color: '#3fb950', bg: '#0d2c1a', border: '#1a4731', Icon: TrendingUp },
  medio: { label: 'Médio potencial', color: 'var(--c-tx3)', bg: 'var(--c-s2)', border: 'var(--c-b2)', Icon: ArrowRight },
  baixo: { label: 'Baixo potencial', color: 'var(--c-tx4)', bg: 'var(--c-s2)', border: 'var(--c-b2)', Icon: ArrowRight },
};

function parseNum(s) {
  if (s == null) return null;
  const m = String(s).replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function barWidth(c) {
  const v = parseNum(c.value), l = parseNum(c.limit);
  if (v != null && l != null && l !== 0) {
    return Math.max(6, Math.min(100, (v / l) * 100));
  }
  return c.status === 'fail' ? 100 : c.status === 'warn' ? 85 : 65;
}

// ── Sparkline inline ──────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const w = 120, h = 28, pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Badge({ cfg }) {
  const { label, color, bg, border, Icon } = cfg;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color, background: bg,
      border: `1px solid ${border}`, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>
      <Icon size={12} /> {label}
    </span>
  );
}

function AssetCard({ card }) {
  const nota   = computeNota(card);
  const nColor = notaColor(nota);
  const crits  = Array.isArray(card.criteria) ? card.criteria : [];
  const okCount = crits.filter(c => c.status === 'pass').length;
  const risks  = Array.isArray(card.hidden_risks) ? card.hidden_risks.filter(Boolean) : [];
  const rec    = REC[String(card.recommendation || '').toLowerCase()] ?? null;
  const pot    = POT[String(card.potential || '').toLowerCase()] ?? null;
  const delta  = card.dividend_delta;
  const deltaColor = !delta ? 'var(--c-tx3)' : /↑|\+/.test(delta) ? '#3fb950' : /↓|-/.test(delta) ? '#f85149' : 'var(--c-tx3)';

  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-b1)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ height: 3, background: nColor }} />
      <div style={{ padding: '16px 18px' }}>
        {/* Cabeçalho: nota + ticker + selos */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%', border: `3px solid ${nColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span className="mono" style={{ fontSize: 19, fontWeight: 700, color: nColor, lineHeight: 1 }}>
              {nota.toFixed(1)}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-tx1)' }}>{card.ticker}</span>
              {card.type && (
                <span style={{ fontSize: 11, color: '#58a6ff', background: '#0d1e2e', border: '1px solid #1e3a5f', borderRadius: 5, padding: '1px 7px' }}>
                  {card.type}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-tx3)', marginTop: 3 }}>
              Nota geral: {notaLabel(nota)}{crits.length ? ` · ${okCount} de ${crits.length} critérios ok` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rec && <Badge cfg={rec} />}
            {pot && <Badge cfg={pot} />}
          </div>
        </div>

        {/* Indicadores como barras */}
        {crits.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {crits.map((c, i) => {
              const sc = STATUS_COLOR[c.status] ?? 'var(--c-tx4)';
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--c-tx2)' }}>{c.label}</span>
                    <span className="mono" style={{ color: c.status === 'fail' ? '#f85149' : 'var(--c-tx3)' }}>
                      {c.value}{c.limit ? ` · ${c.limit}` : ''}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--c-s2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${barWidth(c)}%`, height: '100%', background: sc, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sparkline de proventos */}
        {Array.isArray(card.dividend_trend) && card.dividend_trend.length >= 2 && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--c-s2)', border: '1px solid var(--c-b2)', borderRadius: 8, padding: '10px 12px' }}>
            <span style={{ fontSize: 11, color: 'var(--c-tx3)', whiteSpace: 'nowrap' }}>Proventos</span>
            <Sparkline data={card.dividend_trend} color="#3fb950" />
            {delta && (
              <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor, whiteSpace: 'nowrap' }}>{delta}</span>
            )}
          </div>
        )}

        {/* Riscos ocultos (só se houver) */}
        {risks.length > 0 && (
          <div style={{ marginTop: 14, background: '#2d1215', border: '1px solid #6e1c1f', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} color="#f85149" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#f85149' }}>Riscos ocultos detectados</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#e6a3a3', fontSize: 12, lineHeight: 1.6 }}>
              {risks.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {/* Veredito */}
        {(rec || card.verdict) && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--c-b2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {rec && (
              <span style={{ fontSize: 11, fontWeight: 600, color: rec.color, background: rec.bg, border: `1px solid ${rec.border}`, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                {rec.label}
              </span>
            )}
            {card.verdict && <span style={{ fontSize: 12, color: 'var(--c-tx2)', lineHeight: 1.5 }}>{card.verdict}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalysisAssetCards({ cards }) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
      {cards.map((card, i) => <AssetCard key={`${card.ticker}-${i}`} card={card} />)}
    </div>
  );
}
