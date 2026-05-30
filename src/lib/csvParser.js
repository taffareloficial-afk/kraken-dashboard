/**
 * CSV Parser para importação de lançamentos do Investidor10
 *
 * Formato esperado (com BOM UTF-8):
 *   Data,Tipo,Ativo,Qtd,Valor Unit,Total
 *   30/05/2025,Compra,ITSA4,100,18.50,1850.00
 *   31/05/2025,Venda,PETR4,50,28.30,1415.00
 */

/**
 * Converte data dd/mm/aaaa → yyyy-mm-dd
 * @param {string} dateStr - Data em formato dd/mm/aaaa
 * @returns {string} Data em formato yyyy-mm-dd ou null se inválida
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  let day, month, year;

  // Formato yyyy-mm-dd (ex: 2025-09-15)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length !== 3) return null;
    [year, month, day] = parts.map(p => parseInt(p, 10));
  } else if (trimmed.includes('/')) {
    // Formato dd/mm/aaaa (ex: 30/05/2025)
    const parts = trimmed.split('/');
    if (parts.length !== 3) return null;
    [day, month, year] = parts.map(p => parseInt(p, 10));
  } else {
    return null;
  }

  // Validação básica
  if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  // Formatar como yyyy-mm-dd
  const dateObj = new Date(year, month - 1, day);
  const isValid = dateObj.getFullYear() === year &&
                  dateObj.getMonth() === month - 1 &&
                  dateObj.getDate() === day;

  if (!isValid) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Normaliza tipo de operação
 * @param {string} tipo - "Compra", "Venda", "Dividendo", "JCP", "Recebimento"
 * @returns {{tipo: string, category: string}} tipo normalizado + categoria
 */
function normalizeType(tipo) {
  if (!tipo) return null;

  const t = tipo.trim().toLowerCase();

  if (t === 'compra') return { tipo: 'compra', category: 'operacao' };
  if (t === 'venda') return { tipo: 'venda', category: 'operacao' };
  if (t === 'dividendo' || t === 'div' || t === 'dividendo') return { tipo: 'Dividendo', category: 'provento' };
  if (t === 'jcp' || t === 'juros') return { tipo: 'JCP', category: 'provento' };
  if (t === 'recebimento' || t === 'resgate') return { tipo: 'Recebimento', category: 'provento' };

  return null;
}

/**
 * Normaliza ticker (maiúsculas, sem espaços)
 * @param {string} ticker
 * @returns {string}
 */
function normalizeTicker(ticker) {
  if (!ticker) return null;
  return ticker.trim().toUpperCase();
}

/**
 * Infere tipo de ativo pelo ticker
 * Mesmo padrão usado em useLancamentos.js
 * @param {string} ticker
 * @returns {string}
 */
function inferAssetType(ticker) {
  if (!ticker) return 'Ações';
  if (/^(CDB|LCI|LCA|LC|CRA|CRI|TESOURO|DEBENTURE|RDB|RENDA\s*FIXA)/i.test(ticker)) return 'Renda Fixa';
  if (/11B?$/i.test(ticker)) return 'FIIs';
  if (/(34|32|33|35|39)$/i.test(ticker)) return 'BDRs';
  if (/BTC|ETH|BNB|SOL|ADA|XRP/i.test(ticker)) return 'Cripto';
  return 'Ações';
}

/**
 * Faz parsing de um arquivo CSV da Investidor10
 * Retorna { items, errors } onde:
 *   items: array de lançamentos válidos
 *   errors: array de { rowNumber, error }
 * @param {string} csvText - Conteúdo do CSV
 * @returns {Object}
 */
export function parseLancamentosCSV(csvText) {
  const items = [];
  const errors = [];

  if (!csvText || typeof csvText !== 'string') {
    return {
      items: [],
      errors: [{ rowNumber: 0, error: 'Arquivo vazio ou inválido' }]
    };
  }

  // Remove BOM UTF-8 se presente
  let text = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;

  // Split por linhas
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return {
      items: [],
      errors: [{ rowNumber: 0, error: 'Arquivo vazio' }]
    };
  }

  // Primeira linha deve ser header
  const headerLine = lines[0];
  const expectedHeaders = ['Data', 'Tipo', 'Ativo', 'Qtd', 'Valor Unit', 'Total'];
  const headers = headerLine.split(',').map(h => h.trim());

  // Validar header (flexível: order não importa)
  const headerSet = new Set(headers.map(h => h.toLowerCase()));
  const expectedSet = new Set(expectedHeaders.map(h => h.toLowerCase()));

  if (headers.length < expectedHeaders.length) {
    return {
      items: [],
      errors: [{
        rowNumber: 1,
        error: `Header inválido. Esperado: ${expectedHeaders.join(', ')}`
      }]
    };
  }

  // Encontrar índice de cada coluna
  const colMap = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const dataIdx = lowerHeaders.findIndex(h => h === 'data');
  const tipoIdx = lowerHeaders.findIndex(h => h === 'tipo');
  const ativoIdx = lowerHeaders.findIndex(h => h === 'ativo');
  const qtdIdx = lowerHeaders.findIndex(h => h === 'qtd' || h === 'quantidade' || h === 'quant');
  const priceIdx = lowerHeaders.findIndex(h =>
    h === 'valor unit' || h === 'valor unitário' || h === 'valor unitario' ||
    h === 'preço' || h === 'preco' ||
    h === 'preço unitário' || h === 'preco unitario' ||
    h === 'preço unitario' || h === 'preco unitário');
  const totalIdx = lowerHeaders.findIndex(h => h === 'total');

  if (dataIdx === -1 || tipoIdx === -1 || ativoIdx === -1 || qtdIdx === -1 || priceIdx === -1 || totalIdx === -1) {
    return {
      items: [],
      errors: [{
        rowNumber: 1,
        error: `Colunas inválidas. Esperado: ${expectedHeaders.join(', ')}`
      }]
    };
  }

  // Processar linhas de dados
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Pula linhas vazias

    try {
      const cols = line.split(',').map(c => c.trim());

      const dateStr = cols[dataIdx];
      const tipoStr = cols[tipoIdx];
      const ticker = cols[ativoIdx];
      const qtdStr = cols[qtdIdx];
      const priceStr = cols[priceIdx];
      const totalStr = cols[totalIdx];

      // Validações
      const date = parseDate(dateStr);
      if (!date) {
        errors.push({ rowNumber: i + 1, error: `Data inválida: "${dateStr}"` });
        continue;
      }

      const typeInfo = normalizeType(tipoStr);
      if (!typeInfo) {
        errors.push({ rowNumber: i + 1, error: `Tipo desconhecido: "${tipoStr}"` });
        continue;
      }

      const normalTicker = normalizeTicker(ticker);
      if (!normalTicker) {
        errors.push({ rowNumber: i + 1, error: `Ticker vazio` });
        continue;
      }

      // For operações (compra/venda), quantity and price are required
      // For proventos (dividendo, jcp, etc), only total is required
      let quantity = null;
      let price = null;

      if (typeInfo.category === 'operacao') {
        quantity = parseFloat(qtdStr.replace(/[.,]/, (m) => m === ',' ? '.' : m));
        if (isNaN(quantity) || quantity <= 0) {
          errors.push({ rowNumber: i + 1, error: `Quantidade inválida: "${qtdStr}"` });
          continue;
        }

        price = parseFloat(priceStr.replace(/[.,]/, (m) => m === ',' ? '.' : m));
        if (isNaN(price) || price < 0) {
          errors.push({ rowNumber: i + 1, error: `Valor Unit inválido: "${priceStr}"` });
          continue;
        }
      }

      const total = parseFloat(totalStr.replace(/[.,]/, (m) => m === ',' ? '.' : m));
      if (isNaN(total) || total < 0) {
        errors.push({ rowNumber: i + 1, error: `Total inválido: "${totalStr}"` });
        continue;
      }

      // Criar objeto lançamento
      const item = {
        date,
        type: typeInfo.tipo,
        category: typeInfo.category,
        ticker: normalTicker,
        assetType: inferAssetType(normalTicker),
        assetName: normalTicker,
      };

      // Campos específicos por categoria
      if (typeInfo.category === 'operacao') {
        item.quantity = quantity || 0;
        item.price = price || 0;
        item.total = total;
      } else {
        // provento
        item.amount = total;
      }

      items.push(item);

    } catch (e) {
      errors.push({ rowNumber: i + 1, error: `Erro ao processar: ${e.message}` });
    }
  }

  return { items, errors };
}

/**
 * Valida se há duplicatas no array de lançamentos importados
 * Compara: date, tipo, ticker, total
 * @param {Array} items
 * @returns {Object} { duplicates: [{ indices, item }], unique: items }
 */
export function findDuplicates(items) {
  const seen = new Map();
  const duplicates = [];
  const unique = [];

  items.forEach((item, idx) => {
    // Chave: data + tipo + ticker + total
    const key = `${item.date}|${item.type}|${item.ticker}|${item.total?.toFixed(2)}`;

    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.indices.push(idx);
    } else {
      seen.set(key, { indices: [idx], item });
      unique.push(item);
    }
  });

  seen.forEach(({ indices, item }) => {
    if (indices.length > 1) {
      duplicates.push({ indices, item });
    }
  });

  return { duplicates, unique };
}
