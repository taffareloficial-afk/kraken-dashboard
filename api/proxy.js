/**
 * Universal proxy — invoked via vercel.json routes rewrites:
 *   /api/yahoo/**  → /api/proxy?service=yahoo&path=<rest>&<originalQuery>
 *   /api/coingecko/** → /api/proxy?service=coingecko&path=<rest>&…
 *   /api/brapi/**  → /api/proxy?service=brapi&path=<rest>&…
 */

const UPSTREAMS = {
  yahoo:     'https://query1.finance.yahoo.com',
  coingecko: 'https://api.coingecko.com',
  brapi:     'https://brapi.dev',
  bcb:       'https://api.bcb.gov.br',
};

const HEADERS = {
  yahoo: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'application/json, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer':         'https://finance.yahoo.com/',
    'Origin':          'https://finance.yahoo.com',
  },
  coingecko: {
    'Accept':     'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; KrakenDashboard/1.0)',
  },
  brapi: {
    'Accept':     'application/json',
    'User-Agent': 'Mozilla/5.0',
  },
  bcb: {
    'Accept':     'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; KrakenDashboard/1.0)',
  },
};

export default async function handler(req, res) {
  // service and path are injected by vercel.json routes rewrite
  const { service, path: upstreamPath = '', ...queryParams } = req.query;
  const base = UPSTREAMS[service];

  if (!base) {
    return res.status(404).json({ error: `Unknown proxy service: ${service}` });
  }

  const upstreamUrl = new URL(`${base}/${upstreamPath}`);
  Object.entries(queryParams).forEach(([k, v]) =>
    upstreamUrl.searchParams.set(k, String(v))
  );

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      headers: HEADERS[service] ?? {},
    });

    const body = await upstream.text();
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json'
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).send(body);
  } catch (err) {
    res.status(502).json({
      error:  `${service} proxy error`,
      detail: err.message,
    });
  }
}
