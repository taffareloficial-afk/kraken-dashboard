import { useEffect, useRef } from 'react';
import { X, Brain, Clock, Cpu, Sparkles } from 'lucide-react';

// ── Lightweight markdown → JSX renderer ──────────────────────────────────────
// Handles: h1-h3, bold, italic, inline-code, code blocks, tables, hr, bullets, numbered lists
function MarkdownBlock({ text }) {
  if (!text) return null;

  const lines  = text.split('\n');
  const nodes  = [];
  let i        = 0;
  let keyCount = 0;
  const key    = () => keyCount++;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ─────────────────────────────────────────────────
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={key()}
          style={{
            background:   '#161b22',
            border:       '1px solid #21262d',
            borderRadius: 8,
            padding:      '12px 16px',
            overflowX:    'auto',
            fontSize:     12,
            lineHeight:   1.6,
            color:        '#c9d1d9',
            margin:       '10px 0',
            fontFamily:   'monospace',
          }}
        >
          {codeLines.join('\n')}
        </pre>
      );
      i++;
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────────────
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // filter out separator row (|---|---|)
      const rows = tableLines.filter(l => !l.match(/^\|[\s\-:|]+\|$/));
      const parseCells = l =>
        l.split('|').slice(1, -1).map(c => c.trim());
      const [headerRow, ...bodyRows] = rows;
      const headers = parseCells(headerRow || '');
      nodes.push(
        <div key={key()} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table
            style={{
              width:           '100%',
              borderCollapse:  'separate',
              borderSpacing:   0,
              fontSize:        12,
              border:          '1px solid #21262d',
              borderRadius:    8,
              overflow:        'hidden',
            }}
          >
            <thead>
              <tr style={{ background: '#161b22' }}>
                {headers.map((h, ci) => (
                  <th
                    key={ci}
                    style={{
                      padding:    '8px 12px',
                      textAlign:  'left',
                      color:      '#8b949e',
                      fontWeight: 600,
                      fontSize:   11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #21262d',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{ borderBottom: ri < bodyRows.length - 1 ? '1px solid #161b22' : 'none' }}
                >
                  {parseCells(row).map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '7px 12px',
                        color:   '#c9d1d9',
                        verticalAlign: 'top',
                      }}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      nodes.push(
        <hr key={key()} style={{ border: 'none', borderTop: '1px solid #21262d', margin: '16px 0' }} />
      );
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={key()} style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700, margin: '18px 0 6px', letterSpacing: '-0.2px' }}>
          <InlineText text={line.slice(4)} />
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={key()} style={{ color: '#e6edf3', fontSize: 16, fontWeight: 700, margin: '22px 0 8px', letterSpacing: '-0.3px' }}>
          <InlineText text={line.slice(3)} />
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={key()} style={{ color: '#e6edf3', fontSize: 18, fontWeight: 800, margin: '22px 0 10px', letterSpacing: '-0.5px' }}>
          <InlineText text={line.slice(2)} />
        </h1>
      );
      i++;
      continue;
    }

    // ── Bullet list ───────────────────────────────────────────────────────
    if (line.match(/^[-*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={key()} style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.65, listStyleType: 'disc' }}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Numbered list ─────────────────────────────────────────────────────
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      nodes.push(
        <ol key={key()} style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.65 }}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Empty line ────────────────────────────────────────────────────────
    if (line.trim() === '') {
      nodes.push(<div key={key()} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────
    nodes.push(
      <p key={key()} style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.75, margin: '2px 0' }}>
        <InlineText text={line} />
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

// ── Inline formatting: **bold**, *italic*, `code` ─────────────────────────────
function InlineText({ text }) {
  if (!text) return null;

  // Split on bold (**...**), italic (*...*), and inline code (`...`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: '#e6edf3', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i} style={{ color: '#c9d1d9', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={i}
              style={{
                background:   '#161b22',
                border:       '1px solid #21262d',
                borderRadius: 4,
                padding:      '1px 5px',
                fontSize:     '0.88em',
                color:        '#f97316',
                fontFamily:   'monospace',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Loading animation ─────────────────────────────────────────────────────────
function AnalysisLoader() {
  const dots = ['Lendo sua carteira', 'Avaliando alocação', 'Analisando ativos', 'Gerando recomendações'];
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            24,
        padding:        '60px 24px',
      }}
    >
      {/* Pulsing brain icon */}
      <div
        style={{
          width:        72,
          height:       72,
          borderRadius: '50%',
          background:   'linear-gradient(135deg, #1d4ed820, #7c3aed30)',
          border:       '1px solid #7c3aed40',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          animation:    'aiPulse 2s ease-in-out infinite',
        }}
      >
        <Brain size={32} color="#7c3aed" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Analisando sua carteira…
        </p>
        <p style={{ color: '#484f58', fontSize: 13 }}>
          O Claude está avaliando seus ativos e preparando recomendações personalizadas
        </p>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
        {dots.map((label, idx) => (
          <div
            key={idx}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              animation:  `fadeStepIn 0.5s ease ${idx * 0.4}s both`,
            }}
          >
            <div
              style={{
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   '#7c3aed',
                animation:    `dotPulse 1.5s ease-in-out ${idx * 0.3}s infinite`,
                flexShrink:   0,
              }}
            />
            <span style={{ fontSize: 12, color: '#8b949e' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main modal component ──────────────────────────────────────────────────────
export default function AIAnalysisModal({ result, loading, error, onClose }) {
  const scrollRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const fmtDate = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone:    'America/Sao_Paulo',
      day:         '2-digit',
      month:       '2-digit',
      year:        'numeric',
      hour:        '2-digit',
      minute:      '2-digit',
    });
  };

  return (
    <>
      {/* ── CSS keyframes injected once ─────────────────────────────────── */}
      <style>{`
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); transform: scale(1); }
          50%       { box-shadow: 0 0 0 16px rgba(124,58,237,0); transform: scale(1.04); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.8); }
          50%       { opacity: 1;    transform: scale(1.2); }
        }
        @keyframes fadeStepIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     400,
          background: 'rgba(3,7,18,0.85)',
          backdropFilter: 'blur(6px)',
          animation:  'focusFadeIn 250ms ease both',
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position:  'fixed',
          inset:     0,
          zIndex:    401,
          display:   'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding:   '16px',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            pointerEvents: 'all',
            width:         '100%',
            maxWidth:      760,
            maxHeight:     '90vh',
            display:       'flex',
            flexDirection: 'column',
            background:    '#0d1117',
            border:        '1px solid #21262d',
            borderRadius:  16,
            boxShadow:     '0 32px 80px rgba(0,0,0,0.7)',
            animation:     'modalSlideIn 350ms cubic-bezier(0.16,1,0.3,1) both',
            overflow:      'hidden',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '16px 20px',
              borderBottom:   '1px solid #161b22',
              flexShrink:     0,
              background:     'linear-gradient(135deg, #0d111700 0%, #1d4ed808 50%, #7c3aed08 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width:          32,
                  height:         32,
                  borderRadius:   8,
                  background:     'linear-gradient(135deg, #1d4ed820, #7c3aed30)',
                  border:         '1px solid #7c3aed40',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}
              >
                <Brain size={16} color="#7c3aed" />
              </div>
              <div>
                <h2 style={{ color: '#e6edf3', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
                  Análise de Carteira com IA
                </h2>
                <p style={{ color: '#484f58', fontSize: 11, marginTop: 3 }}>
                  Powered by Claude · Modelo Kraken
                </p>
              </div>
            </div>

            {/* Meta + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {result?.analyzedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} color="#484f58" />
                  <span style={{ fontSize: 11, color: '#484f58' }}>{fmtDate(result.analyzedAt)}</span>
                </div>
              )}
              {result?.outputTokens > 0 && (
                <div
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          4,
                    background:   '#7c3aed15',
                    border:       '1px solid #7c3aed30',
                    borderRadius: 6,
                    padding:      '3px 8px',
                  }}
                >
                  <Cpu size={10} color="#7c3aed" />
                  <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
                    {result.outputTokens.toLocaleString()} tokens
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                title="Fechar (Esc)"
                style={{
                  background:   'transparent',
                  border:       '1px solid #21262d',
                  borderRadius: 7,
                  color:        '#484f58',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  width:        32,
                  height:       32,
                  transition:   'all 200ms ease',
                  flexShrink:   0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background   = '#161b22';
                  e.currentTarget.style.color        = '#e6edf3';
                  e.currentTarget.style.borderColor  = '#30363d';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background   = 'transparent';
                  e.currentTarget.style.color        = '#484f58';
                  e.currentTarget.style.borderColor  = '#21262d';
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div
            ref={scrollRef}
            style={{
              flex:      1,
              overflowY: 'auto',
              padding:   loading || error ? 0 : '20px 24px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#21262d transparent',
            }}
          >
            {loading && <AnalysisLoader />}

            {error && !loading && (
              <div
                style={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            12,
                  padding:        '48px 24px',
                  textAlign:      'center',
                }}
              >
                <div style={{ fontSize: 36 }}>⚠️</div>
                <p style={{ color: '#f85149', fontSize: 15, fontWeight: 600 }}>Erro na análise</p>
                <p style={{ color: '#8b949e', fontSize: 13, maxWidth: 400 }}>{error}</p>
              </div>
            )}

            {result?.analysis && !loading && (
              <>
                {/* Disclaimer */}
                <div
                  style={{
                    display:      'flex',
                    alignItems:   'flex-start',
                    gap:          10,
                    padding:      '10px 14px',
                    background:   '#2c1f0615',
                    border:       '1px solid #6e4c1a30',
                    borderRadius: 8,
                    marginBottom: 20,
                  }}
                >
                  <Sparkles size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5 }}>
                    Esta análise é gerada por inteligência artificial com base nos dados informados e não constitui assessoria financeira regulamentada. Consulte um assessor de investimentos antes de tomar decisões.
                  </p>
                </div>

                {/* Markdown content */}
                <MarkdownBlock text={result.analysis} />
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {result?.model && (
            <div
              style={{
                padding:     '10px 20px',
                borderTop:   '1px solid #161b22',
                display:     'flex',
                alignItems:  'center',
                justifyContent: 'space-between',
                flexShrink:  0,
              }}
            >
              <span style={{ fontSize: 11, color: '#30363d' }}>
                {result.model} · {result.inputTokens?.toLocaleString()} tokens de entrada
              </span>
              <button
                onClick={onClose}
                style={{
                  background:   'transparent',
                  border:       '1px solid #21262d',
                  borderRadius: 7,
                  color:        '#8b949e',
                  cursor:       'pointer',
                  fontSize:     12,
                  padding:      '5px 14px',
                  transition:   'all 200ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background   = '#161b22';
                  e.currentTarget.style.borderColor  = '#30363d';
                  e.currentTarget.style.color        = '#e6edf3';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background   = 'transparent';
                  e.currentTarget.style.borderColor  = '#21262d';
                  e.currentTarget.style.color        = '#8b949e';
                }}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
