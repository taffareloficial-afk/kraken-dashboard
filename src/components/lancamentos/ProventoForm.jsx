import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { PORTFOLIO } from '../../constants';

const today = () => new Date().toISOString().split('T')[0];
const TIPOS = ['Dividendo', 'JCP', 'Rendimento', 'Amortização', 'Restituição'];
const EMPTY = { date: today(), ticker: '', tipo: 'Dividendo', amount: '' };

const inputStyle = {
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 8,
  color: '#e6edf3',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle = { fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4, fontWeight: 500 };

export default function ProventoForm({ onAdd }) {
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const tickers = PORTFOLIO.map(p => p.ticker);

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.date)            e.date   = 'Informe a data';
    if (!form.ticker.trim())   e.ticker = 'Informe o ticker';
    if (!form.amount || +form.amount <= 0) e.amount = 'Valor inválido';
    return e;
  };

  const submit = e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onAdd({
      category: 'provento',
      type:     form.tipo.toLowerCase(),
      date:     form.date,
      ticker:   form.ticker.trim().toUpperCase(),
      amount:   +form.amount,
    });

    setForm({ ...EMPTY, date: form.date });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <div className="card fade-in">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign size={15} color="#f59e0b" />
        <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Registrar Provento</h2>
      </div>

      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Date */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Data de pagamento</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
            {errors.date && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.date}</p>}
          </div>

          {/* Ticker */}
          <div>
            <label style={labelStyle}>Ativo (ticker)</label>
            <input
              list="tickers-prov"
              value={form.ticker}
              onChange={e => set('ticker', e.target.value.toUpperCase())}
              placeholder="Ex: HGLG11"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}
            />
            <datalist id="tickers-prov">
              {tickers.map(t => <option key={t} value={t} />)}
            </datalist>
            {errors.ticker && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.ticker}</p>}
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <select
              value={form.tipo}
              onChange={e => set('tipo', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Amount */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Valor recebido (R$)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="0,00"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
            />
            {errors.amount && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.amount}</p>}
          </div>
        </div>

        <button
          type="submit"
          className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: '#2c1f06',
            border:     '1px solid #6e4c1a',
            color:      '#f59e0b',
            cursor:     'pointer',
          }}
        >
          <DollarSign size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Registrar Provento
        </button>

        {success && (
          <p className="text-xs text-center mt-2" style={{ color: '#3fb950' }}>
            ✓ Provento registrado com sucesso
          </p>
        )}
      </form>
    </div>
  );
}
