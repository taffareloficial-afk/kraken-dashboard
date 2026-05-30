import { useState, useEffect, useRef } from 'react';

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchStockHistory(ticker) {
  const url =
    `/api/yahoo/v8/finance/chart/${ticker}.SA` +
    `?interval=1d&range=1mo&includePrePost=false`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`);
  const data = await res.json();
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter(v => v !== null && v > 0);
}

async function fetchCryptoHistory() {
  const url =
    '/api/coingecko/api/v3/coins/bitcoin/market_chart' +
    '?vs_currency=brl&days=30&interval=daily';
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
  const data = await res.json();
  return (data?.prices ?? []).map(([, price]) => price);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * Fetches 30-day closing price history for the given assets.
 *
 * - Accepts a live `assets` array (from adjustedPortfolio / usePortfolio).
 * - Uses a ref to track already-fetched tickers so prices are only fetched
 *   once per session, even though `assets` updates every price-refresh cycle.
 * - When new tickers appear (user adds a lançamento), the effect re-runs and
 *   fetches only the new ones, merging into the existing map.
 *
 * Returns: { [ticker]: number[] }  (closing prices oldest → newest, ≥2 items)
 */
export function useSparklines(assets = []) {
  const [sparklines, setSparklines] = useState({});
  const fetchedRef = useRef(new Set()); // tickers whose fetch has already started

  // Stable dep: sorted comma-separated string of all current tickers.
  // Only changes when the SET of tickers changes, not when prices update.
  const allTickerKey = assets.map(a => a.ticker).sort().join(',');

  useEffect(() => {
    if (!assets.length) return;

    // Only process tickers not yet fetched
    const toFetch = assets.filter(a => !fetchedRef.current.has(a.ticker));
    if (!toFetch.length) return;

    // Mark as started (before async work to avoid double-fetching)
    toFetch.forEach(a => fetchedRef.current.add(a.ticker));

    Promise.allSettled(
      toFetch.map(async ({ ticker, type }) => {
        const prices = type === 'Cripto'
          ? await fetchCryptoHistory()
          : await fetchStockHistory(ticker);
        return { ticker, prices };
      })
    ).then(results => {
      const data = {};
      results.forEach(r => {
        if (r.status === 'rejected') {
          console.warn('[useSparklines] fetch failed:', r.reason?.message);
          return;
        }
        if (r.value.prices.length >= 2) {
          data[r.value.ticker] = r.value.prices;
        }
      });
      if (Object.keys(data).length > 0) {
        setSparklines(prev => ({ ...prev, ...data }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTickerKey]);

  return sparklines;
}
