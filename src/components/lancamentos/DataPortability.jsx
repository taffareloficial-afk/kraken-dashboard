import { useRef, useState } from 'react';
import { Download, Upload, CheckCircle, AlertTriangle, X } from 'lucide-react';

// ── Export ────────────────────────────────────────────────────────────────────
function exportJSON(lancamentos) {
  const payload = {
    version:    1,
    exportedAt: new Date().toISOString(),
    count:      lancamentos.length,
    data:       lancamentos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `kraken-lancamentos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Inline feedback banner ────────────────────────────────────────────────────
function FeedbackBanner({ msg, onClose }) {
  if (!msg) return null;
  const isErr = msg.startsWith('⚠');
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8, marginTop: 8,
        background: isErr ? '#2d1215' : '#0d2c1a',
        border: `1px solid ${isErr ? '#6e1c1f' : '#1a4731'}`,
        color: isErr ? '#f85149' : '#3fb950',
        fontSize: 12,
      }}
    >
      {isErr
        ? <AlertTriangle size={13} />
        : <CheckCircle   size={13} />
      }
      <span style={{ flex: 1 }}>{msg}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit', opacity: 0.6 }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Confirmation dialog (inline) ──────────────────────────────────────────────
function ConfirmImport({ pending, onConfirm, onCancel }) {
  if (!pending) return null;
  const willAdd  = pending.toAdd;
  const willSkip = pending.total - willAdd;

  return (
    <div
      style={{
        marginTop: 10, padding: '12px 14px', borderRadius: 10,
        background: '#161b22', border: '1px solid #30363d',
      }}
    >
      <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
        Confirmar importação
      </p>
      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10, lineHeight: 1.7 }}>
        <p>
          Arquivo contém <span style={{ color: '#e6edf3', fontWeight: 600 }}>{pending.total}</span> lançamentos.
        </p>
        <p>
          → <span style={{ color: '#3fb950', fontWeight: 600 }}>{willAdd} novos</span> serão adicionados
          {willSkip > 0 && (
            <span style={{ color: '#484f58' }}>, {willSkip} já existem (não duplicados)</span>
          )}.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 7,
            background: '#0d2c1a', border: '1px solid #1a4731',
            color: '#3fb950', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          Importar {willAdd} lançamentos
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '7px 14px', borderRadius: 7,
            background: 'transparent', border: '1px solid #21262d',
            color: '#484f58', fontSize: 12, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DataPortability({ lancamentos, mergeImport }) {
  const fileRef            = useRef(null);
  const [pending, setPending]   = useState(null);
  const [feedback, setFeedback] = useState('');

  // ── Export ──────────────────────────────────────────────────────────────
  function handleExport() {
    if (lancamentos.length === 0) {
      setFeedback('⚠ Nenhum lançamento para exportar.');
      return;
    }
    exportJSON(lancamentos);
    setFeedback(`✓ ${lancamentos.length} lançamentos exportados com sucesso.`);
  }

  // ── Import — file selected ───────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);

        const entries = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.data)
            ? parsed.data
            : null;

        if (!entries) throw new Error('Formato inválido: esperado array de lançamentos.');

        const valid = entries.every(e =>
          typeof e === 'object' && e !== null &&
          typeof e.category === 'string' &&
          typeof e.date     === 'string'
        );
        if (!valid) throw new Error('Arquivo contém entradas inválidas.');

        const existingIds = new Set(lancamentos.map(l => l.id));
        const toAdd = entries.filter(e => !e.id || !existingIds.has(e.id)).length;

        setPending({ total: entries.length, toAdd, entries });
        setFeedback('');
      } catch (err) {
        setFeedback(`⚠ Erro ao ler arquivo: ${err.message}`);
        setPending(null);
      }
    };
    reader.readAsText(file);
  }

  // ── Import — confirmed ───────────────────────────────────────────────────
  function handleConfirm() {
    if (!pending) return;
    const result = mergeImport(pending.entries);
    setPending(null);
    setFeedback(
      result
        ? `✓ ${result.added} lançamentos importados${result.skipped > 0 ? ` (${result.skipped} já existiam, ignorados)` : ''}.`
        : `✓ Importação concluída.`
    );
  }

  const btnStyle = {
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    padding:    '6px 12px',
    borderRadius: 7,
    fontSize:   12,
    fontWeight: 500,
    cursor:     'pointer',
    border:     '1px solid #21262d',
    background: '#161b22',
    color:      '#8b949e',
    transition: 'all 0.15s',
    minHeight:  'unset',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Export */}
        <button
          className="btn-inline"
          onClick={handleExport}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#8b949e'; }}
          title="Baixar todos os lançamentos como JSON"
        >
          <Download size={12} />
          Exportar dados
        </button>

        {/* Import */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="btn-inline"
          onClick={() => fileRef.current?.click()}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3fb950'; e.currentTarget.style.color = '#3fb950'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#8b949e'; }}
          title="Importar lançamentos de um arquivo JSON"
        >
          <Upload size={12} />
          Importar dados
        </button>
      </div>

      <ConfirmImport
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <FeedbackBanner msg={feedback} onClose={() => setFeedback('')} />
    </div>
  );
}
