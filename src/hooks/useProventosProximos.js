import { useState, useEffect, useCallback } from 'react';

// Tipo baseado na classe do ativo — fallback para 'Dividendo'
const TIPO_MAP = {
  TRXF11: 'Rendimento',
  HGLG11: 'Rendimento',
  VISC11:  'Rendimento',
  BBSE3:  'Dividendo',
};

// Estimated days between ex-date and payment — fallback to 11
const PAY_OFFSET_DAYS = {
  TRXF11: 11,
  HGLG11: 11,
  VISC11:  11,
  BBSE3:   3,
};

function addDays(isoDate, days) {
  return new Date(new Date(isoDate + 'T12:00:00').getTime() + days * 86_400_000)
    .toISOString()
    .split('T')[0];
}

// Yahoo Finance chart endpoint — returns dividend events, no auth required
async function fetchYahooDividends(ticker) {
  const url =
    `/api/yahoo/v8/finance/chart/${ticker}.SA` +
    `?range=2y&interval=1mo&events=div&includePrePost=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`);
  const data = await res.json();

  const eventsObj =
    data?.chart?.result?.[0]?.events?.dividends ?? {};

  // Convert {timestamp: {amount, date}} → sorted array (newest first)
  const divs = Object.values(eventsObj)
    .map(d => ({
      date:   new Date(d.date * 1000).toISOString().split('T')[0],
      amount: d.amount ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { ticker, divs };
}

// Project next probable payment from historical frequency + amount
function projectNext(ticker, divs) {
  if (divs.length < 2) return null;

  // Compute average interval (days) from last 4 payments
  const intervals = [];
  for (let i = 0; i < Math.min(divs.length - 1, 4); i++) {
    const diff =
      (new Date(divs[i].date) - new Date(divs[i + 1].date)) /
      86_400_000;
    if (diff > 0) intervals.push(diff);
  }
  if (!intervals.length) return null;

  const avgDays =
    Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);

  // Project from most recent dividend
  const lastMs   = new Date(divs[0].date + 'T12:00:00').getTime();
  const nextDate = new Date(lastMs + avgDays * 86_400_000);
  const today    = new Date();
  const offset   = PAY_OFFSET_DAYS[ticker] ?? 11;

  const avgAmount =
    divs.slice(0, 3).reduce((s, d) => s + d.amount, 0) /
    Math.min(3, divs.length);

  const isFuture     = nextDate > today;
  const daysSinceDue = (today - nextDate) / 86_400_000;

  // Only surface a "gap" (past-estimated) entry within last 45 days —
  // handles the case where Yahoo hasn't indexed the most recent payment yet
  if (!isFuture && daysSinceDue > 45) return null;

  const exDate  = nextDate.toISOString().split('T')[0];
  const payDate = addDays(exDate, offset);

  return { exDate, payDate, amount: avgAmount, isFuture };
}

/**
 * useProventosProximos(tickers)
 *
 * Fetches historical + projected dividend data from Yahoo Finance for the
 * given list of tickers. When `tickers` is empty the hook immediately
 * returns empty rows without making any network requests.
 *
 * @param {string[]} tickers — non-Cripto tickers the user currently holds
 */
export function useProventosProximos(tickers = []) {
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Stable serialisation for effect dep comparison
  const tickerKey = tickers.slice().sort().join(',');

  const fetchAll = useCallback(async () => {
    // No tickers → stay empty, no spinner
    if (!tickers.length) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        tickers.map(fetchYahooDividends)
      );

      const allRows = [];

      results.forEach(r => {
        if (r.status === 'rejected') {
          console.warn('dividend fetch failed:', r.reason?.message);
          return;
        }
        const { ticker, divs } = r.value;
        const tipo   = TIPO_MAP[ticker] ?? 'Dividendo';
        const offset = PAY_OFFSET_DAYS[ticker] ?? 11;

        // ── Projected / gap next payment ─────────────────────────────────
        const next = projectNext(ticker, divs);
        if (next) {
          allRows.push({
            ticker,
            tipo,
            valor:         next.amount,
            dataEx:        next.exDate,
            dataPagamento: next.payDate,
            isFuture:      next.isFuture,
            isProjected:   true,
          });
        }

        // ── Last 2 confirmed payments from Yahoo ─────────────────────────
        const projectedMonth = next?.exDate?.slice(0, 7);

        divs.slice(0, 2).forEach(d => {
          if (!next?.isFuture && d.date.slice(0, 7) === projectedMonth) return;

          allRows.push({
            ticker,
            tipo,
            valor:         d.amount,
            dataEx:        d.date,
            dataPagamento: addDays(d.date, offset),
            isFuture:      false,
            isProjected:   false,
          });
        });
      });

      // Sort: future first (nearest first), then past (newest first)
      allRows.sort((a, b) => {
        if (a.isFuture !== b.isFuture) return a.isFuture ? -1 : 1;
        if (a.isFuture) return a.dataEx.localeCompare(b.dataEx);
        return b.dataEx.localeCompare(a.dataEx);
      });

      setRows(allRows);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { rows, loading, error, lastFetch, refresh: fetchAll };
}
