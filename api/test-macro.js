import { fetchMacroData } from './analyze.js';

export default async function handler(req, res) {
  const inicio = Date.now();
  const data = await fetchMacroData();
  const duracao_ms = Date.now() - inicio;

  res.status(200).json({
    timestamp: new Date().toISOString(),
    duracao_ms,
    dados: data,
    status: {
      selic_ok: data.selic !== null,
      ipca12m_ok: data.ipca12m !== null,
      usdBrl_ok: data.usdBrl !== null,
      btcBrl_ok: data.btcBrl !== null,
      todos_ok: Object.values(data).every(v => v !== null)
    }
  });
}
