/**
 * usePortfolioHistory — fetches 1-year daily price history for every portfolio
 * asset, IBOVESPA (^BVSP), and CDI (BCB série 4391).
 *
 * Computes:
 *   chartData:        [{ date, value }]              ← full daily portfolio time-series
 *   benchmarkSeries:  { month: [...], ytd: [...] }   ← normalized % series for chart
 *     each array: [{ date, portfolio, ibov, cdi }]   ← all starting at 0%
 *   weekly:    { pnl, pct }
 *   monthly:   { pnl, pct }
 *   yearly:    { pnl, pct }
 *   cdi:       { month, ytd }
 *   ibov:      { month, ytd }
 */

import { useState, useEffect, useRef } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Last known price at or before targetDate from asc-sorted history */
function priceAt(history, targetDate) {
  let result = null;
  for (const p of history) {
    if (p.date <= targetDate) result = p.price;
    else break;
  }
  return result;
}

/** Parse BCB date DD/MM/YYYY → Date */
function parseBcbDate(str) {
  const [dd, mm, yyyy] = str.split('/');
  return new Date(+yyyy, +mm - 1, +dd);
}

/** YYYY-MM-DD string from a Date (local timezone safe) */
function toDateStr(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute total CDI % return from fromDate through today.
 * Uses the same daily accumulation logic as buildDailyCDIIndex but returns
 * a single scalar — avoids any Map-key lookup issues.
 */
function cdiPeriodPct(cdiData, fromDate) {
  if (!cdiData?.length) return null;
  let accum = 1;
  const d   = new Date(fromDate);
  d.setDate(d.getDate() + 1);
  const now = new Date();
  while (d <= now) {
    let rate = null;
    for (const entry of cdiData) {
      if (entry.date <= d) rate = entry.pct;
      else break;
    }
    if (rate != null) {
      accum *= Math.pow(1 + rate / 100, 1 / 30);
    }
    d.setDate(d.getDate() + 1);
  }
  return (accum - 1) * 100;
}

/**
 * Build a daily CDI accumulation index (as % return) starting at 0% on fromDate.
 * Returns Map<YYYY-MM-DD, pct>.
 */
function buildDailyCDIIndex(cdiData, fromDate) {
  const result = new Map();
  if (!cdiData?.length) return result;

  const fromStr = toDateStr(fromDate);
  result.set(fromStr, 0); // base = 0%

  let accum = 1;
  const d   = new Date(fromDate);
  d.setDate(d.getDate() + 1); // start accumulating from the day after fromDate
  const now = new Date();

  while (d <= now) {
    const dateStr = toDateStr(d);
    // Find last CDI entry whose date <= d
    let rate = null;
    for (const entry of cdiData) {
      if (entry.date <= d) rate = entry.pct;
      else break;
    }
    if (rate != null) {
      // Convert monthly CDI rate to daily factor (30-day convention)
      accum *= Math.pow(1 + rate / 100, 1 / 30);
    }
    result.set(dateStr, (accum - 1) * 100);
    d.setDate(d.getDate() + 1);
  }

  return result;
}

/**
 * Build a normalized % performance time-series for Carteira, IBOV, and CDI,
 * all starting at 0% on the first portfolio date at or after fromDate.
 */
function buildBenchmarkSlice(chartData, ibovHist, cdiData, fromDate) {
  const fromStr = toDateStr(fromDate);
  const slice   = (chartData ?? []).filter(d => d.date >= fromStr);
  if (slice.length < 2) return null;

  const firstDate = slice[0].date;
  const basePort  = slice[0].value;

  // IBOV base price at the first portfolio date
  const baseIbov = ibovHist?.length
    ? priceAt(ibovHist, new Date(firstDate + 'T23:59:59Z'))
    : null;

  // Build CDI daily index from firstDate
  const cdiIndex = buildDailyCDIIndex(cdiData, new Date(firstDate + 'T12:00:00'));

  return slice.map(({ date, value }, i) => {
    const portfolioPct = basePort ? (value - basePort) / basePort * 100 : 0;

    let ibovPct = null;
    if (baseIbov != null && ibovHist?.length) {
      const price = priceAt(ibovHist, new Date(date + 'T23:59:59Z'));
      ibovPct = price != null ? (price - baseIbov) / baseIbov * 100 : null;
    }

    const cdiPct = i === 0 ? 0 : (cdiIndex.get(date) ?? null);

    return { date, portfolio: portfolioPct, ibov: ibovPct, cdi: cdiPct };
  });
}

/**
 * Compute shares of a ticker held at targetDate based on lançamentos.
 * Sums compras (+qty) and subtracts vendas (-qty) up to and including targetDate.
 */
function sharesAt(lancamentos, ticker, targetDateStr) {
  if (!lancamentos?.length) return 0;
  let shares = 0;
  for (const l of lancamentos) {
    if (l.category !== 'operacao') continue;
    if (l.ticker !== ticker) continue;
    if (!l.date || l.date > targetDateStr) continue;
    const qty = parseFloat(l.quantity) || 0;
    if (l.type === 'compra')      shares += qty;
    else if (l.type === 'venda')  shares -= qty;
  }
  return Math.max(0, shares);
}

/**
 * Compute total proventos (dividends, JCP, etc.) received up to targetDate.
 * Investidor10 includes these as part of the historical patrimônio (cash on hand).
 */
function proventosUpTo(lancamentos, targetDateStr) {
  if (!lancamentos?.length) return 0;
  let total = 0;
  for (const l of lancamentos) {
    if (l.category !== 'provento') continue;
    if (!l.date || l.date > targetDateStr) continue;
    total += parseFloat(l.amount) || 0;
  }
  return total;
}

/**
 * Compute net cash from sales minus purchases up to targetDate.
 * When the user sells more than they buy in a period, the difference
 * sits as cash — Investidor10 counts it as patrimônio.
 *
 * Returns max(0, total_vendas - total_compras_ate_data) is NOT what we want.
 * What we want is: cash received from vendas that exceeds what was reinvested.
 * Simpler model: cash = Σ(vendas) − Σ(compras) when positive (rare in accumulation).
 */
function cashFromVendasAt(lancamentos, targetDateStr) {
  if (!lancamentos?.length) return 0;
  let compras = 0, vendas = 0;
  for (const l of lancamentos) {
    if (l.category !== 'operacao') continue;
    if (!l.date || l.date > targetDateStr) continue;
    const value = parseFloat(l.total) || (parseFloat(l.price) * parseFloat(l.quantity)) || 0;
    if (l.type === 'compra')     compras += value;
    else if (l.type === 'venda') vendas  += value;
  }
  // Cash hoarded = vendas - compras (only when positive, accumulation phase ⇒ 0)
  return Math.max(0, vendas - compras);
}

/**
 * Given successful asset histories, current shares, and lancamentos,
 * build a daily portfolio value time-series across the union of all
 * trading dates — using HISTORICAL shares (cotas held at each date)
 * rather than current shares.
 */
function buildChartData(histories, assets, lancamentos) {
  const dateSet = new Set();
  histories.forEach(hist => hist.forEach(p => dateSet.add(toDateStr(new Date(
    p.date.getFullYear(),
    p.date.getMonth(),
    p.date.getDate(),
  )))));

  const sortedDates = Array.from(dateSet).sort();
  const hasLancamentos = lancamentos?.length > 0;

  const points = sortedDates.map(dateStr => {
    const target = new Date(dateStr + 'T23:59:59Z');
    let value = 0;
    let covered = 0;

    assets.forEach((asset, i) => {
      const hist = histories[i];
      if (!hist?.length) return;
      const price = priceAt(hist, target);
      if (price == null) return;

      // Use historical shares (held at this date) when lancamentos available,
      // otherwise fall back to current shares for backward compatibility.
      const sharesAtDate = hasLancamentos
        ? sharesAt(lancamentos, asset.ticker, dateStr)
        : asset.shares;

      if (sharesAtDate > 0) {
        value += price * sharesAtDate;
      }
      covered++;
    });

    // Add cumulative proventos received up to this date (Investidor10 includes
    // dividends/JCP as part of patrimônio — they sit as cash on hand).
    if (hasLancamentos) {
      value += proventosUpTo(lancamentos, dateStr);
    }

    // Skip dates before the user had any holdings (value = 0)
    if (hasLancamentos && value === 0) return null;

    return covered >= Math.ceil(assets.length / 2)
      ? { date: dateStr, value: Math.round(value * 100) / 100 }
      : null;
  });

  return points.filter(Boolean);
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

// Brapi token (optional) — when provided, uses B3 official prices via Brapi
const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN ?? null;

/**
 * Fetch ticker price history from Brapi (B3 official data).
 * Returns [{ date: Date, price: number }] sorted ascending.
 * Throws on error so the caller can fallback to Yahoo.
 */
async function fetchBrapiHistory(ticker) {
  // Brapi expects ticker without .SA suffix
  const clean = ticker.replace(/\.SA$/i, '');
  const url = `/api/brapi/api/quote/${clean}?range=1y&interval=1d&token=${encodeURIComponent(BRAPI_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Brapi ${clean}: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(`Brapi ${clean}: ${data.message || 'error'}`);
  const result = data?.results?.[0];
  const hist   = result?.historicalDataPrice ?? [];
  return hist
    .map(d => ({ date: new Date(d.date * 1000), price: d.close }))
    .filter(d => d.price !== null && d.price > 0)
    .sort((a, b) => a.date - b.date);
}

async function fetchYahooHistory(symbol) {
  const url =
    `/api/yahoo/v8/finance/chart/${symbol}` +
    `?interval=1d&range=1y&includePrePost=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const data = await res.json();
  const result     = data?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes     = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000), price: closes[i] }))
    .filter(d => d.price !== null && d.price > 0)
    .sort((a, b) => a.date - b.date);
}

/**
 * Fetch stock history — uses Brapi (B3 official) when token configured,
 * falls back to Yahoo Finance otherwise.
 */
async function fetchStockHistory(ticker) {
  if (BRAPI_TOKEN) {
    try {
      return await fetchBrapiHistory(ticker);
    } catch (e) {
      console.warn(`[Brapi] ${ticker} fallback to Yahoo:`, e.message);
    }
  }
  return fetchYahooHistory(`${ticker.replace(/\.SA$/i, '')}.SA`);
}

async function fetchCryptoHistory() {
  const url =
    '/api/coingecko/api/v3/coins/bitcoin/market_chart' +
    '?vs_currency=brl&days=365&interval=daily';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
  const data = await res.json();
  return (data?.prices ?? [])
    .map(([ts, price]) => ({ date: new Date(ts), price }))
    .filter(d => d.price > 0)
    .sort((a, b) => a.date - b.date);
}

async function fetchCDIMonthly() {
  const url =
    '/api/bcb/dados/serie/bcdata.sgs.4391/dados/ultimos/14?formato=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB CDI: ${res.status}`);
  const data = await res.json();
  return data
    .map(d => ({ date: parseBcbDate(d.data), pct: parseFloat(d.valor) }))
    .filter(d => !isNaN(d.pct))
    .sort((a, b) => a.date - b.date);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  chartData:       [],   // [{ date, value }]
  benchmarkSeries: null, // { month, m3, m6, ytd }  each: [{ date, portfolio, ibov, cdi }]
  weekly:          null,
  monthly:         null,
  yearly:          null,
  cdi:             null,
  ibov:            null,
  assetPerf:       [],   // [{ ticker, m1, m3, m6, ytd }]  per-asset % for each period
  cdiByPeriod:     null, // { '1M', '3M', '6M', '1Y' } → scalar % — direct CDI for summary panel
  loading:         true,
};

export function usePortfolioHistory(assets, lancamentos = []) {
  const [state, setState] = useState(INITIAL_STATE);
  const fetchedRef        = useRef(false);

  useEffect(() => {
    // No portfolio yet — resolve loading so charts render their empty state.
    // Also reset the guard so the next render (after user adds lancamentos) triggers a fetch.
    if (!assets?.length) {
      fetchedRef.current = false;
      setState(s => ({ ...s, loading: false }));
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const run = async () => {
      const now   = new Date();
      const t7d   = new Date(now.getTime() -   7 * 86_400_000);
      const t30d  = new Date(now.getTime() -  30 * 86_400_000);
      const t90d  = new Date(now.getTime() -  90 * 86_400_000);
      const t180d = new Date(now.getTime() - 180 * 86_400_000);
      const t1y   = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const tYTD  = new Date(now.getFullYear(), 0, 1);

      // ── 1. Asset price histories ─────────────────────────────────────────
      const results = await Promise.allSettled(
        assets.map(asset =>
          asset.type === 'Cripto'
            ? fetchCryptoHistory()
            : fetchStockHistory(asset.ticker)
        )
      );

      const successHistories = results.map(r =>
        r.status === 'fulfilled' ? r.value : []
      );

      // ── 1b. Also fetch history for tickers in lançamentos that aren't in assets
      //       (e.g. tickers sold completely). Without this, chartData would
      //       under-count historical patrimônio for periods where the user
      //       still held those positions.
      const currentTickers = new Set(assets.map(a => a.ticker));
      const allLancTickers = new Set(
        (lancamentos ?? [])
          .filter(l => l.category === 'operacao' && l.ticker)
          .map(l => l.ticker)
      );
      const extraTickers = [...allLancTickers].filter(t => !currentTickers.has(t));

      // Build a minimal "extra asset" list — type inferred from first lançamento
      const extraAssets = extraTickers.map(ticker => {
        const sample = lancamentos.find(l => l.ticker === ticker);
        const isCripto = /BTC|ETH|BNB|SOL|ADA|XRP/i.test(ticker);
        return {
          ticker,
          shares: 0, // current shares are 0 (sold out) — buildChartData uses sharesAt()
          type:   isCripto ? 'Cripto' : (sample?.assetType ?? 'Ações'),
        };
      });

      const extraResults = await Promise.allSettled(
        extraAssets.map(asset =>
          asset.type === 'Cripto'
            ? fetchCryptoHistory()
            : fetchStockHistory(asset.ticker)
        )
      );

      const extraHistories = extraResults.map(r =>
        r.status === 'fulfilled' ? r.value : []
      );

      const allAssets    = [...assets, ...extraAssets];
      const allHistories = [...successHistories, ...extraHistories];

      // ── 2. Full daily time-series (chart data) — uses HISTORICAL shares ─
      const chartData = buildChartData(allHistories, allAssets, lancamentos);

      // ── 3. Scalar PnL values ─────────────────────────────────────────────
      let currentVal = 0;
      let val7d = 0,  valid7d  = 0;
      let val30d = 0, valid30d = 0;
      let valYTD = 0, validYTD = 0;

      results.forEach((r, i) => {
        const asset = assets[i];
        currentVal += asset.price * asset.shares;
        if (r.status !== 'fulfilled') return;

        const hist = r.value;
        const p7d  = priceAt(hist, t7d);
        const p30d = priceAt(hist, t30d);
        const pYTD = priceAt(hist, tYTD);

        if (p7d  != null) { val7d  += p7d  * asset.shares; valid7d++;  }
        if (p30d != null) { val30d += p30d * asset.shares; valid30d++; }
        if (pYTD != null) { valYTD += pYTD * asset.shares; validYTD++; }
      });

      const weekly  = valid7d  > 0 && val7d  > 0
        ? { pnl: currentVal - val7d,  pct: (currentVal - val7d)  / val7d  * 100 } : null;
      const monthly = valid30d > 0 && val30d > 0
        ? { pnl: currentVal - val30d, pct: (currentVal - val30d) / val30d * 100 } : null;
      const yearly  = validYTD > 0 && valYTD > 0
        ? { pnl: currentVal - valYTD, pct: (currentVal - valYTD) / valYTD * 100 } : null;

      // ── 4. CDI (BCB série 4391) ──────────────────────────────────────────
      let cdiData = [];
      let cdi     = null;
      try {
        cdiData = await fetchCDIMonthly();
        if (cdiData.length > 0) {
          const cdiMonth = cdiData[cdiData.length - 1].pct;
          const yearEntries = cdiData.filter(d => d.date.getFullYear() === now.getFullYear());
          const cdiYTD = yearEntries.reduce(
            (acc, d) => (1 + acc / 100) * (1 + d.pct / 100) * 100 - 100, 0
          );
          cdi = { month: cdiMonth, ytd: cdiYTD };
        }
      } catch (e) {
        console.warn('CDI fetch error:', e.message);
      }

      // ── 5. IBOVESPA ──────────────────────────────────────────────────────
      let ibovHist = [];
      let ibov     = null;
      try {
        ibovHist = await fetchYahooHistory('%5EBVSP');
        if (ibovHist.length > 0) {
          const ibovNow  = ibovHist[ibovHist.length - 1].price;
          const ibov30d  = priceAt(ibovHist, t30d);
          const ibovYTDp = priceAt(ibovHist, tYTD);
          ibov = {
            month: ibov30d  ? (ibovNow - ibov30d)  / ibov30d  * 100 : null,
            ytd:   ibovYTDp ? (ibovNow - ibovYTDp) / ibovYTDp * 100 : null,
          };
        }
      } catch (e) {
        console.warn('IBOVESPA fetch error:', e.message);
      }

      // ── 6. Benchmark time-series (normalized % for chart) ────────────────
      let benchmarkSeries = null;
      try {
        benchmarkSeries = {
          month: buildBenchmarkSlice(chartData, ibovHist, cdiData, t30d),
          m3:    buildBenchmarkSlice(chartData, ibovHist, cdiData, t90d),
          m6:    buildBenchmarkSlice(chartData, ibovHist, cdiData, t180d),
          ytd:   buildBenchmarkSlice(chartData, ibovHist, cdiData, tYTD),
        };
      } catch (e) {
        console.warn('Benchmark series error:', e.message);
      }

      // ── 7. CDI scalar per period (bypasses time-series Map lookup) ───────
      const cdiByPeriod = cdiData.length ? {
        '1M': cdiPeriodPct(cdiData, t30d),
        '3M': cdiPeriodPct(cdiData, t90d),
        '6M': cdiPeriodPct(cdiData, t180d),
        '1Y': cdiPeriodPct(cdiData, tYTD),
      } : null;

      // ── 8. Per-asset period performance ──────────────────────────────────
      const assetPerf = assets.map((asset, i) => {
        if (results[i].status !== 'fulfilled') {
          return { ticker: asset.ticker, m1: null, m3: null, m6: null, ytd: null };
        }
        const hist = results[i].value;
        if (!hist.length) return { ticker: asset.ticker, m1: null, m3: null, m6: null, ytd: null };

        const curr  = hist[hist.length - 1].price;
        const p30d  = priceAt(hist, t30d);
        const p90d  = priceAt(hist, t90d);
        const p180d = priceAt(hist, t180d);
        const pYTD  = priceAt(hist, tYTD);

        return {
          ticker: asset.ticker,
          m1:  p30d  != null ? (curr - p30d)  / p30d  * 100 : null,
          m3:  p90d  != null ? (curr - p90d)  / p90d  * 100 : null,
          m6:  p180d != null ? (curr - p180d) / p180d * 100 : null,
          ytd: pYTD  != null ? (curr - pYTD)  / pYTD  * 100 : null,
        };
      });

      setState({
        chartData, benchmarkSeries,
        weekly, monthly, yearly,
        cdi, ibov, assetPerf, cdiByPeriod,
        loading: false,
      });
    };

    run().catch(err => {
      console.error('usePortfolioHistory error:', err);
      setState(s => ({ ...s, loading: false }));
    });
  }, [assets]);

  return state;
}
