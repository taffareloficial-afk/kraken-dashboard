export const PORTFOLIO = [
  { ticker: 'TRXF11', shares: 0, type: 'FIIs',   name: 'Trindade Fundo Imob' },
  { ticker: 'HGLG11', shares: 0, type: 'FIIs',   name: 'CSHG Logística' },
  { ticker: 'VISC11', shares: 0, type: 'FIIs',   name: 'Vinci Shopping Centers' },
  { ticker: 'BBSE3',  shares: 0, type: 'Ações',  name: 'BB Seguridade' },
  { ticker: 'BTC',    shares: 0, type: 'Cripto', name: 'Bitcoin' },
];

export const KRAKEN_MODEL = {
  'Ações':       25,
  'FIIs':        40,
  'ETFs':        10,
  'Renda Fixa':  20,
  'Cripto':       5,
};

export const CATEGORY_COLORS = {
  'Ações':      '#3b82f6',
  'FIIs':       '#10b981',
  'ETFs':       '#f59e0b',
  'Renda Fixa': '#8b5cf6',
  'Cripto':     '#f97316',
};

export const CATEGORY_ICONS = {
  'Ações':      '📈',
  'FIIs':       '🏢',
  'ETFs':       '📊',
  'Renda Fixa': '🔒',
  'Cripto':     '🪙',
};

export const ALERT_THRESHOLD = 5; // % deviation to trigger alert
