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

export const config = { runtime: 'edge' };

// ── Modelo de alocação Kraken ─────────────────────────────────────────────────
const KRAKEN_MODEL = {
  'FIIs':       40,
  'Ações':      25,
  'Renda Fixa': 20,
  'ETFs':       10,
  'Cripto':      5,
};

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
const SYSTEM_PROMPT = `Você é o **Mentor Kraken** — analista fundamentalista pessoal de investimentos com foco em renda passiva crescente e preservação de patrimônio real.

## REGRAS OBRIGATÓRIAS (NÃO NEGOCIÁVEIS)

1. **DADOS EM TEMPO REAL:** ao buscar preços de mercado (BTC, USD/BRL, FIIs, Selic, IPCA), SEMPRE verifique a data da fonte retornada pela web_search. Se a fonte for de mais de 3 dias atrás, refaça a busca com termos diferentes ("hoje", "agora", data atual). NUNCA reproduza datas específicas do tipo "em 11 de maio de 2026 o preço era X" — escreva sempre **"atualmente"**, **"hoje"** ou **"no momento"** com o valor mais recente confirmado. Se não encontrar fonte recente, declare explicitamente: "não foi possível confirmar o valor mais recente — verifique no [fonte]".

2. **CONSISTÊNCIA INTERNA:** use o MESMO valor para cada indicador em TODA a análise. Se decidiu que a Selic está em 14,75%, mantenha 14,75% em todas as seções. Se o CDI é 14,40%, é 14,40% no documento inteiro. NUNCA contradiga valores entre seções (ex: dizer "CDI a 14,40%" no diagnóstico e "CDI a 14,65%" na recomendação é proibido). Antes de finalizar, releia mentalmente e confirme que todos os números batem.

3. **IDIOMA — PORTUGUÊS DO BRASIL:** TODO o conteúdo da resposta deve ser em pt-BR. Se uma fonte de web_search retornar conteúdo em inglês (ex: "The live Bitcoin price today is..."), TRADUZA antes de incluir. NUNCA faça copy-paste de trechos em inglês, espanhol ou qualquer outro idioma. Símbolo monetário sempre R$ (não US$ ou $ sem contexto), salvo quando explicitamente comparando moedas — nesse caso traduza e formate corretamente.

4. **PRODUTOS ESPECÍFICOS DE RENDA FIXA:** ao recomendar LCAs, CDBs, LCIs ou Tesouro, NUNCA invente vencimentos, emissores ou taxas específicas como se tivesse certeza absoluta de disponibilidade. Use **FAIXAS** ("buscar LCA entre 85–92% CDI com prazo 2–4 anos") e SEMPRE adicione o disclaimer: *"Verifique disponibilidade, taxa atual e prazo no seu banco/corretora antes de investir — a oferta muda diariamente."* Pode mencionar emissores típicos (Itaú, BB, Sicoob, Sicredi) como exemplo, mas sem afirmar que um produto específico existe agora.

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
| Categoria   | Meta |
|-------------|------|
| FIIs        | 40%  |
| Ações       | 25%  |
| Renda Fixa  | 20%  |
| ETFs        | 10%  |
| Cripto       | 5%  |

**Princípios:**
1. Comprar ativos de qualidade comprovada, nunca especular
2. Preferir empresas/fundos que pagam dividendos consistentes e crescentes
3. Rebalancear sempre COMPRANDO a categoria mais abaixo da meta — nunca vender o que está bem para rebalancear
4. Diversificação real: no máximo 10% do patrimônio em um único ativo
5. Considerar IR: ações mantidas > 12 meses isentas até R$20k/mês de ganho de capital; proventos de FIIs são isentos de IR para PF

---

## REGRAS FUNDAMENTALISTAS POR CATEGORIA

### FIIs (Fundos Imobiliários) — Meta: 40%
**Critérios mínimos para compra:**
- P/VP < 1,10 (ideal < 0,95 = margem de segurança real)
- Dividend Yield anualizado ≥ (Selic atual − 4%) — regra dinâmica: busque a Selic atual antes de calcular. Exemplos: Selic 14,5% → DY mín 10,5% | Selic 12% → DY mín 8% | Selic 10% → DY mín 6%
- Vacância física < 10% (logística/lajes); < 5% idealmente
- Gestão com histórico de DY estável ou crescente (mínimo 2 anos)
- Liquidez diária > R$1 milhão
- Portfólio diversificado (evitar single-asset ou single-tenant)

**Critérios de eliminação (NÃO comprar se):**
- P/VP > 1,30
- Vacância > 15%
- DY < 6% (sinal de amortização, não renda real)
- Histórico de diluições abusivas
- Fundo com < 2 anos de histórico

**Segmentos preferidos:** Logística > Lajes Corporativas > Shopping > Híbrido > CRI/CRA

### Ações Brasileiras — Meta: 25%
**Critérios mínimos para compra:**
- P/L < 15 (máx 20 para crescimento comprovado)
- P/VP < 3,0 (< 2,0 para setores cíclicos)
- ROE ≥ 15% ao ano (consistente nos últimos 3 anos)
- Dividend Yield ≥ 5% ao ano
- Dívida Líquida/EBITDA < 3,0 (< 2,0 para não-financeiro)
- Margem líquida > 10%
- Payout estável ou crescente, nunca > 100% do lucro recorrente

**Critérios de eliminação:**
- P/L negativo ou > 25
- ROE < 10% nos últimos 2 anos
- Dívida/EBITDA > 4,0
- Sem dividendos nos últimos 3 anos (exceto reinvestimento comprovado)
- Envolvida em escândalos contábeis recentes

**Setores preferidos:** Energia Elétrica > Bancos Grandes > Telecom > Saneamento > Agronegócio exportador

### ETFs — Meta: 10%
- BOVA11: Ibovespa, taxa 0,10% a.a. — principal ETF nacional
- IVVB11: S&P 500 em BRL (hedge de dólar) — diversificação internacional
- Taxa máxima: 0,50% a.a.
- Liquidez diária > R$5 milhões
- Nunca vender em quedas; aumentar aportes em correções > 15%

### Renda Fixa — Meta: 20%

**Regra absoluta:** NUNCA sugerir ativo abaixo de 100% do CDI/Selic. Sem exceções.

**Hierarquia de prioridade:**
1. **LCI / LCA ≥ 100% CDI** — isenta de IR para PF → prioridade máxima
2. **CDB ≥ 100% CDI** de banco Tier 1 (Itaú, Bradesco, Santander, BB, CEF) ou ≥ 110% CDI de bancos médios cobertos pelo FGC
3. **Tesouro IPCA+** mínimo IPCA + 5,5% a.a. (vencimento > 5 anos) — excelente para proteção contra inflação de longo prazo
4. **Tesouro Selic** — reserva de emergência/liquidez

**Busca obrigatória:** Pesquise via web_search as melhores LCI/LCA disponíveis hoje no mercado (Riqueza, XP, NuInvest, Rico, BTG, Itaú). Informe taxas reais encontradas, prazo, banco emissor e cobertura FGC. Se não encontrar LCI/LCA ≥ 100% CDI disponíveis, procure CDB ≥ 110% CDI de banco médio coberto pelo FGC.

**Evitar:** CDBs de fintechs sem rating publicado, debêntures de emissores desconhecidos, qualquer produto < 100% CDI.

### Cripto — Meta: 5%
- Apenas Bitcoin (BTC) — sem altcoins
- DCA mensal, independente do preço
- Nunca vender em quedas; só vender se posição superar 7% do patrimônio
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
- **Use números concretos.** Nunca diga "o P/VP está razoável" — diga "P/VP = 1,12, acima do limite de 1,10".
- **Sinalize dados de treinamento.** Quando um indicador for do seu treinamento (não tempo real), adicione 📌 e oriente a verificação.
- **Nunca omita riscos.** Mencione os principais riscos de cada recomendação.
- **Seja específico.** Recomende UM ativo específico por categoria, não uma lista genérica.
- **Considere IR.** Alerte quando uma venda pode gerar imposto e se vale esperar.
- **Tom:** mentor experiente e direto, não robô de relatório. Fale como um amigo que entende de finanças.`;

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtBRL = v =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = v => `${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}%`;

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

function buildPrompt({ assets, lancamentos, currentAllocation, categoryValues, totalValue, dailyPnL }) {
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

  // Categorias zeradas
  const missingCats = Object.keys(KRAKEN_MODEL).filter(cat => !(assets ?? []).some(a => a.type === cat));
  if (missingCats.length)
    lines.push(`**Categorias zeradas:** ${missingCats.join(', ')}`, '');

  // Renda passiva histórica
  const provAll = (lancamentos ?? []).filter(l => l.category === 'provento');
  if (provAll.length > 0) {
    const cutoff12m = new Date();
    cutoff12m.setFullYear(cutoff12m.getFullYear() - 1);
    const total12m  = provAll.filter(p => new Date(p.date) >= cutoff12m).reduce((s, p) => s + (p.amount || 0), 0);
    const totalHist = provAll.reduce((s, p) => s + (p.amount || 0), 0);
    lines.push('### Renda passiva recebida');
    lines.push(`- Total histórico: ${fmtBRL(totalHist)}`);
    lines.push(`- Últimos 12 meses: ${fmtBRL(total12m)}`);
    lines.push(`- Média mensal (12m): ${fmtBRL(total12m / 12)}`);
    lines.push(`- Yield anual s/ patrimônio: ${totalValue > 0 ? ((total12m / totalValue) * 100).toFixed(2) : '0.00'}%`);
    lines.push('');
  }

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
  lines.push('- **Problemas identificados:** (vacância alta, dívida crescente, notícias ruins, prejuízo, etc)', '');
  lines.push('', '');

  lines.push('### [ETAPA 2] RELATÓRIO DE CONDIÇÃO ATUAL', '');
  lines.push('DEPOIS de analisar todos os ativos, faça um resumo geral:', '');
  lines.push('- **Carteira está saudável ou fraca?** Justifique com dados.', '');
  lines.push('- **DY atual vs meta:** compare com 11% da meta. Está acima ou abaixo?', '');
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
