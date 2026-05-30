/**
 * OperacaoModal — "Adicionar / Editar Lançamento"
 *
 * Tabs: ↑ Compra | ↓ Venda | 💰 Rendimento | 💵 Dividendo
 *
 * Formulário dinâmico por tipo de ativo:
 *   Ações / FIIs / ETFs / Cripto      → campos padrão (qty × preço em R$)
 *   ETFs Internacionais                → igual, mas preço em US$
 *   Renda Fixa                         → emissor, título, indexador, taxa, forma,
 *                                        valor, liquidez, vencimento
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react';

// ── Tipos de ativo ────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { label: 'Ações',                 key: 'Ações'      },
  { label: 'Fundos Imobiliários',   key: 'FIIs'       },
  { label: 'ETFs',                  key: 'ETFs'       },
  { label: 'ETFs Internacionais',   key: 'ETFs Int.'  },
  { label: 'Renda Fixa',            key: 'Renda Fixa' },
  { label: 'Criptomoedas',          key: 'Cripto'     },
];

const ASSET_LIST = {
  'Ações': [
    { ticker: 'BBSE3',  name: 'BB Seguridade'       },
    { ticker: 'VALE3',  name: 'Vale'                 },
    { ticker: 'PETR4',  name: 'Petrobras PN'         },
    { ticker: 'ITUB4',  name: 'Itaú Unibanco'        },
    { ticker: 'ABEV3',  name: 'Ambev'                },
    { ticker: 'B3SA3',  name: 'B3'                   },
    { ticker: 'WEGE3',  name: 'WEG'                  },
    { ticker: 'GGBR4',  name: 'Gerdau PN'            },
    { ticker: 'ITSA4',  name: 'Itaúsa'               },
    { ticker: 'CPFE3',  name: 'CPFL Energia'         },
    { ticker: 'CMIG4',  name: 'Cemig PN'             },
    { ticker: 'TAEE11', name: 'Transmissão Paulista'  },
    { ticker: 'GGBR3',  name: 'Gerdau ON'            },
    { ticker: 'UNIP6',  name: 'Unipar Carbocloro'    },
    { ticker: 'USIM5',  name: 'Usiminas'             },
    { ticker: 'CSNA3',  name: 'CSN'                  },
  ],
  'FIIs': [
    { ticker: 'TRXF11', name: 'Trindade Fundo Imob'         },
    { ticker: 'HGLG11', name: 'CSHG Logística'              },
    { ticker: 'VISC11', name: 'Vinci Shopping Centers'       },
    { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária'      },
    { ticker: 'MXRF11', name: 'Maxi Renda'                  },
    { ticker: 'BRCO11', name: 'Bresco Logística'             },
    { ticker: 'RBRX11', name: 'RBR Rendimentos'             },
    { ticker: 'RBRF11', name: 'RBR Fundo de Fundos'         },
    { ticker: 'IRDM11', name: 'Iridium Recebíveis'          },
    { ticker: 'IRIM15', name: 'Iridium CRI'                  },
    { ticker: 'XPCI11', name: 'XP Crédito Imobiliário'      },
    { ticker: 'RBRR11', name: 'RBR Rendimento High Grade'    },
    { ticker: 'IFIX',   name: 'Índice FIIs'                  },
  ],
  'ETFs': [
    { ticker: 'BOVA11', name: 'iShares Ibovespa'             },
    { ticker: 'IVVB11', name: 'iShares S&P 500'              },
    { ticker: 'SPXI11', name: 'iShares S&P 500 (hedged)'     },
    { ticker: 'ECOO11', name: 'iShares Carbono Eficiente'    },
    { ticker: 'SMAL11', name: 'iShares Small Cap'            },
    { ticker: 'HASH11', name: 'Hashdex Nasdaq Crypto Index'  },
  ],
  'ETFs Int.': [
    { ticker: 'SPY',    name: 'SPDR S&P 500'                 },
    { ticker: 'QQQ',    name: 'Invesco QQQ (Nasdaq-100)'      },
    { ticker: 'VTI',    name: 'Vanguard Total Market'         },
    { ticker: 'IVV',    name: 'iShares Core S&P 500'         },
    { ticker: 'EWZ',    name: 'iShares MSCI Brazil'          },
    { ticker: 'GLD',    name: 'SPDR Gold Shares'              },
    { ticker: 'DXOD11', name: 'Dividend+ ETF'                 },
    { ticker: 'ETHE11', name: 'Ethereum ETF'                  },
    { ticker: 'GOLT11', name: 'Gold ETF'                      },
  ],
  'Renda Fixa': [],   // Renda Fixa usa emissor livre + tipo de título
  'Cripto': [
    { ticker: 'BTC',  name: 'Bitcoin'   },
    { ticker: 'ETH',  name: 'Ethereum'  },
    { ticker: 'BNB',  name: 'BNB'       },
    { ticker: 'SOL',  name: 'Solana'    },
    { ticker: 'ADA',  name: 'Cardano'   },
    { ticker: 'XRP',  name: 'XRP'       },
  ],
};

// Flat list de todos os tickers — usado para Rendimento/Dividendo
const ALL_TICKERS = Object.values(ASSET_LIST)
  .flat()
  .filter((v, i, a) => a.findIndex(x => x.ticker === v.ticker) === i);

// Tipos de título Renda Fixa
const RF_TITULOS    = ['CDB', 'LCI', 'LCA', 'LC', 'LF', 'RDB', 'Debênture', 'CRA', 'CRI'];
const RF_INDEXADORES = ['CDI', 'IPCA', 'Prefixado', 'SELIC', 'IGP-M'];
const RF_FORMAS     = ['Pós-fixado', 'Prefixado', 'Híbrido'];

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'compra',     label: '↑  Compra',     color: '#3fb950', bg: '#0d2c1a', border: '#1a4731' },
  { key: 'venda',      label: '↓  Venda',      color: '#f85149', bg: '#2d1215', border: '#6e1c1f' },
  { key: 'rendimento', label: '💰 Rendimento', color: '#3b82f6', bg: '#0d1e2e', border: '#1e3a5f' },
  { key: 'dividendo',  label: '💵 Dividendo',  color: '#f59e0b', bg: '#2c1f06', border: '#6e4c1a' },
];

const isProvento = (tab) => tab === 'rendimento' || tab === 'dividendo';

// ── Helpers ───────────────────────────────────────────────────────────────────

const today  = () => new Date().toISOString().split('T')[0];
const fmtBRL = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtUSD = (v) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// ── Empty forms ───────────────────────────────────────────────────────────────

const EMPTY_OP = {
  assetType:  '',
  date:       today(),
  ticker:     '',
  quantity:   '',
  price:      '',
  otherCosts: '',
};

const EMPTY_RF = {
  assetType:    'Renda Fixa',
  date:         today(),
  maturityDate: '',
  emissor:      '',
  titulo:       'CDB',
  indexador:    'CDI',
  taxa:         '',
  forma:        'Pós-fixado',
  valor:        '',
  liquidezDiaria: false,
};

const EMPTY_PROV = {
  date:   today(),
  ticker: '',
  amount: '',
};

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputBase = {
  background:   'var(--c-s2)',
  border:       '1px solid var(--c-b4)',
  borderRadius: 8,
  color:        'var(--c-tx1)',
  padding:      '9px 12px',
  fontSize:     13,
  width:        '100%',
  boxSizing:    'border-box',
  fontFamily:   'inherit',
  transition:   'border-color 0.15s',
};

const labelBase = {
  fontSize:      11,
  color:         'var(--c-tx3)',
  display:       'block',
  marginBottom:  5,
  fontWeight:    600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const errStyle = { color: '#f85149', fontSize: 11, marginTop: 4 };

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Field({ label, hint, error, children, fullWidth = false, style = {} }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined, ...style }}>
      <label style={labelBase}>
        {label}
        {hint && (
          <span style={{ color: '#484f58', fontWeight: 400, textTransform: 'none', marginLeft: 5, fontSize: 10 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
      {error && <p style={errStyle}>{error}</p>}
    </div>
  );
}

function SelectInput({ value, onChange, children, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{ ...inputBase, cursor: disabled ? 'not-allowed' : 'pointer', colorScheme: 'dark', opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </select>
  );
}

function NumberInput({ value, onChange, placeholder, prefix }) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, color: '#484f58', fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none',
        }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '0'}
        style={{
          ...inputBase,
          fontFamily: 'JetBrains Mono, monospace',
          paddingLeft: prefix ? 36 : 12,
        }}
      />
    </div>
  );
}

// ── SearchableSelect ──────────────────────────────────────────────────────────

function SearchableSelect({ options, value, onChange, disabled, placeholder }) {
  const [inputVal, setInputVal] = useState('');
  const [open,     setOpen]     = useState(false);
  const [focused,  setFocused]  = useState(false);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  useEffect(() => { setInputVal(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        if (inputVal.trim() && inputVal.trim().toUpperCase() !== value) {
          const upper = inputVal.trim().toUpperCase();
          onChange(upper);
          setInputVal(upper);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputVal, value, onChange]);

  const query    = inputVal.trim().toLowerCase();
  const filtered = query
    ? options.filter(opt =>
        opt.ticker.toLowerCase().includes(query) ||
        opt.name.toLowerCase().includes(query)
      )
    : [];

  const exactMatch   = options.some(o => o.ticker.toLowerCase() === query);
  const showManual   = query && !exactMatch;
  const manualTicker = inputVal.trim().toUpperCase();

  const handleInput = (e) => {
    setInputVal(e.target.value);
    onChange('');
    setOpen(e.target.value.trim().length > 0);
  };

  const select = useCallback((ticker) => {
    onChange(ticker);
    setInputVal(ticker);
    setOpen(false);
    inputRef.current?.blur();
  }, [onChange]);

  const clear = (e) => {
    e.stopPropagation();
    setInputVal('');
    onChange('');
    inputRef.current?.focus();
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    if (e.key === 'Enter' && showManual) { e.preventDefault(); select(manualTicker); }
  };

  const borderColor = focused ? '#3b82f6' : '#30363d';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search
          size={13}
          color={focused ? '#3b82f6' : '#484f58'}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 0.15s' }}
        />
        <input
          ref={inputRef}
          value={inputVal}
          onChange={handleInput}
          onFocus={() => { setFocused(true); if (inputVal.trim().length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Selecione o tipo primeiro' : (placeholder || 'Buscar ativo...')}
          autoComplete="off"
          style={{
            ...inputBase,
            paddingLeft:  34,
            paddingRight: inputVal ? 30 : 12,
            border:       `1px solid ${borderColor}`,
            cursor:       disabled ? 'not-allowed' : 'text',
            opacity:      disabled ? 0.45 : 1,
            fontFamily:   'JetBrains Mono, monospace',
            fontWeight:   value ? 600 : 400,
          }}
        />
        {inputVal && !disabled && (
          <button
            onMouseDown={clear}
            className="btn-inline"
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: '#484f58', display: 'flex', alignItems: 'center' }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {open && !disabled && inputVal.trim().length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#161b22', border: '1px solid var(--c-b4)', borderRadius: 9,
          zIndex: 400, maxHeight: 210, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          scrollbarWidth: 'thin', scrollbarColor: '#30363d #161b22',
        }}>
          {filtered.length === 0 && !showManual && (
            <div style={{ padding: '10px 14px', color: '#484f58', fontSize: 12 }}>Nenhum ativo encontrado</div>
          )}
          {filtered.map((opt, idx) => (
            <div
              key={opt.ticker}
              onMouseDown={() => select(opt.ticker)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: idx < filtered.length - 1 ? '1px solid var(--c-b1)' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: '#e6edf3', minWidth: 64 }}>{opt.ticker}</span>
              <span style={{ fontSize: 12, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
            </div>
          ))}
          {showManual && (
            <div
              onMouseDown={() => select(manualTicker)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', borderTop: filtered.length > 0 ? '1px solid var(--c-b1)' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={12} color="#8b5cf6" />
              <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>Usar &ldquo;{manualTicker}&rdquo; manualmente</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DateField ─────────────────────────────────────────────────────────────────

function DateField({ label, value, onChange, error, max, hint }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <div style={{ position: 'relative' }}>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          max={max}
          style={{ ...inputBase, colorScheme: 'dark', paddingRight: 36 }}
        />
        <Calendar size={14} color="var(--c-tx4)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </Field>
  );
}

// ── OperacaoForm (Ações / FIIs / ETFs / ETFs Int. / Cripto) ──────────────────

function OperacaoForm({ tab, form, errors, set }) {
  const isETFInt     = form.assetType === 'ETFs Int.';
  const isRendaFixa  = form.assetType === 'Renda Fixa';
  const assetOptions = form.assetType ? (ASSET_LIST[form.assetType] ?? []) : [];
  const currency     = isETFInt ? 'US$' : 'R$';
  const fmt          = isETFInt ? fmtUSD : fmtBRL;

  const qty   = parseFloat(form.quantity)   || 0;
  const price = parseFloat(form.price)      || 0;
  const other = parseFloat(form.otherCosts) || 0;
  const total = qty * price + other;

  if (isRendaFixa) return null; // RendaFixaForm handles this case separately

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
      {/* Tipo de ativo — full width */}
      <Field label="Tipo de ativo" error={errors.assetType} fullWidth>
        <SelectInput value={form.assetType} onChange={v => set('assetType', v)}>
          <option value="">Selecione...</option>
          {ASSET_TYPES.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </SelectInput>
      </Field>

      {/* Ativo — full width */}
      <Field label="Ativo" error={errors.ticker} fullWidth>
        <SearchableSelect
          options={assetOptions}
          value={form.ticker}
          onChange={(v) => set('ticker', v)}
          disabled={!form.assetType}
          placeholder="Buscar por ticker ou nome..."
        />
      </Field>

      {/* Data da transação */}
      <DateField
        label={tab === 'compra' ? 'Data de compra' : 'Data de venda'}
        value={form.date}
        onChange={v => set('date', v)}
        max={today()}
        error={errors.date}
      />

      {/* Quantidade */}
      <Field label="Quantidade" error={errors.quantity}>
        <NumberInput
          value={form.quantity}
          onChange={v => set('quantity', v)}
          placeholder="0"
        />
      </Field>

      {/* Preço */}
      <Field label={`Preço em ${currency}`} error={errors.price}>
        <NumberInput
          value={form.price}
          onChange={v => set('price', v)}
          placeholder="0,00"
          prefix={isETFInt ? 'US$' : 'R$'}
        />
      </Field>

      {/* Outros custos */}
      <Field label="Outros custos" hint="(Opcional)">
        <NumberInput
          value={form.otherCosts}
          onChange={v => set('otherCosts', v)}
          placeholder="0,00"
          prefix={isETFInt ? 'US$' : 'R$'}
        />
      </Field>

      {/* Valor total — calculado */}
      {total > 0 && (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 9,
          background: '#161b22', border: '1px solid #21262d',
        }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>
            Valor total {isETFInt ? '(em US$)' : ''}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 15, color: tab === 'compra' ? '#3fb950' : '#f85149' }}>
            {fmt(total)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── RendaFixaForm ─────────────────────────────────────────────────────────────

function RendaFixaForm({ tab, form, errors, set }) {
  const valor = parseFloat(form.valor) || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
      {/* Tipo de ativo — full width */}
      <Field label="Tipo de ativo" fullWidth>
        <SelectInput value="Renda Fixa" onChange={() => {}} disabled>
          <option value="Renda Fixa">Renda Fixa</option>
        </SelectInput>
      </Field>

      {/* Emissor — full width */}
      <Field label="Emissor" error={errors.emissor} fullWidth hint="Ex: Banco Inter, XP Investimentos">
        <input
          type="text"
          value={form.emissor}
          onChange={e => set('emissor', e.target.value)}
          placeholder="Nome do emissor..."
          style={inputBase}
        />
      </Field>

      {/* Tipo de título */}
      <Field label="Tipo de título" error={errors.titulo}>
        <SelectInput value={form.titulo} onChange={v => set('titulo', v)}>
          {RF_TITULOS.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectInput>
      </Field>

      {/* Indexador */}
      <Field label="Indexador" error={errors.indexador}>
        <SelectInput value={form.indexador} onChange={v => set('indexador', v)}>
          {RF_INDEXADORES.map(i => <option key={i} value={i}>{i}</option>)}
        </SelectInput>
      </Field>

      {/* Taxa */}
      <Field label="Taxa (%)" error={errors.taxa} hint="Ex: 12,5 para 12,5% ou 115 para 115% CDI">
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.taxa}
            onChange={e => set('taxa', e.target.value)}
            placeholder="0,00"
            style={{ ...inputBase, fontFamily: 'JetBrains Mono, monospace', paddingRight: 36 }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#484f58', fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none' }}>
            %
          </span>
        </div>
      </Field>

      {/* Forma */}
      <Field label="Forma">
        <SelectInput value={form.forma} onChange={v => set('forma', v)}>
          {RF_FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
        </SelectInput>
      </Field>

      {/* Valor */}
      <Field label="Valor (R$)" error={errors.valor}>
        <NumberInput
          value={form.valor}
          onChange={v => set('valor', v)}
          placeholder="0,00"
          prefix="R$"
        />
      </Field>

      {/* Liquidez diária — toggle */}
      <Field label="Liquidez diária">
        <button
          type="button"
          onClick={() => set('liquidezDiaria', !form.liquidezDiaria)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 12px', borderRadius: 8,
            background: form.liquidezDiaria ? '#0d2c1a' : 'var(--c-s2)',
            border: `1px solid ${form.liquidezDiaria ? '#1a4731' : 'var(--c-b4)'}`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {form.liquidezDiaria
            ? <ToggleRight size={20} color="#3fb950" />
            : <ToggleLeft  size={20} color="#484f58" />
          }
          <span style={{ fontSize: 13, color: form.liquidezDiaria ? '#3fb950' : '#8b949e', fontWeight: 500 }}>
            {form.liquidezDiaria ? 'Sim' : 'Não'}
          </span>
        </button>
      </Field>

      {/* Data da transação */}
      <DateField
        label="Data da transação"
        value={form.date}
        onChange={v => set('date', v)}
        max={today()}
        error={errors.date}
      />

      {/* Data de vencimento */}
      <DateField
        label="Data de vencimento"
        value={form.maturityDate}
        onChange={v => set('maturityDate', v)}
        error={errors.maturityDate}
      />

      {/* Valor total — calculado (= Valor) */}
      {valor > 0 && (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 9,
          background: '#161b22', border: '1px solid #21262d',
        }}>
          <div>
            <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>Valor total</p>
            {form.indexador && form.taxa && (
              <p style={{ fontSize: 11, color: '#484f58' }}>
                {form.titulo} · {form.taxa}% {form.indexador} · {form.forma}
              </p>
            )}
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 15, color: tab === 'compra' ? '#3fb950' : '#f85149' }}>
            {fmtBRL(valor)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── ProventoForm ──────────────────────────────────────────────────────────────

function ProventoForm({ tab, form, errors, set }) {
  const tabCfg = TABS.find(t => t.key === tab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Info strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 9,
        background: tabCfg.bg, border: `1px solid ${tabCfg.border}`,
      }}>
        <span style={{ fontSize: 20 }}>{tab === 'rendimento' ? '💰' : '💵'}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: tabCfg.color }}>
            Registrar {tab === 'rendimento' ? 'Rendimento' : 'Dividendo'}
          </p>
          <p style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>
            {tab === 'rendimento'
              ? 'Proventos de FIIs — registre o valor total recebido'
              : 'Dividendos de ações — registre o valor total recebido'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
        <DateField
          label="Data de recebimento"
          value={form.date}
          onChange={v => set('date', v)}
          max={today()}
          error={errors.date}
        />

        <Field label="Ativo" error={errors.ticker}>
          <SearchableSelect
            options={ALL_TICKERS}
            value={form.ticker}
            onChange={(v) => set('ticker', v)}
            placeholder="Ex: HGLG11, BBSE3..."
          />
        </Field>
      </div>

      <Field label="Valor total recebido (R$)" error={errors.amount}>
        <input
          type="number"
          min="0"
          step="any"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          placeholder="0,00"
          style={{
            ...inputBase,
            fontFamily:  'JetBrains Mono, monospace',
            fontSize:    18,
            fontWeight:  600,
            padding:     '12px 14px',
            color:       tabCfg.color,
            borderColor: form.amount && +form.amount > 0 ? tabCfg.border : undefined,
          }}
        />
      </Field>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function OperacaoModal({ open, onClose, onAdd, onUpdate, editEntry }) {
  const [tab,      setTab]      = useState('compra');
  const [opForm,   setOpForm]   = useState(EMPTY_OP);
  const [rfForm,   setRfForm]   = useState(EMPTY_RF);
  const [provForm, setProvForm] = useState(EMPTY_PROV);
  const [errors,   setErrors]   = useState({});
  const dialogRef  = useRef(null);
  const titleId    = 'modal-title';

  const prov       = isProvento(tab);
  const isRendaFixa = !prov && opForm.assetType === 'Renda Fixa';
  const isEdit     = !!editEntry;

  // Reset / pre-populate on open
  useEffect(() => {
    if (!open) return;
    setErrors({});

    if (editEntry) {
      const isProv = editEntry.category === 'provento';
      setTab(editEntry.type ?? (isProv ? 'rendimento' : 'compra'));

      if (isProv) {
        setProvForm({
          date:   editEntry.date   ?? today(),
          ticker: editEntry.ticker ?? '',
          amount: editEntry.amount != null ? String(editEntry.amount) : '',
        });
        setOpForm({ ...EMPTY_OP, date: today() });
        setRfForm({ ...EMPTY_RF, date: today() });
      } else if (editEntry.assetType === 'Renda Fixa') {
        setRfForm({
          assetType:     'Renda Fixa',
          date:          editEntry.date         ?? today(),
          maturityDate:  editEntry.maturityDate ?? '',
          emissor:       editEntry.emissor       ?? '',
          titulo:        editEntry.titulo        ?? 'CDB',
          indexador:     editEntry.indexador     ?? 'CDI',
          taxa:          editEntry.taxa          != null ? String(editEntry.taxa) : '',
          forma:         editEntry.forma         ?? 'Pós-fixado',
          valor:         editEntry.price         != null ? String(editEntry.price) : '',
          liquidezDiaria: editEntry.liquidezDiaria ?? false,
        });
        setOpForm({ ...EMPTY_OP, date: today() });
        setProvForm({ ...EMPTY_PROV, date: today() });
      } else {
        setOpForm({
          assetType:  editEntry.assetType  ?? '',
          date:       editEntry.date       ?? today(),
          ticker:     editEntry.ticker     ?? '',
          quantity:   editEntry.quantity   != null ? String(editEntry.quantity)   : '',
          price:      editEntry.price      != null ? String(editEntry.price)      : '',
          otherCosts: editEntry.otherCosts != null ? String(editEntry.otherCosts) : '',
        });
        setRfForm({ ...EMPTY_RF, date: today() });
        setProvForm({ ...EMPTY_PROV, date: today() });
      }
    } else {
      setOpForm({ ...EMPTY_OP, date: today() });
      setRfForm({ ...EMPTY_RF, date: today() });
      setProvForm({ ...EMPTY_PROV, date: today() });
      setTab('compra');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTabChange = (key) => {
    setTab(key);
    setErrors({});
  };

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTORS);
      if (focusable?.length) focusable[0].focus();
    }, 50);

    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTORS) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handler);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  // ── Field setters ─────────────────────────────────────────────────────────────
  const setOp = (field, value) => {
    setOpForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'assetType') next.ticker = '';
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const setRf = (field, value) => {
    setRfForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const setProv = (field, value) => {
    setProvForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // ── Derived totals ─────────────────────────────────────────────────────────────
  const qty         = parseFloat(opForm.quantity)   || 0;
  const price       = parseFloat(opForm.price)      || 0;
  const other       = parseFloat(opForm.otherCosts) || 0;
  const opTotal     = qty * price + other;
  const rfTotal     = parseFloat(rfForm.valor) || 0;
  const provAmount  = parseFloat(provForm.amount) || 0;

  const displayTotal = prov ? provAmount : isRendaFixa ? rfTotal : opTotal;
  const isETFInt     = opForm.assetType === 'ETFs Int.';
  const fmt          = isETFInt ? fmtUSD : fmtBRL;

  // ── Validation ─────────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (prov) {
      if (!provForm.date)                             e.date   = 'Informe a data';
      if (!provForm.ticker)                           e.ticker = 'Selecione ou informe o ativo';
      if (!provForm.amount || +provForm.amount <= 0)  e.amount = 'Informe o valor recebido';
    } else if (isRendaFixa) {
      if (!rfForm.emissor?.trim()) e.emissor = 'Informe o emissor';
      if (!rfForm.date)            e.date    = 'Informe a data';
      if (!rfForm.valor || +rfForm.valor <= 0) e.valor = 'Informe o valor';
    } else {
      if (!opForm.assetType)                          e.assetType = 'Selecione o tipo de ativo';
      if (!opForm.date)                               e.date      = 'Informe a data';
      if (!opForm.ticker)                             e.ticker    = 'Selecione ou busque um ativo';
      if (!opForm.quantity || +opForm.quantity <= 0)  e.quantity  = 'Quantidade inválida';
      if (!opForm.price    || +opForm.price    <= 0)  e.price     = 'Preço inválido';
    }
    return e;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────────
  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (prov) {
      const payload = {
        category: 'provento',
        type:     tab,
        date:     provForm.date,
        ticker:   provForm.ticker.trim().toUpperCase(),
        amount:   +provForm.amount,
      };
      isEdit ? onUpdate(editEntry.id, payload) : onAdd(payload);

    } else if (isRendaFixa) {
      const ticker = `${rfForm.titulo}_${rfForm.emissor.trim().toUpperCase().replace(/\s+/g, '_')}`;
      const payload = {
        category:      'operacao',
        type:          tab,
        date:          rfForm.date,
        ticker,
        assetType:     'Renda Fixa',
        assetName:     `${rfForm.titulo} - ${rfForm.emissor}`,
        quantity:      1,
        price:         +rfForm.valor,
        total:         +rfForm.valor,
        // campos extras de renda fixa armazenados como metadados
        emissor:       rfForm.emissor,
        titulo:        rfForm.titulo,
        indexador:     rfForm.indexador,
        taxa:          rfForm.taxa ? +rfForm.taxa : null,
        forma:         rfForm.forma,
        liquidezDiaria: rfForm.liquidezDiaria,
        maturityDate:  rfForm.maturityDate || null,
      };
      isEdit ? onUpdate(editEntry.id, payload) : onAdd(payload);

    } else {
      const ticker    = opForm.ticker.trim().toUpperCase();
      const assetOpts = opForm.assetType ? (ASSET_LIST[opForm.assetType] ?? []) : [];
      const assetMeta = assetOpts.find(a => a.ticker === ticker);
      const payload   = {
        category:  'operacao',
        type:      tab,
        date:      opForm.date,
        ticker,
        assetType: opForm.assetType,
        assetName: assetMeta?.name ?? ticker,
        quantity:  +opForm.quantity,
        price:     +opForm.price,
        ...(other > 0 && { otherCosts: other }),
        total:     opTotal,
      };
      isEdit ? onUpdate(editEntry.id, payload) : onAdd(payload);
    }

    onClose();
  };

  if (!open) return null;

  const tabCfg = TABS.find(t => t.key === tab);

  const modal = (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowY: 'auto', zIndex: 9999,
        backdropFilter: 'blur(3px)',
        animation: 'focusFadeIn 0.18s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'relative', margin: 'auto',
          width: '90%', maxWidth: 520,
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          background: '#0d1117',
          border: '1px solid var(--c-b1)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--c-b3)', flexShrink: 0 }}>
          <h2 id={titleId} style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>
            {isEdit ? 'Editar Lançamento' : 'Adicionar Lançamento'}
          </h2>
          <button
            onClick={onClose}
            className="btn-inline"
            aria-label="Fechar modal"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 7, color: '#484f58', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#161b22'; e.currentTarget.style.color = '#8b949e'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484f58'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', background: '#161b22', borderRadius: 9, padding: 3, border: '1px solid var(--c-b1)', gap: 2 }}>
            {TABS.map(({ key, label, color, bg, border }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className="btn-inline"
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 7,
                    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: active ? bg : 'transparent',
                    color:      active ? color : '#484f58',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: '18px 22px', flex: 1 }}>
          {prov ? (
            <ProventoForm tab={tab} form={provForm} errors={errors} set={setProv} />
          ) : isRendaFixa ? (
            <RendaFixaForm tab={tab} form={rfForm} errors={errors} set={setRf} />
          ) : (
            <OperacaoForm  tab={tab} form={opForm}  errors={errors} set={setOp}  />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 18px', borderTop: '1px solid var(--c-b3)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Live total */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: '#484f58', marginBottom: 2 }}>
              {prov ? 'Valor recebido' : 'Valor total'}
              {!prov && isETFInt ? ' (US$)' : ''}
            </p>
            <p style={{
              fontSize: 20, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              fontVariantNumeric: 'tabular-nums',
              color: displayTotal > 0 ? tabCfg.color : '#30363d',
              lineHeight: 1.1,
            }}>
              {displayTotal > 0 ? (prov || !isETFInt ? fmtBRL(displayTotal) : fmtUSD(displayTotal)) : '—'}
            </p>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="btn-inline"
            style={{ padding: '9px 18px', borderRadius: 8, background: 'transparent', border: '1px solid var(--c-b1)', color: '#8b949e', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#c9d1d9'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#8b949e'; }}
          >
            Cancelar
          </button>

          {/* Submit */}
          <button
            onClick={submit}
            className="btn-inline"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: tabCfg.bg, border: `1px solid ${tabCfg.border}`, color: tabCfg.color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} />
            {isEdit ? 'Salvar alteração' : 'Adicionar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
