/**
 * KrakenCriteriaPanel — painel de referência dos critérios que a Análise IA
 * usa para recomendar ativos (Modelo Kraken v2.0).
 *
 * 100% lido de src/config/krakenCriteria.js (a MESMA fonte interpolada no
 * SYSTEM_PROMPT da IA) — o que aparece aqui é exatamente o que a IA aplica.
 *
 * Por categoria: Mínimo para comprar · Condição perfeita · Eliminação (nunca
 * comprar) · Segmentos/setores na ordem de preferência.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpenCheck } from 'lucide-react';
import { KRAKEN_CRITERIA, countLabel } from '../config/krakenCriteria';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';

const C = KRAKEN_CRITERIA;
const n = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

// ── Dados do painel (derivados do config) ─────────────────────────────────────
const SECTIONS = [
  {
    cat: 'FIIs',
    meta: `${C.allocation.fiis.target}% da carteira · ${countLabel('fiis')}`,
    rows: [
      { ind: 'P/VP',          min: `< ${n(C.fiis.pVP.max)}`,                              perfect: `< ${n(C.fiis.pVP.ideal)} (margem de segurança real)`,                          kill: `> ${n(C.fiis.pVP.eliminate)}` },
      { ind: 'Dividend Yield', min: `≥ Selic − ${C.fiis.dy.selicSpread}pp (hoje ${n(C.fiis.dy.min, 1)}%)`, perfect: `Estável ou crescente há ${C.fiis.minTrackYears}+ anos`,        kill: `< ${C.fiis.dy.eliminateBelow}% (amortização disfarçada)` },
      { ind: 'Vacância física', min: `< ${C.fiis.vacancy.max}%`,                          perfect: `< ${C.fiis.vacancy.ideal}%`,                                                   kill: `> ${C.fiis.vacancy.eliminate}%` },
      { ind: 'Liquidez diária', min: `> R$ ${(C.fiis.liquidity.min / 1e6).toLocaleString('pt-BR')} milhão`, perfect: 'Quanto maior, melhor',                                       kill: 'Diluições abusivas · fundo < 2 anos' },
      { ind: 'Portfólio',     min: 'Diversificado',                                       perfect: 'Multi-inquilino e multi-imóvel',                                               kill: 'Single-asset / single-tenant' },
      { ind: 'Saúde dos inquilinos', min: 'Inquilinos/devedores saudáveis',               perfect: 'Base diversificada, sem stress de crédito',                                    kill: `> ${C.solvency.fiiTenantInRJMaxRevenuePct}% da receita com inquilino em RJ` },
      { ind: 'Alavancagem',   min: `Obrigações ≤ ${C.solvency.fiiLeverageWarnPctPL}% do PL`, perfect: 'Baixa ou sem alavancagem',                                                  kill: `> ${C.solvency.fiiLeverageWarnPctPL}% do PL → sinalizar risco (CDI alto)` },
    ],
    ranking: { label: 'Segmentos preferidos', items: C.fiis.segments },
  },
  {
    cat: 'Ações',
    meta: `${C.allocation.acoes.target}% da carteira · ${countLabel('acoes')}`,
    rows: [
      { ind: 'P/L',            min: `< ${C.acoes.pL.max}`,                                perfect: 'Baixo com lucro crescente',                                                    kill: `Negativo ou > ${C.acoes.pL.eliminate}` },
      { ind: 'P/VP',           min: `< ${n(C.acoes.pVP.max, 1)}`,                          perfect: `< ${n(C.acoes.pVP.idealCyclical, 1)} (obrigatório em cíclicos)`,               kill: '—' },
      { ind: 'ROE',            min: `≥ ${C.acoes.roe.min}% a.a.`,                          perfect: `Consistente nos últimos ${C.acoes.roe.consistencyYears} anos`,                 kill: `< ${C.acoes.roe.eliminateBelow}% por 2 anos` },
      { ind: 'Dividend Yield', min: `≥ ${C.acoes.dy.min}% (preferência, não obrigatório)`, perfect: 'Payout estável/crescente, nunca > 100% do lucro',                              kill: 'Sem dividendos há 3 anos' },
      { ind: 'Dívida Líq./EBITDA', min: `< ${n(C.acoes.debtEbitda.max, 1)}`,               perfect: `< ${n(C.acoes.debtEbitda.idealNonFinancial, 1)} (não-financeiro)`,             kill: `> ${n(C.solvency.acoesDebtEbitdaEliminate, 1)} (insolvência — Selic alta)` },
      { ind: 'Margem líquida', min: `> ${C.acoes.netMargin.min}%`,                          perfect: 'Crescente trimestre a trimestre',                                              kill: 'Escândalo contábil recente' },
      { ind: 'Recuperação judicial', min: 'Nenhuma RJ/RE',                                   perfect: 'Sem histórico de stress de crédito',                                           kill: `RJ/RE própria ou pedido < ${C.solvency.judicialRecoveryMonths} meses` },
      { ind: 'Lucro trimestral', min: 'Lucro recorrente',                                    perfect: 'Lucro crescente',                                                              kill: `Prejuízo em ≥ ${C.solvency.acoesLossQuartersEliminate} dos últimos 4 tri` },
      { ind: 'Eventos de crédito', min: 'Nenhum',                                            perfect: 'Rating estável ou alto',                                                       kill: 'Calote · rebaixamento · renegociação forçada · ressalva' },
      { ind: 'Estatal / governo', min: 'P/L e P/VP bem abaixo do teto + sinalizar risco',    perfect: 'Privada, sem dependência governamental',                                        kill: 'Não sinalizar o risco político/regulatório' },
    ],
    ranking: { label: 'Setores preferidos', items: C.acoes.sectors },
  },
  {
    cat: 'Renda Fixa',
    meta: `${C.allocation.rendaFixa.target}% da carteira · ${countLabel('rendaFixa')} (flexível)`,
    rows: [
      { ind: 'Rentabilidade',  min: `≥ ${C.rendaFixa.minCDI.min}% do CDI (piso absoluto)`, perfect: 'LCI/LCA isenta de IR com a maior taxa', kill: `< ${C.rendaFixa.minCDI.min}% CDI — sem exceções` },
      { ind: 'Garantia',       min: 'Cobertura FGC obrigatória',                            perfect: 'Banco Tier 1 ou médio com rating',       kill: 'Fintech sem rating · debênture desconhecida' },
      { ind: 'Prazo',          min: `${C.rendaFixa.term.min} a ${C.rendaFixa.term.max} anos`, perfect: 'Casado com objetivo (sem resgate antecipado)', kill: 'Prefixado longo com juros em queda' },
    ],
    ranking: { label: 'Hierarquia de prioridade', items: C.rendaFixa.hierarchy },
  },
  {
    cat: 'ETFs',
    meta: `${C.allocation.etfs.target}% da carteira · ${countLabel('etfs')}`,
    rows: [
      { ind: 'Taxa de adm.',   min: `≤ ${n(C.etfs.fee.max)}% a.a.`,                        perfect: `${n(C.etfs.fee.ideal)}% a.a. (BOVA11)`,  kill: `> ${n(C.etfs.fee.max)}% a.a.` },
      { ind: 'Liquidez diária', min: `> R$ ${(C.etfs.liquidity.min / 1e6).toLocaleString('pt-BR')} milhões`, perfect: 'Spread mínimo',         kill: 'Nunca vender em quedas' },
    ],
    ranking: { label: 'ETFs preferidos', items: C.etfs.preferred },
  },
  {
    cat: 'Cripto',
    meta: `${C.allocation.cripto.target}% da carteira · ${countLabel('cripto')} (só ${C.cripto.allowedAssets.join(', ')})`,
    rows: [
      { ind: 'Ativo',          min: C.cripto.allowedAssets.join(', '),                     perfect: 'DCA mensal independente do preço · hardware wallet > R$ 5 mil', kill: 'Qualquer altcoin' },
      { ind: 'Posição',        min: `Meta ${C.allocation.cripto.target}% do patrimônio`,   perfect: 'Aporte extra em correções > 30%',        kill: `Vender só se passar de ${C.cripto.sellAbovePct}%` },
    ],
    ranking: null,
  },
];

function SectionTable({ section, isOpen, onToggle }) {
  const color = CATEGORY_COLORS[section.cat] ?? 'var(--c-tx3)';
  return (
    <div style={{ borderTop: '1px solid var(--c-b2)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '11px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {isOpen ? <ChevronDown size={14} color="var(--c-tx4)" /> : <ChevronRight size={14} color="var(--c-tx4)" />}
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {CATEGORY_ICONS[section.cat]} {section.cat}
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-tx4)' }}>{section.meta}</span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--c-b2)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--c-s2)' }}>
                  {['Indicador', '🏆 Top — Condição perfeita', '✅ Mínimo aceitável', '❌ Eliminação'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--c-tx4)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--c-b2)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r, i) => (
                  <tr key={r.ind} style={{ borderBottom: i < section.rows.length - 1 ? '1px solid var(--c-b3)' : 'none' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--c-tx2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.ind}</td>
                    <td style={{ padding: '8px 12px', color: '#3fb950', fontWeight: 600 }}>{r.perfect}</td>
                    <td className="mono" style={{ padding: '8px 12px', color: '#d29922', fontVariantNumeric: 'tabular-nums' }}>{r.min}</td>
                    <td style={{ padding: '8px 12px', color: '#f85149' }}>{r.kill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {section.ranking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 600 }}>{section.ranking.label}:</span>
              {section.ranking.items.map((s, i) => (
                <span key={s} style={{
                  fontSize: 11, color: i === 0 ? color : 'var(--c-tx3)',
                  background: i === 0 ? color + '18' : 'var(--c-s2)',
                  border: `1px solid ${i === 0 ? color + '50' : 'var(--c-b2)'}`,
                  borderRadius: 12, padding: '2px 9px', fontWeight: i === 0 ? 700 : 500,
                }}>
                  {i + 1}º {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KrakenCriteriaPanel() {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set(['FIIs']));

  const toggleSection = (cat) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '13px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <BookOpenCheck size={16} color="#7c3aed" />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-tx1)' }}>
            Critérios de recomendação — Modelo Kraken v2.0
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--c-tx4)', marginTop: 2 }}>
            Exatamente o que a IA aplica ao recomendar ativos · teto de {C.allocation.maxPerAsset}% por ativo · meta de DY {C.targets.dyPortfolio}% a.a.
          </span>
        </div>
        {open ? <ChevronDown size={15} color="var(--c-tx4)" /> : <ChevronRight size={15} color="var(--c-tx4)" />}
      </button>

      {open && (
        <>
          {SECTIONS.map(s => (
            <SectionTable
              key={s.cat}
              section={s}
              isOpen={openSections.has(s.cat)}
              onToggle={() => toggleSection(s.cat)}
            />
          ))}
          <p style={{ fontSize: 11, color: 'var(--c-tx5)', padding: '10px 18px', borderTop: '1px solid var(--c-b2)', margin: 0, lineHeight: 1.6 }}>
            ⚖️ O modelo de alocação é um guia, não lei: a IA pode furar a meta de categoria diante de oportunidade nitidamente superior — mas os critérios
            fundamentalistas acima são INEGOCIÁVEIS: ativo que cai em qualquer eliminação está descartado, por mais barato que pareça.
            🏦 No cenário de Selic ~14,5%, a IA pesquisa notícias de saúde financeira/insolvência (RJ própria ou de inquilinos, endividamento, rating) e
            emite um <strong>Risco de solvência: {C.solvency.ratingLevels.join(' / ')}</strong> com justificativa para cada ativo analisado.
          </p>
        </>
      )}
    </div>
  );
}
