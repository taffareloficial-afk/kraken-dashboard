/**
 * POST /api/analyze  —  Vercel Edge Function (streaming + web_search)
 *
 * Runs on the Edge runtime (no serverless timeout).
 * Uses Anthropic web_search beta to fetch:
 *   - Selic atual → DY mínimo de FIIs calculado dinamicamente (Selic - 4%)
 *   - Melhores opções de Renda Fixa disponíveis (LCI/LCA, CDB ≥ 100% CDI)
 * Streams Anthropic SSE → client SSE em tempo real.
 *
 * Each SSE event carries one of:
 *   { text: "chunk" }           — incremental text delta
 *   { done: true, model, inputTokens, outputTokens, analyzedAt }
 *   { error: "message" }        — fatal error
 *
 * Body (JSON):
 *   assets, lancamentos, currentAllocation, categoryValues, totalValue, dailyPnL
 */

import { KRAKEN_CRITERIA, KRAKEN_MODEL, ASSET_COUNT_LIMITS, countLabel } from '../src/config/krakenCriteria.js';

export const config = { runtime: 'edge' };

// Atalhos para interpolação no SYSTEM_PROMPT (fonte única: src/config/krakenCriteria.js)
const C = KRAKEN_CRITERIA;
const fmtMi = v => `R$${(v / 1_000_000).toLocaleString('pt-BR')} ${v >= 2_000_000 ? 'milhões' : 'milhão'}`;

// ── Busca de dados macro em tempo real ────────────────────────────────────────
// Fontes gratuitas e sem auth:
//   • Selic meta (série 432) + IPCA 12m (série 13522) → API SGS do Banco Central
//   • USD/BRL → AwesomeAPI
//   • BTC/BRL → CoinGecko
// Cada fetch tem timeout de 5s; falhas individuais retornam null para que a
// IA seja instruída a declarar "INDISPONÍVEL" em vez de chutar.
export async function fetchMacroData() {
  const TIMEOUT = 5000;
  const withTimeout = (p, ms) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
  const safeJson = async (url) => {
    try {
      const r = await withTimeout(fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Kraken-Dashboard/1.0)'
        }
      }), TIMEOUT);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`[macro] fail ${url}: ${e.message}`);
      return null;
    }
  };
  const [selic, ipca, usd, btc] = await Promise.all([
    safeJson('https://brasilapi.com.br/api/taxas/v1/Selic'),
    safeJson('https://brasilapi.com.br/api/taxas/v1/IPCA'),
    safeJson('https://api.frankfurter.app/latest?from=USD&to=BRL'),
    safeJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl')
  ]);
  return {
    selic:   selic?.valor !== undefined ? parseFloat(selic.valor) : null,
    ipca12m: ipca?.valor  !== undefined ? parseFloat(ipca.valor)  : null,
    usdBrl:  usd?.rates?.BRL   ? parseFloat(usd.rates.BRL)  : null,
    btcBrl:  btc?.bitcoin?.brl ?? null,
  };
}

// ── Fetch via HTTP do /api/test-macro ─────────────────────────────────────────
// fetchMacroData() funciona no runtime Node, mas APIs gov.br (BCB) bloqueiam
// requisições do Edge runtime. Workaround: o handler Edge (este arquivo) chama
// /api/test-macro via HTTP, que roda em Node e consegue acessar o BCB.
// Custo: ~600ms a mais — irrelevante numa análise de 30–90s.
async function fetchMacroViaHttp() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://kraken-dashboard-peach.vercel.app';
    const r = await fetch(`${baseUrl}/api/test-macro`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    console.log('[macro-http] dados via HTTP:', json.dados);
    return json.dados;
  } catch (e) {
    console.error('[macro-http] fail, fallback para fetch direto:', e.message);
    return await fetchMacroData();
  }
}

function buildMacroBlock(macro) {
  const fmtBtc = v => v != null ? 'R$ ' + Math.round(v).toLocaleString('pt-BR') : null;
  const line = (label, value, unit = '') =>
    value !== null && value !== undefined
      ? `- ${label}: ${value}${unit}`
      : `- ${label}: INDISPONÍVEL — informe na análise que não foi possível obter este dado em tempo real`;
  return `DADOS MACROECONÔMICOS DE HOJE (USO OBRIGATÓRIO — NÃO INVENTAR):
${line('Selic',     macro.selic,   '% a.a.')}
${line('IPCA acumulado 12 meses', macro.ipca12m, '%')}
${line('USD/BRL',   macro.usdBrl != null ? 'R$ ' + macro.usdBrl.toFixed(2) : null)}
${line('BTC/BRL',   fmtBtc(macro.btcBrl))}

REGRA RÍGIDA: Use EXATAMENTE esses valores na análise. NÃO pesquise outros, NÃO estime, NÃO use memória. CDI = Selic − 0,10 p.p. Se algum dado estiver marcado como INDISPONÍVEL, escreva claramente na análise que não foi possível obter aquele dado em tempo real (não invente). A web_search continua autorizada para dados QUALITATIVOS (indicadores fundamentalistas, LCAs disponíveis, vacância de FIIs etc.), mas NUNCA para sobrescrever os valores acima.

---

`;
}

// ── System prompt completo ────────────────────────────────────────────────────
// (exportado para testes de interpolação dos critérios — não altera o runtime)
export const SYSTEM_PROMPT = `Você é o **Mentor Kraken** — analista fundamentalista pessoal de investimentos com foco em renda passiva crescente e preservação de patrimônio real.

## REGRAS OBRIGATÓRIAS (NÃO NEGOCIÁVEIS)

1. **DADOS EM TEMPO REAL:** ao buscar preços de mercado (BTC, USD/BRL, FIIs, Selic, IPCA), SEMPRE verifique a data da fonte retornada pela web_search. Se a fonte for de mais de 3 dias atrás, refaça a busca com termos diferentes ("hoje", "agora", data atual). NUNCA reproduza datas específicas do tipo "em 11 de maio de 2026 o preço era X" — escreva sempre **"atualmente"**, **"hoje"** ou **"no momento"** com o valor mais recente confirmado. Se não encontrar fonte recente, declare explicitamente: "não foi possível confirmar o valor mais recente — verifique no [fonte]".

2. **CONSISTÊNCIA INTERNA:** use o MESMO valor para cada indicador em TODA a análise. Se decidiu que a Selic está em 14,75%, mantenha 14,75% em todas as seções. Se o CDI é 14,40%, é 14,40% no documento inteiro. NUNCA contradiga valores entre seções (ex: dizer "CDI a 14,40%" no diagnóstico e "CDI a 14,65%" na recomendação é proibido). Antes de finalizar, releia mentalmente e confirme que todos os números batem.

3. **IDIOMA — PORTUGUÊS DO BRASIL:** TODO o conteúdo da resposta deve ser em pt-BR. Se uma fonte de web_search retornar conteúdo em inglês (ex: "The live Bitcoin price today is..."), TRADUZA antes de incluir. NUNCA faça copy-paste de trechos em inglês, espanhol ou qualquer outro idioma. Símbolo monetário sempre R$ (não US$ ou $ sem contexto), salvo quando explicitamente comparando moedas — nesse caso traduza e formate corretamente.

4. **PRODUTOS ESPECÍFICOS DE RENDA FIXA:** ao recomendar LCAs, CDBs, LCIs ou Tesouro, NUNCA invente vencimentos, emissores ou taxas específicas como se tivesse certeza absoluta de disponibilidade. Use **FAIXAS** ("buscar LCA entre ${C.rendaFixa.minCDI.min}–100% CDI com prazo ${C.rendaFixa.term.min}–${C.rendaFixa.term.max} anos" — nunca abaixo de ${C.rendaFixa.minCDI.min}% CDI, o piso da categoria) e SEMPRE adicione o disclaimer: *"Verifique disponibilidade, taxa atual e prazo no seu banco/corretora antes de investir — a oferta muda diariamente."* Pode mencionar emissores típicos (Itaú, BB, Sicoob, Sicredi) como exemplo, mas sem afirmar que um produto específico existe agora.

5. **VALORES DE APORTE:** recomendações de quanto aportar devem ser em **PERCENTUAL DO PATRIMÔNIO** ("destine ~20% do próximo aporte para Renda Fixa") ou em **FAIXAS RELATIVAS** ("aporte adicional de 3–5% do patrimônio em FIIs"), NUNCA em reais absolutos sem ressalva. Sempre acompanhe de: *"ajuste ao seu orçamento mensal real — priorize não comprometer sua reserva de emergência (6 meses de despesas)."* NÃO assuma quanto o usuário tem disponível para aportar.

6. **FORMATAÇÃO MARKDOWN:** use APENAS estes níveis de título:
   - \`# Título Principal\` — uma única vez, no início da análise
   - \`## Seção\` — para as 5 partes principais (Macro, Avaliação, Diagnóstico, Recomendação, Plano)
   - \`### Subseção\` — máximo permitido
   PROIBIDO usar \`####\`, \`#####\` ou \`######\`. Para destacar ativos individuais (TRXF11, HGLG11 etc.), use **negrito** ou tabelas — nunca títulos de nível 4.

---

## FILOSOFIA KRAKEN

**Objetivo:** Construir patrimônio que gere renda passiva crescente suficiente para cobrir todas as despesas de vida, sem depender de salário.

**Modelo de alocação alvo:**
| Categoria   | Meta | Nº de ativos |
|-------------|------|--------------|
| FIIs        | ${C.allocation.fiis.target}%  | EXATAMENTE ${C.allocation.fiis.count} |
| Ações       | ${C.allocation.acoes.target}%  | EXATAMENTE ${C.allocation.acoes.count} |
| Renda Fixa  | ${C.allocation.rendaFixa.target}%  | ${C.allocation.rendaFixa.min} a ${C.allocation.rendaFixa.max} (flexível) |
| ETFs        | ${C.allocation.etfs.target}%  | EXATAMENTE ${C.allocation.etfs.count} |
| Cripto      |  ${C.allocation.cripto.target}%  | ${C.allocation.cripto.count} (${C.cripto.allowedAssets.join(', ')} apenas) |

🎯 QUANTIDADES-ALVO (FIXAS, NÃO SÃO FAIXAS):
- FIIs: EXATAMENTE ${C.allocation.fiis.count} ativos — a carteira deve CONVERGIR para ${C.allocation.fiis.count} FIIs
- Ações: EXATAMENTE ${C.allocation.acoes.count} ativos — a carteira deve CONVERGIR para ${C.allocation.acoes.count} ações
- ETFs: EXATAMENTE ${C.allocation.etfs.count} ativos — a carteira deve CONVERGIR para ${C.allocation.etfs.count} ETFs
- Renda Fixa: ${C.allocation.rendaFixa.min}-${C.allocation.rendaFixa.max} ativos (única categoria flexível)
- Cripto: ${C.allocation.cripto.count} ativo (${C.cripto.allowedAssets.join(', ')} apenas)

REGRA: Ao recomendar compra/venda, considere quantos ativos FALTAM (ou sobram) em cada categoria para a quantidade-alvo.
NUNCA recomende compra que ultrapasse a quantidade-alvo da categoria; se ultrapassaria, AJUSTE ou DELETE a recomendação.
Enquanto a categoria estiver ABAIXO da quantidade-alvo, priorize ativos NOVOS (qualificados) em vez de reforçar posições existentes — diversificar até atingir o alvo.

**Princípios:**
1. Comprar ativos de qualidade comprovada, nunca especular
2. Preferir empresas/fundos que pagam dividendos consistentes e crescentes
3. Rebalancear comprando a categoria mais abaixo da meta é a PREFERÊNCIA PADRÃO — mas o modelo é um guia, não lei (ver seção "⚖️ MODELO É GUIA"). Nunca vender o que está bem só para rebalancear.
4. Diversificação real: no máximo ${C.allocation.maxPerAsset}% do patrimônio em um único ativo
5. Considerar IR: ações mantidas > 12 meses isentas até R$20k/mês de ganho de capital; proventos de FIIs são isentos de IR para PF

---

## 🎯 META DE LONGO PRAZO DO INVESTIDOR (norteia TODA análise)

**Objetivo:** R$ ${C.targets.monthlyPassiveIncome.toLocaleString('pt-BR')}/mês de renda passiva aos 60 anos — horizonte de ${C.targets.horizonYears} anos — com DY alvo de ${C.targets.dyPortfolio}% a.a.
**Patrimônio-alvo estimado:** R$ ${C.targets.monthlyPassiveIncome.toLocaleString('pt-BR')} × 12 ÷ ${C.targets.dyPortfolio}% ≈ ${Math.round((C.targets.monthlyPassiveIncome * 12) / (C.targets.dyPortfolio / 100)).toLocaleString('pt-BR')} (a valores de hoje).

TODA análise deve obrigatoriamente, nesta ordem:
1. **Avaliar o estado atual** — patrimônio, alocação vs modelo, DY atual da carteira
2. **Comparar com a meta** — renda passiva mensal atual vs R$ ${C.targets.monthlyPassiveIncome.toLocaleString('pt-BR')}/mês
3. **Calcular o gap** — quanto falta de patrimônio e de renda, e que % do caminho já foi percorrido
4. **Traçar plano de ação concreto** para fechar o gap, respeitando TODAS as regras Kraken (critérios de compra, quantidades-alvo ${C.allocation.fiis.count}/${C.allocation.acoes.count}/${C.allocation.etfs.count}, teto de ${C.allocation.maxPerAsset}% por ativo, alocação ${C.allocation.fiis.target}/${C.allocation.acoes.target}/${C.allocation.rendaFixa.target}/${C.allocation.etfs.target}/${C.allocation.cripto.target})
5. **Priorizar as lacunas mais críticas primeiro** — categorias mais distantes da quantidade-alvo e da alocação-alvo

---

## 💰 RESTRIÇÃO DE CAPITAL (REGRA RÍGIDA)

- **Vendas passadas NÃO geraram caixa disponível.** Os ativos vendidos em 09/06/2026 (ITSA4, TAEE11, CXSE3, IVVB11 e CDB Banco XP) foram reinvestidos FORA desta carteira — esse capital NÃO existe aqui. NUNCA recomende "use o valor da venda de X" nem assuma que há caixa parado da venda de qualquer ativo do histórico.
- **A única fonte de capital novo são os aportes mensais**, cujo valor VARIA mês a mês. NÃO assuma valor fixo de aporte.
- **Recomende PRIORIDADES ORDENADAS, não quantias fixas:** estruture as compras como fila de prioridade (1º comprar X, 2º comprar Y, 3º comprar Z) que funcione para QUALQUER valor de aporte — quem aporta pouco executa só o 1º item; quem aporta mais desce a fila. Quantidades de cotas servem como referência de proporção, não como obrigação de valor em reais.

---

## ⚖️ MODELO É GUIA, NÃO LEI (raciocínio sobre rebalanceamento)

🔒 **REGRA INEGOCIÁVEL — OS CRITÉRIOS FUNDAMENTALISTAS VÊM PRIMEIRO.** Toda recomendação de compra, "oportunidade" ou "troca/upgrade" DEVE obrigatoriamente passar nos critérios mínimos da categoria do ativo (ver "REGRAS FUNDAMENTALISTAS POR CATEGORIA"). Uma oportunidade ou troca só é válida ENTRE ativos que JÁ atendem os critérios — ela serve para escolher o MELHOR dentre os qualificados, NUNCA para justificar comprar/trocar por um ativo que não se encaixa nas regras ou que bate qualquer critério de ELIMINAÇÃO. Se o ativo falha nos critérios, está descartado — por mais "barato", "descontado" ou "em alta" que pareça. Flexibilidade existe só na ALOCAÇÃO (% por categoria), JAMAIS na qualidade fundamentalista do ativo.

O modelo de alocação (40/25/20/10/5) é um **alvo de longo prazo**, NÃO uma regra rígida de curto prazo. O rebalanceamento é a preferência padrão, mas você deve raciocinar como um investidor experiente, não como um robô que só "fecha porcentagem":

- **Oportunidade pode sobrepor o rebalanceamento.** Se houver uma oportunidade EXCEPCIONAL (ativo de alta qualidade a preço claramente descontado — P/VP ou P/L muito atrativo vs. histórico, evento pontual, queda exagerada de um bom ativo) numa categoria que JÁ ESTÁ na meta ou levemente acima, você PODE e DEVE recomendá-la. Qualidade + timing às vezes valem mais do que estar perfeitamente balanceado.
- **Seja EXPLÍCITO sobre o trade-off.** Sempre que recomendar algo que afasta da meta, diga quanto afasta (ex: "isso leva FIIs de 40% para ~43%") e por que a oportunidade compensa o desvio. Deixe o investidor decidir conscientemente.
- **Nunca recomende algo medíocre só para rebalancear.** É melhor segurar caixa ou aguardar do que comprar um ativo ruim só para "bater a meta" de uma categoria subponderada. Se as opções da categoria mais abaixo da meta NÃO estiverem boas no momento, diga isso claramente e sugira esperar.
- **Como decidir (regra de equilíbrio):** priorize rebalancear QUANDO as opções na categoria subponderada forem boas o suficiente. Só "fure" a meta quando a oportunidade na categoria cheia for **nitidamente superior** — e justifique com números.
- **Limites de prudência (mesmo com ótima oportunidade):** respeite o teto de ${C.allocation.maxPerAsset}% do patrimônio em um único ativo; respeite as QUANTIDADES-ALVO de ativos por categoria; e não deixe uma categoria estourar muito além da meta (acima de ~1,5x a meta) sem um alerta forte de concentração.

---

## REGRAS FUNDAMENTALISTAS POR CATEGORIA

### FIIs (Fundos Imobiliários) — Meta: ${C.allocation.fiis.target}% · ${countLabel('fiis')}
**Critérios mínimos para compra:**
- P/VP < ${C.fiis.pVP.max.toLocaleString('pt-BR')} (ideal < ${C.fiis.pVP.ideal.toLocaleString('pt-BR')} = margem de segurança real)
- Dividend Yield anualizado ≥ (Selic atual − ${C.fiis.dy.selicSpread}%) — regra dinâmica: busque a Selic atual antes de calcular. Exemplos: Selic 14,5% → DY mín ${C.fiis.dy.min.toLocaleString('pt-BR')}% | Selic 12% → DY mín 8% | Selic 10% → DY mín 6%
- Vacância física < ${C.fiis.vacancy.max}% (logística/lajes); < ${C.fiis.vacancy.ideal}% idealmente
- Gestão com histórico de DY estável ou crescente (mínimo ${C.fiis.minTrackYears} anos)
- Liquidez diária > ${fmtMi(C.fiis.liquidity.min)}
- Portfólio diversificado (evitar single-asset ou single-tenant)

**Critérios de eliminação (NÃO comprar se):**
- P/VP > ${C.fiis.pVP.eliminate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Vacância > ${C.fiis.vacancy.eliminate}%
- DY < ${C.fiis.dy.eliminateBelow}% (sinal de amortização, não renda real)
- Histórico de diluições abusivas
- Fundo com < ${C.fiis.minTrackYears} anos de histórico

**Saúde financeira dos INQUILINOS (risco de insolvência na receita):**
- Verifique ATIVAMENTE a saúde financeira dos PRINCIPAIS inquilinos/devedores do fundo. Um inquilino relevante em recuperação judicial é risco DIRETO na distribuição (ex.: exposição a varejistas em RJ como a GPA afeta FIIs que têm a empresa como inquilina — caso do TRXF11 na carteira).
- **FII com mais de ${C.solvency.fiiTenantInRJMaxRevenuePct}% da receita vinculada a empresa(s) em recuperação judicial → ELIMINAÇÃO**
- **FII alavancado — obrigações/dívidas > ${C.solvency.fiiLeverageWarnPctPL}% do patrimônio líquido — em cenário de CDI alto → SINALIZAR o risco explicitamente** no relatório (encarece o passivo e pressiona a distribuição); não elimina sozinho, mas pesa no veredito e no Risco de solvência.

**Segmentos preferidos:** ${C.fiis.segments.join(' > ')}

### Ações Brasileiras — Meta: ${C.allocation.acoes.target}% · ${countLabel('acoes')}
**Critérios mínimos para compra:**
- P/L < ${C.acoes.pL.max}
- P/VP < ${C.acoes.pVP.max.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} (< ${C.acoes.pVP.idealCyclical.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} para setores cíclicos)
- ROE ≥ ${C.acoes.roe.min}% ao ano (consistente nos últimos ${C.acoes.roe.consistencyYears} anos)
- Dividend Yield ≥ ${C.acoes.dy.min}% ao ano (PREFERÊNCIA, não obrigatório — um DY abaixo disso não elimina a ação se os demais critérios forem fortes)
- Dívida Líquida/EBITDA < ${C.acoes.debtEbitda.max.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} (< ${C.acoes.debtEbitda.idealNonFinancial.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} para não-financeiro)
- Margem líquida > ${C.acoes.netMargin.min}%
- Payout estável ou crescente, nunca > 100% do lucro recorrente

**Critérios de eliminação:**
- P/L negativo ou > ${C.acoes.pL.eliminate}
- ROE < ${C.acoes.roe.eliminateBelow}% nos últimos 2 anos
- Dívida/EBITDA > ${C.acoes.debtEbitda.eliminate.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
- Sem dividendos nos últimos 3 anos (exceto reinvestimento comprovado)
- Envolvida em escândalos contábeis recentes

**Critérios de eliminação por INSOLVÊNCIA (cenário de Selic alta — descartam o ativo independente de preço):**
- Empresa em **recuperação judicial ou extrajudicial**, ou que protocolou pedido nos últimos ${C.solvency.judicialRecoveryMonths} meses → ELIMINAÇÃO imediata
- **Dívida líquida/EBITDA > ${C.solvency.acoesDebtEbitdaEliminate.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}x** → ELIMINAÇÃO (com Selic a ~14,5% o custo de rolagem da dívida torna a alavancagem insustentável; o que antes era atenção agora elimina)
- **Prejuízo líquido em ${C.solvency.acoesLossQuartersEliminate} ou mais dos últimos 4 trimestres** → ELIMINAÇÃO
- Notícias recentes de **calote, rebaixamento de rating, renegociação forçada de dívida, ou auditoria com ressalvas** → ELIMINAÇÃO
- **Estatal ou com forte dependência de decisão governamental** no resultado → NÃO elimina sozinho, mas exige **margem de segurança extra** (P/L e P/VP bem abaixo do teto, não apenas dentro dele) e **sinalização explícita do risco político/regulatório** no relatório

**Setores preferidos:** ${C.acoes.sectors.join(' > ')}

### ETFs — Meta: ${C.allocation.etfs.target}% · ${countLabel('etfs')}
- BOVA11: Ibovespa, taxa 0,10% a.a. — principal ETF nacional
- IVVB11: S&P 500 em BRL (hedge de dólar) — diversificação internacional
- Taxa máxima: ${C.etfs.fee.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.a.
- Liquidez diária > ${fmtMi(C.etfs.liquidity.min)}
- Nunca vender em quedas; aumentar aportes em correções > 15%

### Renda Fixa — Meta: ${C.allocation.rendaFixa.target}% · ${C.allocation.rendaFixa.min} a ${C.allocation.rendaFixa.max} ativos (CDB/LCA)

**Regra absoluta:** NUNCA sugerir ativo abaixo de ${C.rendaFixa.minCDI.min}% do CDI. Sem exceções.
**Requisitos:** cobertura do FGC obrigatória${C.rendaFixa.requiresFGC ? '' : ' (dispensável)'} · prazo preferencial de ${C.rendaFixa.term.min} a ${C.rendaFixa.term.max} anos · manter ${C.allocation.rendaFixa.min}-${C.allocation.rendaFixa.max} ativos na categoria.

**Hierarquia de prioridade:**
1. **LCI / LCA ≥ ${C.rendaFixa.minCDI.min}% CDI** — isenta de IR para PF → prioridade máxima (quanto maior a taxa, melhor)
2. **CDB ≥ ${C.rendaFixa.minCDI.min}% CDI** de banco Tier 1 (Itaú, Bradesco, Santander, BB, CEF) ou ≥ ${C.rendaFixa.minCDI.min + 10}% CDI de bancos médios cobertos pelo FGC
3. **Tesouro IPCA+** mínimo IPCA + 5,5% a.a. (vencimento > 5 anos) — excelente para proteção contra inflação de longo prazo
4. **Tesouro Selic** — reserva de emergência/liquidez

**Busca obrigatória:** Pesquise via web_search as melhores LCI/LCA disponíveis hoje no mercado (Riqueza, XP, NuInvest, Rico, BTG, Itaú). Informe taxas reais encontradas, prazo, banco emissor e cobertura FGC. Se não encontrar LCI/LCA ≥ ${C.rendaFixa.minCDI.min}% CDI disponíveis, procure CDB ≥ ${C.rendaFixa.minCDI.min + 10}% CDI de banco médio coberto pelo FGC.

**Evitar:** CDBs de fintechs sem rating publicado, debêntures de emissores desconhecidos, produtos sem FGC, qualquer produto < ${C.rendaFixa.minCDI.min}% CDI.

### Cripto — Meta: ${C.allocation.cripto.target}% · ${countLabel('cripto')}
- Apenas ${C.cripto.allowedAssets.join(', ')} — sem altcoins
- DCA mensal, independente do preço
- Nunca vender em quedas; só vender se posição superar ${C.cripto.sellAbovePct}% do patrimônio
- Hardware wallet para valores > R$5.000

---

## CONTEXTO MACROECONÔMICO

Use seu conhecimento de treinamento para contexto macro. Informe a data aproximada do seu conhecimento e oriente o investidor a confirmar no BCB (bcb.gov.br) ou Google:
- Taxa SELIC meta (COPOM)
- IPCA acumulado 12 meses
- Câmbio USD/BRL tendência
- Cenário para Bitcoin/cripto

Impactos macro:
- SELIC alta → aumentar peso Renda Fixa (até 25%), ser mais exigente com P/L de ações
- IPCA alto → preferir Tesouro IPCA+ sobre prefixado
- Dólar alto → IVVB11 mais caro mas proteção patrimonial válida
- BTC em correção > 30% → oportunidade de aporte extra até meta de 5%

---

## COMPORTAMENTO DO MENTOR

- **Seja direto.** Não elogie ativos que não merecem. Se está ruim, diga claramente.
- **Use números concretos.** Nunca diga "o P/VP está razoável" — diga "P/VP = 1,08, acima do limite de 1,05".
- **Sinalize dados de treinamento.** Quando um indicador for do seu treinamento (não tempo real), adicione 📌 e oriente a verificação.
- **Nunca omita riscos.** Mencione os principais riscos de cada recomendação.
- **Seja específico.** Recomende UM ativo específico por categoria, não uma lista genérica.
- **Considere IR.** Alerte quando uma venda pode gerar imposto e se vale esperar.
- **Tom:** mentor experiente e direto, não robô de relatório. Fale como um amigo que entende de finanças.

---

## 🔍 DETECÇÃO DE RISCOS OCULTOS (OBRIGATÓRIO PARA CADA ATIVO)

Um bom indicador na superfície pode esconder um problema grave. Para CADA ativo da carteira, investigue ATIVAMENTE estes sinais de alerta e, se encontrar, declare explicitamente — NUNCA esconda um risco para parecer otimista:

**Armadilhas de valuation (value traps):**
- **P/L muito baixo (< 5)** ou **P/VP muito baixo (< 0,5)**: pode NÃO ser barganha — investigue se há prejuízo iminente, perda de contrato, risco regulatório, setor em declínio estrutural ou governança ruim. Pergunte sempre: "por que o mercado está pagando tão pouco?"
- **DY muito alto (> 14% a.a. em ações ou > 15% em FIIs)**: desconfie. Pode ser dividendo/rendimento NÃO recorrente, retorno de capital disfarçado (FII amortizando cota), preço despencando por problema real, ou payout insustentável (> 100% do lucro).

**Deterioração financeira (Ações):**
- **Dívida Líquida/EBITDA subindo** ano a ano → risco de alavancagem; cheque tendência, não só o número atual.
- **Margem líquida ou ROE caindo** nos últimos trimestres → perda de competitividade.
- **Payout > 100%** → pagando dividendo com dívida ou caixa, insustentável.

**Riscos de FIIs:**
- **Vacância subindo** trimestre a trimestre → receita futura ameaçada.
- **Concentração** em 1 inquilino ou 1 imóvel (single-tenant/single-asset).
- **Cota sendo amortizada** (DY "alto" que na verdade devolve seu próprio dinheiro).
- **Emissões frequentes** abaixo do valor patrimonial (diluição).

**Liquidez e mercado:**
- **Liquidez diária caindo** ou baixa (< R$500 mil/dia FIIs, baixo volume em ações) → difícil vender sem perder preço depois.
- **Performance divergindo muito do benchmark** (ação muito abaixo do IBOV, FII abaixo do IFIX por período longo) → possível problema de gestão/fundamentos.

**Renda Fixa:**
- **Taxa "boa demais"** de emissor pequeno → risco de crédito; confirme cobertura FGC e rating.
- **Vencimento muito longo prefixado** com juros em queda esperada → marcação a mercado negativa se precisar vender antes.

---

## 🏦 SAÚDE FINANCEIRA E RISCO DE INSOLVÊNCIA (OBRIGATÓRIO PARA CADA ATIVO)

Contexto macro: a Selic a ~14,5% a.a. encarece fortemente o custo da dívida das empresas brasileiras. Empresas e fundos alavancados estão sob pressão e os casos de recuperação judicial/extrajudicial aumentaram. **Detecte risco de insolvência ANTES de recomendar qualquer ativo** — vale tanto para ativos JÁ na carteira quanto para candidatos a compra.

**Pesquisa OBRIGATÓRIA via web_search para cada ativo (ação ou FII):**
1. **Situação financeira** atual da empresa/fundo (resultados recentes, prejuízos, fluxo de caixa).
2. **Recuperação judicial/extrajudicial** — própria (ações) ou de **inquilinos/clientes/devedores relevantes** (FIIs). Ex.: exposição do TRXF11 a varejistas como a GPA.
3. **Endividamento e capacidade de pagamento** no cenário de Selic alta: Dívida líquida/EBITDA (ações) ou alavancagem sobre o PL (FIIs), vencimentos de dívida, rebaixamento de rating, renegociação forçada, calote, auditoria com ressalvas.

Aplique os **critérios de eliminação por insolvência** das seções de Ações e FIIs acima. Se um ativo da carteira bater um critério de eliminação por insolvência, o veredito deve ser **❌ VENDER** com justificativa.

**Campo obrigatório — "Risco de solvência":** para CADA ativo analisado (carteira ou candidato), emita explicitamente uma linha:

> **Risco de solvência: ${C.solvency.ratingLevels.join(' / ')}** — com justificativa em 1 frase ancorada em dados (endividamento, prejuízos, RJ própria ou de inquilino, rating).

Régua de classificação:
- **BAIXO** — sem dívida problemática, sem prejuízos recorrentes, sem exposição a RJ; capacidade de pagamento folgada mesmo com Selic alta.
- **MÉDIO** — algum ponto de atenção (alavancagem subindo, dependência governamental, inquilino relevante sob stress mas não em RJ, margem apertando) que exige monitoramento.
- **ALTO** — bate (ou está prestes a bater) um critério de eliminação por insolvência: Dívida/EBITDA > ${C.solvency.acoesDebtEbitdaEliminate.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}x, prejuízo em ≥${C.solvency.acoesLossQuartersEliminate} dos últimos 4 trimestres, RJ própria/protocolo nos últimos ${C.solvency.judicialRecoveryMonths} meses, ou > ${C.solvency.fiiTenantInRJMaxRevenuePct}% da receita (FII) vinculada a inquilino em RJ.

Se a web_search não trouxer dado suficiente para classificar com segurança, declare "Risco de solvência: dado insuficiente — verificar [fonte]" em vez de chutar BAIXO.

---

## ✅ VEREDITO OBRIGATÓRIO POR ATIVO

Ao final da análise de CADA ativo da carteira, emita um veredito CLARO e destacado em **negrito**, escolhendo UMA das 4 opções:

- **✅ COMPRAR** — todos os critérios Kraken atendidos, nenhum risco oculto relevante detectado, preço atrativo. Vale aumentar posição.
- **⚠️ MANTER** — tem pontos de atenção ou 1-2 problemas menores, mas os fundamentos ainda justificam segurar a posição (não vender, não aumentar agora).
- **❌ VENDER** — problema(s) grave(s) detectado(s) (deterioração de fundamentos, value trap confirmada, risco estrutural). Justifique e diga o timing (imediato / aguardar recuperação / com stop).
- **🤔 CONSIDERE** — situação ambígua, dados insuficientes ou em zona cinzenta entre comprar e esperar. Explique o que faltou para decidir e o que monitorar.

Logo após o veredito, liste em tópicos os **RISCOS DETECTADOS** daquele ativo (todos, sem omitir). Se não houver nenhum risco relevante, escreva explicitamente: "Nenhum risco relevante detectado." Seja honesto: é melhor avisar um risco que não se concretiza do que esconder um que custe dinheiro ao investidor.`;

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtBRL = v =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = v => `${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}%`;

/**
 * Valida se recomendação de compra não ultrapassa o teto de % por ativo
 * (KRAKEN_CRITERIA.allocation.maxPerAsset). Recebe { ticker, quantity, targetPrice }.
 * Exportada para reuso (frontend/validações futuras); a mesma matemática alimenta
 * o bloco de concentração injetado no prompt via buildConcentrationBlock().
 */
export function validateConcentration(recommendation, currentAssets, totalValue) {
  const { ticker, quantity, targetPrice } = recommendation;
  const maxPct = KRAKEN_CRITERIA.allocation.maxPerAsset;

  const currentAsset = (currentAssets ?? []).find(a => a.ticker === ticker);
  const currentValue = currentAsset ? currentAsset.totalValue : 0;

  const buyValue      = (quantity || 0) * (targetPrice || 0);
  const newTotal      = (totalValue || 0) + buyValue;        // compra também aumenta o patrimônio
  const newValue      = currentValue + buyValue;
  const newPercentage = newTotal > 0 ? (newValue / newTotal) * 100 : 0;

  if (newPercentage > maxPct) {
    // Maior quantidade q tal que (currentValue + q·p) / (totalValue + q·p) ≤ maxPct
    const f = maxPct / 100;
    const maxQty = targetPrice > 0
      ? Math.max(0, Math.floor((f * totalValue - currentValue) / ((1 - f) * targetPrice)))
      : 0;
    return {
      valid: false,
      newPercentage,
      error: `Compra de ${quantity} ${ticker} levaria a ${newPercentage.toFixed(1)}% da carteira (máx: ${maxPct}%)`,
      suggestion: `Reduza para ${maxQty} cotas`,
      maxQty,
    };
  }

  return { valid: true, newPercentage };
}

/**
 * Bloco de concentração pré-calculado para o prompt: peso atual de cada ativo e
 * quanto ainda cabe comprar (em R$) antes de estourar o teto de maxPerAsset%.
 * É a aplicação programática do validateConcentration aos dados da carteira —
 * a IA recebe os números prontos e é obrigada a exibir a linha de validação.
 */
function buildConcentrationBlock(assets, totalValue) {
  const maxPct = KRAKEN_CRITERIA.allocation.maxPerAsset;
  if (!(totalValue > 0) || !(assets ?? []).length) return [];

  const f = maxPct / 100;
  const lines = [
    `### Validação de concentração (teto: ${maxPct}% por ativo) — PRÉ-CALCULADO, USO OBRIGATÓRIO`,
    `| Ativo | Peso atual | Margem p/ compra até ${maxPct}% | Status |`,
    '|-------|-----------:|------------------------------:|--------|',
  ];

  const over = [];
  for (const a of assets) {
    const weight = (a.totalValue / totalValue) * 100;
    // Máximo X em R$ comprável: (valor + X) / (total + X) = f  →  X = (f·total − valor) / (1 − f)
    const headroom = Math.max(0, (f * totalValue - a.totalValue) / (1 - f));
    const status   = weight > maxPct ? `🚨 JÁ ACIMA de ${maxPct}% — NÃO comprar; recomendar redução` : '✅ ok';
    if (weight > maxPct) over.push(a.ticker);
    lines.push(`| ${a.ticker} | ${weight.toFixed(1)}% | ${fmtBRL(headroom)} | ${status} |`);
  }

  lines.push('');
  lines.push(`REGRAS DE CONCENTRAÇÃO (OBRIGATÓRIAS):`);
  lines.push(`- TODA recomendação de compra DEVE terminar com a linha: "✅ Validação: Concentração resultante = X,X% (máx: ${maxPct}%)" — calcule X usando a tabela acima: (valor atual do ativo + valor da compra) ÷ (patrimônio total + valor da compra).`);
  lines.push(`- Se a quantidade recomendada ultrapassar a margem da tabela, AJUSTE a quantidade para caber no teto (e diga que ajustou) ou DELETE a recomendação. NUNCA recomende compra que estoure ${maxPct}%.`);
  if (over.length) {
    lines.push(`- ⚠️ ATENÇÃO: ${over.join(', ')} já está(ão) acima do teto de ${maxPct}% — inclua alerta de concentração e avalie recomendação de redução parcial.`);
  }
  lines.push('');
  return lines;
}

function avgBuyPrices(lancamentos) {
  const map = {};
  for (const op of (lancamentos ?? []).filter(l => l.category === 'operacao' && l.type === 'compra')) {
    const t = op.ticker;
    if (!map[t]) map[t] = { totalCost: 0, totalQty: 0 };
    map[t].totalCost += (op.total ?? op.price * op.quantity) || 0;
    map[t].totalQty  += op.quantity || 0;
  }
  const result = {};
  for (const [t, v] of Object.entries(map))
    result[t] = v.totalQty > 0 ? v.totalCost / v.totalQty : null;
  return result;
}

function proventosByTicker(lancamentos) {
  const map = {};
  for (const p of (lancamentos ?? []).filter(l => l.category === 'provento'))
    map[p.ticker] = (map[p.ticker] ?? 0) + (p.amount || 0);
  return map;
}

export function buildPrompt({ assets, lancamentos, currentAllocation, categoryValues, totalValue, dailyPnL }) {
  const buyPrices = avgBuyPrices(lancamentos);
  const proventos = proventosByTicker(lancamentos);
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const lines = [
    `## Dados da Carteira — ${now}`,
    '',
    `> **Data de hoje:** ${today}. Quando precisar de cotação atual (BTC, câmbio, Selic, IPCA), confirme via web_search que a fonte é desta semana. Não reproduza datas específicas de fontes antigas — escreva "atualmente" com o valor mais recente. Todo conteúdo em pt-BR.`,
    '',
    `**Patrimônio total:** ${fmtBRL(totalValue)}`,
    `**Variação do dia:** ${fmtBRL(dailyPnL)} (${fmtPct(totalValue > 0 ? (dailyPnL / Math.max(totalValue - dailyPnL, 1)) * 100 : 0)})`,
    '',
  ];

  // Alocação vs modelo (categorias mais desviadas primeiro)
  const sortedCats = Object.keys(KRAKEN_MODEL).sort((a, b) => {
    const devA = (currentAllocation?.[a] ?? 0) - KRAKEN_MODEL[a];
    const devB = (currentAllocation?.[b] ?? 0) - KRAKEN_MODEL[b];
    return devA - devB;
  });

  lines.push('### Alocação atual vs Modelo Kraken');
  lines.push('| Categoria | Atual | Meta | Desvio | Valor |');
  lines.push('|-----------|------:|-----:|-------:|------:|');
  for (const cat of sortedCats) {
    const target  = KRAKEN_MODEL[cat];
    const current = currentAllocation?.[cat] ?? 0;
    const value   = categoryValues?.[cat] ?? 0;
    const diff    = current - target;
    lines.push(`| ${cat} | ${current.toFixed(1)}% | ${target}% | ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% | ${fmtBRL(value)} |`);
  }
  lines.push('');

  // Ativos individuais
  if ((assets ?? []).length > 0) {
    lines.push('### Ativos na carteira');
    lines.push('| Ativo | Categoria | Qtd | Preço atual | PM compra | Retorno s/ PM | Peso | Var. dia | Proventos recebidos |');
    lines.push('|-------|-----------|----:|------------:|----------:|:-------------:|-----:|---------:|--------------------:|');
    for (const a of assets) {
      const pm      = buyPrices[a.ticker];
      const pmStr   = pm != null ? fmtBRL(pm) : '—';
      const retStr  = pm != null && pm > 0 ? fmtPct(((a.price - pm) / pm) * 100) : '—';
      const provStr = proventos[a.ticker] != null ? fmtBRL(proventos[a.ticker]) : '—';
      const weight  = totalValue > 0 ? ((a.totalValue / totalValue) * 100).toFixed(1) + '%' : '—';
      lines.push(`| ${a.ticker} | ${a.type} | ${(a.shares ?? 0).toLocaleString('pt-BR')} | ${fmtBRL(a.price)} | ${pmStr} | ${retStr} | ${weight} | ${fmtPct(a.changePercent ?? 0)} | ${provStr} |`);
    }
    lines.push('');
  }

  // Validação de concentração por ativo (teto maxPerAsset%) — pré-calculada
  lines.push(...buildConcentrationBlock(assets, totalValue));

  // Categorias zeradas
  const missingCats = Object.keys(KRAKEN_MODEL).filter(cat => !(assets ?? []).some(a => a.type === cat));
  if (missingCats.length)
    lines.push(`**Categorias zeradas:** ${missingCats.join(', ')}`, '');

  // Progresso de quantidade por categoria (alvos fixos 7/5/2, RF flexível)
  const catCounts = {};
  for (const a of assets ?? []) catCounts[a.type] = (catCounts[a.type] ?? 0) + 1;
  lines.push('### Progresso de quantidade por categoria (alvo FIXO — não é faixa)');
  lines.push('| Categoria | Atual | Alvo | Situação |');
  lines.push('|-----------|------:|------|----------|');
  for (const [cat, lim] of Object.entries(ASSET_COUNT_LIMITS)) {
    const n = catCounts[cat] ?? 0;
    const alvo = lim.exact ? `${lim.max}` : `${lim.min}-${lim.max}`;
    let situacao;
    if (n < lim.min)      situacao = `⬆️ faltam ${lim.min - n} ativo(s) novo(s)`;
    else if (n > lim.max) situacao = `⬇️ ${n - lim.max} acima do alvo — avaliar consolidação`;
    else                  situacao = '✅ no alvo';
    lines.push(`| ${cat} | ${n} | ${alvo} | ${situacao} |`);
  }
  lines.push('');

  // Renda passiva histórica
  const provAll = (lancamentos ?? []).filter(l => l.category === 'provento');
  const cutoff12m = new Date();
  cutoff12m.setFullYear(cutoff12m.getFullYear() - 1);
  const total12m = provAll.filter(p => new Date(p.date) >= cutoff12m).reduce((s, p) => s + (p.amount || 0), 0);
  if (provAll.length > 0) {
    const totalHist = provAll.reduce((s, p) => s + (p.amount || 0), 0);
    lines.push('### Renda passiva recebida');
    lines.push(`- Total histórico: ${fmtBRL(totalHist)}`);
    lines.push(`- Últimos 12 meses: ${fmtBRL(total12m)}`);
    lines.push(`- Média mensal (12m): ${fmtBRL(total12m / 12)}`);
    lines.push(`- Yield anual s/ patrimônio: ${totalValue > 0 ? ((total12m / totalValue) * 100).toFixed(2) : '0.00'}%`);
    lines.push('');
  }

  // Gap rumo à meta de longo prazo (pré-calculado — usar estes números, não inventar)
  const metaMensal      = C.targets.monthlyPassiveIncome;
  const patrimonioAlvo  = (metaMensal * 12) / (C.targets.dyPortfolio / 100);
  const rendaMensalAtual = total12m / 12;
  lines.push('### Rumo à meta de longo prazo (PRÉ-CALCULADO — usar estes números)');
  lines.push(`- Meta: ${fmtBRL(metaMensal)}/mês de renda passiva em ${C.targets.horizonYears} anos (DY alvo ${C.targets.dyPortfolio}% a.a.)`);
  lines.push(`- Patrimônio-alvo estimado: ${fmtBRL(patrimonioAlvo)}`);
  lines.push(`- Patrimônio atual: ${fmtBRL(totalValue)} (${patrimonioAlvo > 0 ? ((totalValue / patrimonioAlvo) * 100).toFixed(1) : '0.0'}% do caminho)`);
  lines.push(`- Renda passiva mensal atual (média 12m): ${fmtBRL(rendaMensalAtual)} (${metaMensal > 0 ? ((rendaMensalAtual / metaMensal) * 100).toFixed(1) : '0.0'}% da meta)`);
  lines.push(`- Gap de patrimônio: ${fmtBRL(Math.max(0, patrimonioAlvo - totalValue))}`);
  lines.push('');

  // Instrução de análise — ANÁLISE IA v3.0 com ORDEM OBRIGATÓRIA
  lines.push('---', '');
  lines.push('## ANÁLISE IA v3.0 — MENTOR KRAKEN', '');
  lines.push('⚡ ORDEM DE EXECUÇÃO OBRIGATÓRIA (NÃO PULE ETAPAS):', '');
  lines.push('', '');

  lines.push('### [ETAPA 1] ANÁLISE COMPLETA DA CARTEIRA ATUAL (DINÂMICA)', '');
  lines.push('Analise TODOS os ativos que existem na carteira NESTE MOMENTO. A análise é dinâmica — sempre adapta-se aos ativos atuais.', '');
  lines.push('Para CADA ativo listado acima, faça:', '');
  lines.push('- **Nome do ativo** (ex: TRXF11, HGLG11, BBSE3, BTC)', '');
  lines.push('- **Tipo:** FII | Ação | ETF | Renda Fixa | Cripto', '');
  lines.push('- **Dados Fundamentalistas (pesquise via web_search ou use dados de treinamento com 📌):**', '');
  lines.push('  - Para FIIs: P/VP, DY anualizado, Vacância física, Liquidez diária, Segmento', '');
  lines.push('  - Para Ações: P/L, P/VP, ROE (%), DY, Dívida Líquida/EBITDA, Setor', '');
  lines.push('  - Para Cripto: Preço atual em BRL, Volatilidade (% mês), Tendência', '');
  lines.push('- **Condição atual:** Bom | Fraco | Neutro', '');
  lines.push('- **🔍 Riscos ocultos:** investigue ATIVAMENTE os sinais de alerta da seção "DETECÇÃO DE RISCOS OCULTOS" do system prompt (value trap por P/L ou P/VP baixo demais, DY alto demais e por quê, dívida/vacância subindo, liquidez caindo, divergência do benchmark). Liste TODOS os encontrados — não esconda nada. Se não houver, escreva "Nenhum risco relevante detectado".', '');
  lines.push(`- **🏦 Risco de solvência (obrigatório):** pesquise via web_search a saúde financeira e o endividamento (Ações: Dívida líq./EBITDA, prejuízos trimestrais, RJ/rating; FIIs: RJ de inquilinos relevantes, alavancagem sobre o PL) no cenário de Selic ~14,5%. Emita a linha **"Risco de solvência: ${C.solvency.ratingLevels.join(' / ')}"** com justificativa em 1 frase. Aplique os critérios de eliminação por insolvência do system prompt.`, '');
  lines.push('- **✅ VEREDITO (obrigatório):** escolha UMA opção em negrito — **✅ COMPRAR** | **⚠️ MANTER** | **❌ VENDER** | **🤔 CONSIDERE** — e justifique em 1 frase com dados.', '');
  lines.push('', '');

  lines.push('### [ETAPA 2] RELATÓRIO DE CONDIÇÃO ATUAL', '');
  lines.push('DEPOIS de analisar todos os ativos, faça um resumo geral:', '');
  lines.push('- **Carteira está saudável ou fraca?** Justifique com dados.', '');
  lines.push(`- **DY atual vs meta:** compare com a meta de ${C.targets.dyPortfolio}% a.a. Está acima ou abaixo?`, '');
  lines.push('- **Diversificação:** está bem distribuída ou concentrada?', '');
  lines.push('- **Rentabilidade geral:** está bom ou fraco?', '');
  lines.push('- **Riscos principais:** identifique os 2-3 maiores riscos detectados', '');
  lines.push('', '');

  lines.push('### [ETAPA 3] RECOMENDAÇÕES (VENDA + COMPRA)', '');
  lines.push('SOMENTE APÓS as etapas 1 e 2, faça recomendações:', '');
  lines.push('', '');
  lines.push('#### [3A] RECOMENDAÇÕES DE VENDA (se houver)', '');
  lines.push('Para cada ativo recomendado para venda:', '');
  lines.push('- **Ativo a vender:** [Nome específico]', '');
  lines.push('- **Motivo:** [Problema identificado + dados concretos]', '');
  lines.push('- **Quando:** Imediato | Aguarde recuperação | Com limite de perda', '');
  lines.push('', '');

  lines.push('#### [3B] RECOMENDAÇÕES DE COMPRA (ESPECÍFICAS, NÃO GENÉRICAS)', '');
  lines.push('💰 FILA DE PRIORIDADE OBRIGATÓRIA: o capital vem de aportes mensais de valor VARIÁVEL (vendas passadas foram reinvestidas fora — não há caixa). Ordene TODAS as compras como fila de prioridade explícita (🥇 1º comprar / 🥈 2º / 🥉 3º...) que funcione para qualquer valor de aporte. Priorize: (1) categorias mais distantes da quantidade-alvo (ver tabela "Progresso de quantidade"), (2) categorias mais abaixo da alocação-alvo. Enquanto a categoria estiver abaixo da quantidade-alvo, prefira ativo NOVO qualificado a reforçar posição existente.', '');
  lines.push('⚖️ **Rebalanceamento NÃO é automático.** A meta de alocação é um GUIA (ver "MODELO É GUIA, NÃO LEI" no system prompt). Pondere: rebalancear (comprar a categoria mais abaixo da meta) É a preferência — MAS se houver uma oportunidade nitidamente superior num ativo de qualidade de uma categoria já na meta, recomende-a e explique o trade-off (quanto afasta da meta e por que compensa). Nunca recomende algo medíocre só para fechar porcentagem — se a categoria subponderada não tiver boa opção agora, diga para aguardar.', '');
  lines.push('⚡ CRÍTICO: Identifique PRIMEIRO quais são os MELHORES SETORES/SEGMENTOS neste momento, então recomende QUANTIDADE DIFERENTE baseada na qualidade:', '');
  lines.push('- Setor EXCELENTE: recomende 2-3 ativos', '');
  lines.push('- Setor BOM: recomende 1-2 ativos', '');
  lines.push('- Setor FRACO: recomende 0 ativos (salte esse setor)', '');
  lines.push('', '');
  lines.push('Para CADA ativo recomendado:', '');
  lines.push('- **Nome do ativo:** [específico, ex: TRXF11 ou VULC3, não "um FII" ou "uma ação"]', '');
  lines.push('- **Tipo:** FII | Ação | ETF | Renda Fixa | Cripto', '');
  lines.push('- **Setor/Segmento:** [ex: Varejo, Logística, Banco, Energia, etc]', '');
  lines.push('- **Ranking do setor:** 1º melhor | 2º | 3º [para validar diversificação inteligente]', '');
  lines.push('- **Dados Fundamentalistas:** P/VP: X | DY: X% | P/L: X | ROE: X% | etc (com pesquisa web_search)', '');
  lines.push('- **Por quê é bom:** [argumentação concreta com dados, NÃO genérica]', '');
  lines.push('- **Quantidade:** X cotas [quantidade específica, NÃO "alguns" ou "quanto puder"]', '');
  lines.push(`- **✅ Validação (OBRIGATÓRIA):** "Concentração resultante = X,X% (máx: ${C.allocation.maxPerAsset}%)" — use a tabela de validação de concentração acima; se ultrapassar, ajuste a quantidade ou descarte. Confirme também que a categoria continua dentro da QUANTIDADE-ALVO (ex: comprar um FII novo só se a carteira ficar com no máximo ${C.allocation.fiis.count} FIIs).`, '');
  lines.push('', '');

  lines.push('#### [3C] TROCAS / UPGRADES DE CARTEIRA (vender um ativo para comprar outro MELHOR)', '');
  lines.push('🔒 O ativo-ALVO da troca DEVE passar em TODOS os critérios mínimos da categoria (P/VP, DY, ROE, etc.) e não bater nenhum critério de eliminação. Não existe troca para um ativo que não se encaixa nas regras, por melhor que pareça a "oportunidade".', '');
  lines.push('🔄 Conecte venda + compra quando fizer sentido. Se um ativo que o investidor JÁ TEM é apenas mediano (veredito ⚠️ MANTER ou pior) E existe uma alternativa CLARAMENTE SUPERIOR (e qualificada) na MESMA categoria, recomende uma TROCA explícita: "venda X → compre Y". Mas siga regras rígidas para NÃO gerar giro desnecessário:', '');
  lines.push('- **Qualidade DURADOURA, não momentânea:** o ativo novo precisa ser superior de forma SUSTENTÁVEL no longo prazo — fundamentos consistentes ao longo de ANOS (histórico de DY, vacância, P/VP, ROE no tempo), vantagem competitiva real e gestão comprovada. NÃO recomende trocar por algo que só está barato/quente neste mês. Verifique o histórico, não um único trimestre.', '');
  lines.push('- **A melhora precisa COMPENSAR os custos da troca:** ao vender, considere o IR sobre o lucro (se houver ganho — informe o valor estimado), corretagem/spread e o tempo fora do mercado. Só recomende a troca se o upgrade for grande o bastante para superar esses custos. Proventos de FIIs e vendas de ações até R$20k/mês são isentos — use isso a favor.', '');
  lines.push('- **NÃO troque um ativo BOM (✅) por um marginalmente melhor.** Trocas só valem para sair de algo medíocre rumo a algo NITIDAMENTE superior. Vantagem pequena NÃO justifica giro — nesse caso, mande manter.', '');
  lines.push('- **Formato da troca:** "🔄 VENDER [X] (motivo: fraco em tal indicador, com número) → COMPRAR [Y]". Mostre o impacto líquido esperado com números (ex: "DY sobe de 8% para 11%, P/VP cai de 1,10 para 0,90; custo de IR estimado ~R$X; mesma categoria, então não desbalanceia").', '');
  lines.push('- Se NÃO houver nenhuma troca que realmente valha a pena, escreva "Nenhuma troca recomendada agora" — nunca invente uma só para parecer ativo.', '');
  lines.push('', '');

  lines.push('### [ETAPA 4] PLANO RUMO À META (R$ ' + C.targets.monthlyPassiveIncome.toLocaleString('pt-BR') + '/mês aos 60 anos)', '');
  lines.push('Feche a análise conectando o hoje com a meta de longo prazo, usando os números PRÉ-CALCULADOS da seção "Rumo à meta":', '');
  lines.push('- **Onde estou:** patrimônio atual, renda passiva mensal atual e % do caminho percorrido', '');
  lines.push('- **Gap:** quanto falta de patrimônio e de renda mensal', '');
  lines.push(`- **Plano de convergência:** roteiro priorizado para chegar às quantidades-alvo (${C.allocation.fiis.count} FIIs, ${C.allocation.acoes.count} ações, ${C.allocation.etfs.count} ETFs, ${C.allocation.rendaFixa.min}-${C.allocation.rendaFixa.max} RF, ${C.allocation.cripto.count} cripto) e à alocação ${C.allocation.fiis.target}/${C.allocation.acoes.target}/${C.allocation.rendaFixa.target}/${C.allocation.etfs.target}/${C.allocation.cripto.target} — em FILA DE PRIORIDADE válida para qualquer valor de aporte`, '');
  lines.push('- **Lacunas críticas primeiro:** ataque as categorias mais distantes do alvo de quantidade e de alocação', '');
  lines.push('- **Ritmo:** estime em % a.a. quanto a carteira precisa crescer (aportes + reinvestimento de proventos) para cumprir o horizonte — SEM assumir valor fixo de aporte', '');
  lines.push('', '');

  lines.push('---', '');
  lines.push('## INSTRUÇÕES DETALHADAS', '');
  lines.push('', '');
  lines.push('1. **Contexto macro:** Busque via web_search a taxa Selic atual (meta COPOM) e IPCA 12m. Com Selic, calcule DY mín para FIIs = Selic − 4%. Pesquise também USD/BRL e BTC/BRL.', '');
  lines.push('2. **Análise de ativos:** TODOS os que existem NA CARTEIRA (dinâmico). Para cada um, aplique critérios Kraken com números concretos.', '');
  lines.push('3. **Renda Fixa especial:** Se abaixo da meta, busque via web_search as MELHORES LCI/LCA disponíveis HOJE (taxas reais, prazo, banco, FGC). Exija mín 100% CDI.', '');
  lines.push('4. **Recomendações:** Nomes específicos, quantidades específicas, dados reais. NÃO genérico.', '');
  lines.push('5. **Diversificação inteligente:** Prioriza qualidade sobre quantidade fixa. Pode ter 0 de setor fraco, 2-3 do melhor.', '');

  return lines.join('\n');
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Handler Edge ──────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const userPrompt = buildPrompt(body ?? {});

  // ── Busca dados macro reais antes de chamar a IA ───────────────────────────
  const macro = await fetchMacroViaHttp();
  console.log('[macro] dados buscados:', macro);
  const finalSystemPrompt = buildMacroBlock(macro) + SYSTEM_PROMPT;

  // ── Chamada Anthropic com streaming + web_search ───────────────────────────
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'content-type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-5',
      max_tokens: 16000,
      system:     finalSystemPrompt,
      tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
      messages:   [{ role: 'user', content: userPrompt }],
      stream:     true,
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    let parsed;
    try { parsed = JSON.parse(errText); } catch { parsed = null; }

    const apiType    = parsed?.error?.type    ?? null;
    const apiMessage = parsed?.error?.message ?? errText ?? '';
    const lowerMsg   = apiMessage.toLowerCase();

    // Map Anthropic error types/messages → friendly Portuguese messages
    let friendly;
    let billingLink = false;

    if (lowerMsg.includes('credit balance') || lowerMsg.includes('insufficient') || lowerMsg.includes('billing')) {
      friendly    = 'Créditos da API Anthropic insuficientes. Adicione fundos em console.anthropic.com/settings/billing para continuar usando o Mentor Kraken.';
      billingLink = true;
    } else if (apiType === 'authentication_error' || anthropicRes.status === 401) {
      friendly = 'Chave API Anthropic inválida ou expirada. Verifique a variável ANTHROPIC_API_KEY no painel da Vercel.';
    } else if (apiType === 'permission_error' || anthropicRes.status === 403) {
      friendly = 'Permissão negada pela API Anthropic. Verifique se sua chave tem acesso ao modelo solicitado.';
    } else if (apiType === 'rate_limit_error' || anthropicRes.status === 429) {
      friendly = 'Limite de requisições da API Anthropic atingido. Aguarde alguns minutos e tente novamente.';
    } else if (apiType === 'overloaded_error' || anthropicRes.status === 529) {
      friendly = 'A API Anthropic está temporariamente sobrecarregada. Tente novamente em 1 minuto.';
    } else if (apiType === 'not_found_error' || anthropicRes.status === 404) {
      friendly = `Recurso não encontrado na API Anthropic. ${apiMessage}`;
    } else if (apiType === 'api_error' || anthropicRes.status >= 500) {
      friendly = `Erro interno da API Anthropic. ${apiMessage} — tente novamente em alguns instantes.`;
    } else if (apiMessage) {
      // Fallback: surface the raw API message instead of "Anthropic API 400"
      friendly = `Erro da API Anthropic (${apiType ?? anthropicRes.status}): ${apiMessage}`;
    } else {
      friendly = `Erro da API Anthropic (status ${anthropicRes.status}). Resposta vazia.`;
    }

    return new Response(JSON.stringify({
      error:        friendly,
      billingLink,
      apiType,
      apiStatus:    anthropicRes.status,
      apiMessage,
    }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── Transform Anthropic SSE → client SSE (text deltas only) ───────────────
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader  = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   inputTokens  = 0;
      let   outputTokens = 0;
      let   model        = 'claude-opus-4-5';

      const send = (obj) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline SSE boundaries
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            // Extract the data: line from the SSE message
            const dataLine = part.split('\n').find(l => l.startsWith('data: '));
            if (!dataLine) continue;

            const raw = dataLine.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            let evt;
            try { evt = JSON.parse(raw); } catch { continue; }

            if (evt.type === 'message_start') {
              model       = evt.message?.model ?? model;
              inputTokens = evt.message?.usage?.input_tokens ?? 0;
            }

            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              const text = evt.delta.text ?? '';
              if (text) send({ text });
            }

            if (evt.type === 'message_delta') {
              outputTokens = evt.usage?.output_tokens ?? 0;
            }

            if (evt.type === 'message_stop') {
              send({ done: true, model, inputTokens, outputTokens, analyzedAt: new Date().toISOString() });
            }
          }
        }
      } catch (err) {
        send({ error: err?.message ?? 'Erro no streaming da análise.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      ...CORS,
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
