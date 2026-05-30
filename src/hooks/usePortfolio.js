import { useState, useEffect, useCallback, useRef } from 'react';
import { KRAKEN_MODEL } from '../constants';

// Dynamic refresh: 30s during trading hours, 5 min when market is closed
const INTERVAL_TRADING = 30_000;
const INTERVAL_CLOSED  = 300_000;

function isTradingHours() {
  const brt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = brt.getDay();
  const mins = brt.getHours() * 60 + brt.getMinutes();
  if (day === 0 || day === 6) return false;
  return mins >= 10 * 60 && mins <= 17 * 60;
}

async function fetchYahooTicker(ticker) {
  const url = `/api/yahoo/v8/finance/chart/${ticker}.SA?interval=1d&range=2d&includePrePost=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Sem dados para ${ticker}`);
  const price     = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change    = price - prevClose;
  return {
    symbol:                     ticker,
    regularMarketPrice:         price,
    regularMarketChange:        change,
    regularMarketChangePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
    regularMarketPreviousClose: prevClose,
    regularMarketDayHigh:       meta.regularMarketDayHigh ?? 0,
    regularMarketDayLow:        meta.regularMarketDayLow  ?? 0,
    regularMarketVolume:        meta.regularMarketVolume  ?? 0,
  };
}

async function fetchAllYahoo(tickers) {
  const results = await Promise.allSettled(tickers.map(fetchYahooTicker));
  results.filter(r => r.status === 'rejected')
         .forEach(r => console.warn('Yahoo:', r.reason?.message));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

async function fetchBitcoin(attempt = 0) {
  const res = await fetch(
    '/api/coingecko/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true'
  );
  if (res.ok) return res.json();
  if (res.status === 429 && attempt < 3) {
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    return fetchBitcoin(attempt + 1);
  }
  throw new Error(`CoinGecko: ${res.status}`);
}

export function usePortfolio(portfolio) {
  const [assets, setAssets]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [trading, setTrading]       = useState(false);
  const timerRef                    = useRef(null);
  // Stable ref — fetchAll always reads the latest portfolio without needing to re-create
  const portfolioRef                = useRef(portfolio);

  // Stable callback — no deps, reads portfolioRef inside
  const fetchAll = useCallback(async () => {
    const port = portfolioRef.current;
    if (!port?.length) {
      // No portfolio yet (user hasn't added any lancamentos).
      // Resolve loading so the UI shows the empty state instead of
      // spinning skeletons forever.
      setAssets([]);
      setLoading(false);
      return;
    }
    try {
      // Renda Fixa assets (CDB, LCI, etc.) have no Yahoo ticker — skip Yahoo fetch for them
      const rendaFixaTickers = new Set(
        port.filter(a => a.type === 'Renda Fixa').map(a => a.ticker)
      );
      const stockTickers = port
        .filter(a => a.type !== 'Cripto' && !rendaFixaTickers.has(a.ticker))
        .map(a => a.ticker);
      const [yahooResults, btcData] = await Promise.all([
        fetchAllYahoo(stockTickers),
        fetchBitcoin(),
      ]);
      const btcPrice  = btcData?.bitcoin?.brl ?? 0;
      const btcChange = btcData?.bitcoin?.brl_24h_change ?? 0;

      const updated = port.map(item => {
        if (item.type === 'Cripto') {
          return {
            ...item,
            price:         btcPrice,
            changePercent: btcChange,
            change:        btcPrice * (btcChange / 100),
            totalValue:    btcPrice * item.shares,
            prevClose:     btcPrice / (1 + btcChange / 100),
            high: 0, low: 0, volume: 0,
          };
        }
        // Renda Fixa: sem cotação de mercado (CDB/LCI não existem no Yahoo).
        // Avalia pelo custo: preço médio (item.price vindo do adjustedPortfolio)
        // × quantidade. Rentabilidade 0% até modelarmos os juros do indexador.
        if (item.type === 'Renda Fixa') {
          const rfPrice = Number(item.price) || 0; // preço médio (custo/qtd)
          return {
            ...item,
            price:         rfPrice,
            changePercent: 0,
            change:        0,
            totalValue:    rfPrice * item.shares,
            prevClose:     rfPrice,
            high: 0, low: 0, volume: 0,
          };
        }
        const q     = yahooResults.find(r => r.symbol === item.ticker);
        const price = q?.regularMarketPrice ?? 0;
        return {
          ...item,
          price,
          changePercent: q?.regularMarketChangePercent ?? 0,
          change:        q?.regularMarketChange        ?? 0,
          totalValue:    price * item.shares,
          prevClose:     q?.regularMarketPreviousClose ?? 0,
          high:          q?.regularMarketDayHigh       ?? 0,
          low:           q?.regularMarketDayLow        ?? 0,
          volume:        q?.regularMarketVolume        ?? 0,
        };
      });

      setAssets(updated);
      setLastUpdate(new Date());
      setError(null);
      setTrading(isTradingHours());
    } catch (err) {
      console.error('fetchAll error:', err);
      setError(err.message ?? 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  }, []); // stable — intentionally no deps

  // Keep ref in sync, and immediately update quantities+totalValue in cached assets.
  // If the portfolio gains a brand-new ticker (not yet in assets), trigger a full
  // refresh so prices are fetched without waiting for the next scheduled interval.
  // NOTE: must be declared AFTER fetchAll to avoid TDZ ReferenceError.
  useEffect(() => {
    portfolioRef.current = portfolio;
    setAssets(prev => {
      const assetTickers = new Set(prev.map(a => a.ticker));
      const hasNewTicker  = portfolio.some(p => !assetTickers.has(p.ticker));

      const updated = prev.map(asset => {
        const item = portfolio.find(p => p.ticker === asset.ticker);
        if (!item || item.shares === asset.shares) return asset;
        return { ...asset, shares: item.shares, totalValue: asset.price * item.shares };
      });

      // Kick off a fresh fetch to pick up the new ticker's price data
      if (hasNewTicker) setTimeout(() => fetchAll(), 0);

      return updated;
    });
  }, [portfolio, fetchAll]);

  // Schedule fetches dynamically — 30s during market hours, 5 min when closed
  useEffect(() => {
    fetchAll();

    const scheduleNext = () => {
      const delay = isTradingHours() ? INTERVAL_TRADING : INTERVAL_CLOSED;
      timerRef.current = setTimeout(async () => {
        await fetchAll();
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => clearTimeout(timerRef.current);
  }, [fetchAll]);

  const totalValue = assets.reduce((s, a) => s + a.totalValue, 0);
  const dailyPnL   = assets.reduce((s, a) => s + a.change * a.shares, 0);

  const categoryValues = {};
  assets.forEach(a => {
    categoryValues[a.type] = (categoryValues[a.type] ?? 0) + a.totalValue;
  });

  const currentAllocation = {};
  Object.keys(KRAKEN_MODEL).forEach(cat => {
    currentAllocation[cat] = totalValue > 0
      ? ((categoryValues[cat] ?? 0) / totalValue) * 100 : 0;
  });

  return {
    assets, loading, error, lastUpdate, trading,
    totalValue, dailyPnL, categoryValues, currentAllocation,
    refresh: fetchAll,
  };
}
