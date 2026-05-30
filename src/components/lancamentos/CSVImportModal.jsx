import { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { parseLancamentosCSV, findDuplicates } from '../../lib/csvParser';

export default function CSVImportModal({ open, onClose, onImport }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'importing'
  const [file, setFile] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [items, setItems] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [result, setResult] = useState(null); // { added, skipped } após import
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const processCSV = (f, csvText) => {
    console.log('[CSVImport] Processando arquivo:', f.name, '| tamanho:', csvText?.length, 'chars');
    const { items: parsed, errors } = parseLancamentosCSV(csvText);
    console.log('[CSVImport] Parser retornou:', parsed.length, 'itens válidos,', errors.length, 'erros');
    if (errors.length > 0) console.log('[CSVImport] Erros:', errors);

    // Detectar duplicatas
    const { unique, duplicates: dupes } = findDuplicates(parsed);
    console.log('[CSVImport] Após dedup:', unique.length, 'únicos,', dupes.length, 'duplicatas');

    setFile(f);
    setParseErrors(errors);
    setItems(unique);
    setDuplicates(dupes);
    // Sempre avança para preview — assim erros ficam visíveis ao usuário
    setStep('preview');
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    console.log('[CSVImport] handleFileSelect — arquivo selecionado:', f?.name);
    if (!f) return;

    if (!f.name.endsWith('.csv')) {
      alert('Por favor, selecione um arquivo CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        processCSV(f, event.target?.result);
      } catch (err) {
        console.error('[CSVImport] Erro no processamento:', err);
        setFile(f);
        setParseErrors([{ rowNumber: 0, error: err.message }]);
        setItems([]);
        setDuplicates([]);
        setStep('preview');
      }
    };
    reader.onerror = () => {
      console.error('[CSVImport] Erro ao ler arquivo:', reader.error);
      setParseErrors([{ rowNumber: 0, error: 'Erro ao ler o arquivo' }]);
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleDragDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    console.log('[CSVImport] handleDragDrop — arquivo:', f?.name);
    if (f && f.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          processCSV(f, event.target?.result);
        } catch (err) {
          console.error('[CSVImport] Erro no processamento:', err);
          setFile(f);
          setParseErrors([{ rowNumber: 0, error: err.message }]);
          setItems([]);
          setDuplicates([]);
          setStep('preview');
        }
      };
      reader.onerror = () => {
        console.error('[CSVImport] Erro ao ler arquivo:', reader.error);
        setParseErrors([{ rowNumber: 0, error: 'Erro ao ler o arquivo' }]);
        setStep('preview');
      };
      reader.readAsText(f, 'UTF-8');
    }
  };

  const handleImport = async () => {
    if (items.length === 0) return;

    setImporting(true);
    try {
      const res = await onImport(items);
      setResult(res); // { added, skipped }
      setStep('success');
    } catch (err) {
      console.error('Import error:', err);
      setParseErrors([{ rowNumber: 0, error: `Erro ao importar: ${err.message}` }]);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setParseErrors([]);
    setItems([]);
    setDuplicates([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      width: '100vw',
      height: '100vh',
      top: 0,
      left: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }}>
      <div style={{
        background: 'var(--c-bg2)',
        borderRadius: 12,
        border: '1px solid var(--c-b1)',
        width: '90%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflow: 'auto',
        padding: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-tx1)' }}>
            {step === 'upload' && '📁 Importar CSV'}
            {step === 'preview' && '✓ Pré-visualizar'}
            {step === 'success' && '✅ Importação Concluída'}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--c-b3)',
              fontSize: 20,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step: UPLOAD */}
        {step === 'upload' && (
          <div>
            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDragDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--c-b2)',
                borderRadius: 8,
                padding: 32,
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--c-bg3)',
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--c-b3)';
                e.currentTarget.style.background = 'var(--c-bg4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--c-b2)';
                e.currentTarget.style.background = 'var(--c-bg3)';
              }}
            >
              <Upload size={32} style={{ color: 'var(--c-b2)', marginBottom: 12 }} />
              <p style={{ color: 'var(--c-tx2)', fontSize: 14, marginBottom: 4 }}>
                <strong>Arraste um CSV aqui</strong> ou clique para selecionar
              </p>
              <p style={{ color: 'var(--c-b2)', fontSize: 12 }}>
                Formato esperado: Data, Tipo, Ativo, Quantidade, Preço Unitário, Total
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Sample CSV */}
            <details style={{ marginBottom: 16 }}>
              <summary style={{ color: 'var(--c-b3)', cursor: 'pointer', fontSize: 12 }}>
                Ver exemplo de CSV
              </summary>
              <pre style={{
                background: 'var(--c-bg3)',
                padding: 12,
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--c-tx2)',
                overflow: 'auto',
                marginTop: 8,
              }}>
Data,Tipo,Ativo,Quantidade,Preço Unitário,Total
2025-09-15,Compra,CDB,1.0,1000.00,1000.00
30/05/2025,Compra,ITSA4,100,18.50,1850.00
15/06/2025,Dividendo,ITSA4,,,50.25
              </pre>
            </details>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--c-b2)',
                  background: 'transparent',
                  color: 'var(--c-tx2)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Step: PREVIEW */}
        {step === 'preview' && (
          <div>
            {/* Status cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{
                background: 'var(--c-bg3)',
                padding: 12,
                borderRadius: 6,
                borderLeft: '3px solid #3fb950',
              }}>
                <div style={{ fontSize: 12, color: 'var(--c-b2)' }}>Será importado</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#3fb950' }}>{items.length}</div>
              </div>

              {duplicates.length > 0 && (
                <div style={{
                  background: 'var(--c-bg3)',
                  padding: 12,
                  borderRadius: 6,
                  borderLeft: '3px solid #d29922',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--c-b2)' }}>Duplicatas ignoradas</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#d29922' }}>
                    {duplicates.length}
                  </div>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div style={{
                  background: 'var(--c-bg3)',
                  padding: 12,
                  borderRadius: 6,
                  borderLeft: '3px solid #f85149',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--c-b2)' }}>Erros</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#f85149' }}>
                    {parseErrors.length}
                  </div>
                </div>
              )}
            </div>

            {/* Error list */}
            {parseErrors.length > 0 && (
              <div style={{
                background: '#2d1215',
                border: '1px solid #6e1c1f',
                borderRadius: 6,
                padding: 12,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <AlertCircle size={16} style={{ color: '#f85149', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#f85149', fontWeight: 600 }}>
                      {parseErrors.length} erro{parseErrors.length > 1 ? 's' : ''} encontrado{parseErrors.length > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#f2704b', marginTop: 6 }}>
                      {parseErrors.slice(0, 3).map((err, i) => (
                        <div key={i}>
                          Linha {err.rowNumber}: {err.error}
                        </div>
                      ))}
                      {parseErrors.length > 3 && <div>... e mais {parseErrors.length - 3}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Items preview */}
            {items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--c-b3)', marginBottom: 8 }}>
                  Primeiros 5 lançamentos:
                </div>
                <div style={{
                  background: 'var(--c-bg3)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  fontSize: 11,
                }}>
                  {items.slice(0, 5).map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 8,
                        borderBottom: i < 4 ? '1px solid var(--c-b1)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: 'var(--c-tx2)' }}>
                        {item.date} · <strong>{item.ticker}</strong> {item.type}
                      </span>
                      <span style={{ color: 'var(--c-b2)' }}>
                        {item.quantity ? `${item.quantity} × R$ ${item.price?.toFixed(2)}` : `R$ ${item.amount?.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                  {items.length > 5 && (
                    <div style={{
                      padding: 8,
                      color: 'var(--c-b2)',
                      textAlign: 'center',
                    }}>
                      ... e mais {items.length - 5} lançamentos
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duplicates warning */}
            {duplicates.length > 0 && (
              <div style={{
                background: '#2d2c1a',
                border: '1px solid #5a5a1f',
                borderRadius: 6,
                padding: 12,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} style={{ color: '#d29922', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#d29922', fontWeight: 600 }}>
                      {duplicates.length} duplicata{duplicates.length > 1 ? 's' : ''} serão ignoradas
                    </div>
                    <div style={{ fontSize: 11, color: '#b8940a', marginTop: 6 }}>
                      {duplicates.slice(0, 2).map((dup, i) => (
                        <div key={i}>
                          {dup.item.date} {dup.item.ticker} {dup.item.type}
                        </div>
                      ))}
                      {duplicates.length > 2 && <div>... e mais {duplicates.length - 2}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--c-b2)',
                  background: 'transparent',
                  color: 'var(--c-tx2)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || items.length === 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #1a4731',
                  background: '#0d2c1a',
                  color: '#3fb950',
                  cursor: items.length > 0 && !importing ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: items.length > 0 && !importing ? 1 : 0.5,
                }}
              >
                {importing ? '⏳ Importando...' : `✓ Importar ${items.length} lançamentos`}
              </button>
            </div>
          </div>
        )}

        {/* Step: SUCCESS */}
        {step === 'success' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <CheckCircle size={48} style={{ color: '#3fb950', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#3fb950', marginBottom: 8 }}>
                Importação Concluída!
              </h3>
              <p style={{ color: 'var(--c-tx2)', fontSize: 13 }}>
                Os lançamentos foram adicionados ao seu portfólio
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{
                background: 'var(--c-bg3)',
                padding: 16,
                borderRadius: 6,
                borderLeft: '3px solid #3fb950',
              }}>
                <div style={{ fontSize: 12, color: 'var(--c-b2)', marginBottom: 4 }}>Importados</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#3fb950' }}>
                  {result.added}
                </div>
              </div>

              {result.skipped > 0 && (
                <div style={{
                  background: 'var(--c-bg3)',
                  padding: 16,
                  borderRadius: 6,
                  borderLeft: '3px solid #d29922',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--c-b2)', marginBottom: 4 }}>Duplicatas</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#d29922' }}>
                    {result.skipped}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid #1a4731',
                  background: '#0d2c1a',
                  color: '#3fb950',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Importar mais
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid var(--c-b2)',
                  background: 'transparent',
                  color: 'var(--c-tx2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
