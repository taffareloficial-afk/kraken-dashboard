import { useState } from 'react';
import { BookOpen, PlusCircle, FileUp } from 'lucide-react';
import OperacaoModal    from './OperacaoModal';
import CSVImportModal   from './CSVImportModal';
import ProventosSummary from './ProventosSummary';
import HistoricoTable   from './HistoricoTable';
import DataPortability  from './DataPortability';
import IRSection        from './IRSection';

export default function LancamentosSection({ lancamentos, onAdd, onRemove, onUpdate, mergeImport, proventosStats, assets }) {
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);   // lancamento being edited
  const [csvModalOpen, setCSVModalOpen] = useState(false);
  const [importToast, setImportToast] = useState(null); // { added, skipped }

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditEntry(null);
  };

  const handleUpdate = (id, changes) => {
    onUpdate(id, changes);
    handleClose();
  };

  const handleCSVImport = (items) => {
    return new Promise((resolve) => {
      const result = mergeImport(items);
      setImportToast(result);

      // Auto-hide toast after 6s
      setTimeout(() => setImportToast(null), 6000);

      resolve(result);
    });
  };

  return (
    <section>
      {/* Section header — title + export/import + add button */}
      <div
        className="flex items-center justify-between gap-3 px-1 mb-4 flex-wrap"
        style={{ borderBottom: '1px solid #1a1f27', paddingBottom: 12 }}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={13} color="#484f58" />
          <h2 className="text-sm font-medium" style={{ color: '#8b949e' }}>Lançamentos</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <DataPortability lancamentos={lancamentos} mergeImport={mergeImport} />

          {/* CSV Import Button */}
          <button
            onClick={() => setCSVModalOpen(true)}
            className="btn-inline"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '7px 14px',
              borderRadius: 8,
              background:   '#1a2e42',
              border:       '1px solid #17456b',
              color:        '#58a6ff',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1f3350'; e.currentTarget.style.borderColor = '#1f6feb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1a2e42'; e.currentTarget.style.borderColor = '#17456b'; }}
          >
            <FileUp size={14} />
            Importar CSV
          </button>

          {/* Primary CTA */}
          <button
            onClick={() => { setEditEntry(null); setModalOpen(true); }}
            className="btn-inline"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '7px 14px',
              borderRadius: 8,
              background:   '#0d2c1a',
              border:       '1px solid #1a4731',
              color:        '#3fb950',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#112e1d'; e.currentTarget.style.borderColor = '#238636'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0d2c1a'; e.currentTarget.style.borderColor = '#1a4731'; }}
          >
            <PlusCircle size={14} />
            Adicionar Lançamento
          </button>
        </div>
      </div>

      {/* Proventos summary */}
      <div style={{ marginBottom: 16 }}>
        <ProventosSummary stats={proventosStats} assets={assets} />
      </div>

      {/* History table */}
      <HistoricoTable
        lancamentos={lancamentos}
        onRemove={onRemove}
        onEdit={handleEdit}
      />

      {/* IR / Impostos */}
      <IRSection lancamentos={lancamentos} />

      {/* Add / Edit modal */}
      <OperacaoModal
        open={modalOpen}
        editEntry={editEntry}
        onClose={handleClose}
        onAdd={onAdd}
        onUpdate={handleUpdate}
      />

      {/* CSV Import modal */}
      <CSVImportModal
        open={csvModalOpen}
        onClose={() => setCSVModalOpen(false)}
        onImport={handleCSVImport}
      />

      {/* Import toast */}
      {importToast && (
        <div
          style={{
            position:     'fixed',
            bottom:       24,
            right:        24,
            zIndex:       50,
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '12px 16px',
            borderRadius: 8,
            background:   '#0d2c1a',
            border:       '1px solid #1a4731',
            color:        '#3fb950',
            fontSize:     13,
            fontWeight:   500,
            boxShadow:    '0 4px 24px rgba(0,0,0,0.5)',
            animation:    'fadeIn 0.3s ease',
          }}
        >
          <span style={{ fontSize: 16 }}>✓</span>
          <span>
            {importToast.skipped > 0
              ? `${importToast.added} importado${importToast.added > 1 ? 's' : ''}, ${importToast.skipped} duplicata${importToast.skipped > 1 ? 's' : ''} ignorada${importToast.skipped > 1 ? 's' : ''}`
              : `${importToast.added} lançamento${importToast.added > 1 ? 's' : ''} importado${importToast.added > 1 ? 's' : ''}`
            }
          </span>
        </div>
      )}
    </section>
  );
}
