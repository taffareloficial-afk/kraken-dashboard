import { useState } from 'react';
import { PlusCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { PORTFOLIO } from '../../constants';

const today = () => new Date().toISOString().split('T')[0];
const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const EMPTY = { date: today(), ticker: '', type: 'compra', quantity: '', price: '' };

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

export default function OperacaoForm({ onAdd }) {
  const [form, setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const tickers = PORTFOLIO.map(p => p.ticker);
  const total   = form.quantity && form.price ? +form.quantity * +form.price : 0;

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.date)              e.date     = 'Informe a data';
    if (!form.ticker.trim())     e.ticker   = 'Informe o ticker';
    if (!form.quantity || +form.quantity <= 0) e.quantity = 'Qtd inválida';
    if (!form.price    || +form.price    <= 0) e.price    = 'Preço inválido';
    return e;
  };

  const submit = e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onAdd({
      category: 'operacao',
      type:     form.type,
      date:     form.date,
      ticker:   form.ticker.trim().toUpperCase(),
      quantity: +form.quantity,
      price:    +form.price,
      total:    total,
    });

    setForm({ ...EMPTY, date: form.date, type: form.type });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const isBuy = form.type === 'compra';

  return (
    <div className="card fade-in">
      <div className="flex items-center gap-2 mb-4">
        {isBuy
          ? <TrendingUp size={15} color="#3fb950" />
          : <TrendingDown size={15} color="#f85149" />
        }
        <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Registrar Operação</h2>
      </div>

      {/* Buy / Sell toggle */}
      <div
        className="flex mb-4 rounded-lg overflow-hidden"
        style={{ border: '1px solid #21262d', background: '#161b22' }}
      >
        {['compra', 'venda'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => set('type', t)}
            className="flex-1 py-2 text-xs font-semibold transition-colors capitalize"
            style={{
              background: form.type === t ? (t === 'compra' ? '#0d2c1a' : '#2d1215') : 'transparent',
              color:      form.type === t ? (t === 'compra' ? '#3fb950' : '#f85149') : '#8b949e',
              border:     'none',
              cursor:     'pointer',
            }}
          >
            {t === 'compra' ? '↑ Compra' : '↓ Venda'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Date */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Data</label>
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
              list="tickers-op"
              value={form.ticker}
              onChange={e => set('ticker', e.target.value.toUpperCase())}
              placeholder="Ex: TRXF11"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}
            />
            <datalist id="tickers-op">
              {tickers.map(t => <option key={t} value={t} />)}
            </datalist>
            {errors.ticker && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.ticker}</p>}
          </div>

          {/* Quantity */}
          <div>
            <label style={labelStyle}>Quantidade</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
            />
            {errors.quantity && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.quantity}</p>}
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Preço unitário (R$)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.price}
              onChange={e => set('price', e.target.value)}
              placeholder="0,00"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
            />
            {errors.price && <p style={{ color: '#f85149', fontSize: 11, marginTop: 3 }}>{errors.price}</p>}
          </div>
        </div>

        {/* Total preview */}
        {total > 0 && (
          <div
            className="flex items-center justify-between mt-3 px-3 py-2 rounded-lg"
            style={{ background: '#161b22', border: '1px solid #21262d' }}
          >
            <span className="text-xs" style={{ color: '#8b949e' }}>Total da operação</span>
            <span className="mono font-bold text-sm" style={{ color: isBuy ? '#3fb950' : '#f85149' }}>
              {isBuy ? '-' : '+'}{fmtBRL(total)}
            </span>
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background:  isBuy ? '#0d2c1a' : '#2d1215',
            border:     `1px solid ${isBuy ? '#1a4731' : '#6e1c1f'}`,
            color:       isBuy ? '#3fb950' : '#f85149',
            cursor:     'pointer',
          }}
        >
          <PlusCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          {isBuy ? 'Registrar Compra' : 'Registrar Venda'}
        </button>

        {success && (
          <p className="text-xs text-center mt-2" style={{ color: '#3fb950' }}>
            ✓ Operação registrada com sucesso
          </p>
        )}
      </form>
    </div>
  );
}
