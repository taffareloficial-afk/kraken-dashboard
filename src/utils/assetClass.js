/**
 * assetClass — classificador único de ativos por ticker.
 *
 * Resolve o bug em que QUALQUER ticker terminado em "11" era tratado como FII,
 * classificando errado ETFs (BOVA11, IVVB11) e ações-unit (TAEE11).
 *
 * Ordem de prioridade:
 *   1. Renda Fixa  — assetType explícito ou ticker com CDB/LCI/LCA/LFT/TESOURO…
 *   2. Cripto      — assetType explícito ou ticker na lista de criptos
 *   3. ETF         — assetType explícito ou ticker na whitelist de ETFs
 *   4. Termina em 11:
 *        • na lista de ações-unit (TAEE11 etc.) → Ação
 *        • caso contrário                        → FII
 *   5. Padrão LLLLN (4 letras + nº, ex: PETR4) → Ação
 *
 * Retorna rótulos canônicos: 'FII' | 'ETF' | 'Ação' | 'Renda Fixa' | 'Cripto'.
 */

// ETFs brasileiros conhecidos (terminam em 11 mas NÃO são FIIs)
export const ETF_TICKERS = new Set([
  'BOVA11', 'IVVB11', 'SMAL11', 'HASH11', 'GOLD11', 'XFIX11', 'BOVV11',
  'DIVO11', 'FIND11', 'PIBB11', 'SPXI11', 'ACWI11', 'NASD11', 'QBTC11',
  'ECOO11', 'BOVB11', 'IB5M11', 'EURP11', 'TECK11', 'USTK11', 'WRLD11',
  'ESGB11', 'NDIV11', 'ISUS11', 'GOVE11', 'FIXA11', 'B5P211', 'IRFM11',
  'IMAB11', 'XINA11', 'MATB11', 'ETHE11', 'BITH11', 'CRPT11',
]);

// Ações / Units (UNT) que terminam em 11 mas NÃO são FIIs nem ETFs
export const STOCK_UNITS_11 = new Set([
  'TAEE11', 'SANB11', 'KLBN11', 'BPAC11', 'ENGI11', 'IGTI11', 'SAPR11',
  'ALUP11', 'RNEW11', 'PINE11', 'BRBI11', 'AZEV11', 'TIET11', 'CASH11',
  'BIDI11', 'SULA11',
]);

// Criptomoedas
export const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'AVAX',
  'MATIC', 'LINK', 'LTC', 'USDT', 'USDC', 'SHIB', 'TRX', 'UNI',
]);

// Palavras-chave de Renda Fixa
const RF_REGEX = /(CDB|LCI|LCA|LFT|LF|RDB|LC|TESOURO|SELIC|IPCA|PREFIXADO|CRI|CRA|DEBENTURE|DEB)/i;

/**
 * Classifica um ticker. `assetType` (quando informado manualmente, ex: cadastro
 * de Renda Fixa ou ETF no formulário) tem prioridade sobre o padrão do ticker.
 * @returns {'FII'|'ETF'|'Ação'|'Renda Fixa'|'Cripto'}
 */
export function classifyTicker(ticker, assetType) {
  if (!ticker) return 'Ação';
  const t = String(ticker).toUpperCase().trim();

  // Normaliza assetType vindo do form/DB (aceita singular e plural)
  const at = assetType ? String(assetType).toLowerCase() : '';

  // 1. Renda Fixa
  if (at.includes('renda fixa') || RF_REGEX.test(t)) return 'Renda Fixa';

  // 2. Cripto
  if (at.includes('cripto') || at.includes('crypto') || CRYPTO_TICKERS.has(t)) return 'Cripto';

  // 3. ETF (whitelist ou assetType explícito)
  if (at === 'etf' || at === 'etfs' || at.includes('etf') || ETF_TICKERS.has(t)) return 'ETF';

  // 4. Termina em 11 (com sufixo B opcional, ex: XPLG11B)
  if (/11B?$/.test(t)) {
    return STOCK_UNITS_11.has(t.replace(/B$/, '')) ? 'Ação' : 'FII';
  }

  // 5. Padrão de ação brasileira: 4 letras + 1-2 números (PETR4, ITSA4, BBSE3)
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) return 'Ação';

  // Padrão
  return 'Ação';
}

/** Mapeia o rótulo canônico → convenção plural usada em adjustedPortfolio/KRAKEN_MODEL */
const TO_PLURAL = { 'FII': 'FIIs', 'ETF': 'ETFs', 'Ação': 'Ações' };
export function classifyTickerPlural(ticker, assetType) {
  const c = classifyTicker(ticker, assetType);
  return TO_PLURAL[c] ?? c; // 'Renda Fixa' e 'Cripto' permanecem iguais
}
