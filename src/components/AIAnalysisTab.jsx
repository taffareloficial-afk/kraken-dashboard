/**
 * AIAnalysisTab — Dedicated full-page AI analysis experience.
 *
 * States:
 *  idle      → hero card with feature list + big CTA button
 *  loading   → animated brain + step indicators
 *  streaming → text appears token-by-token on the page (no modal)
 *  done      → full formatted analysis + metadata footer
 *  error     → error message + retry button
 */
import { useState, useRef, useEffect } from 'react';
import {
  Brain, Sparkles, Clock, Cpu, RefreshCw,
  TrendingUp, Shield, Target, Zap, ChevronRight, Loader2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Inline markdown renderer (h1-h3, bold, italic, code, tables, lists, hr)
// ─────────────────────────────────────────────────────────────────────────────
function InlineText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} style={{ color: '#e6edf3', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} style={{ fontStyle: 'italic', color: '#c9d1d9' }}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return (
            <code key={i} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 4, padding: '1px 5px', fontSize: '0.88em', color: '#f97316', fontFamily: 'monospace' }}>
              {part.slice(1, -1)}
            </code>
          );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownBlock({ text }) {
  if (!text) return null;
  const lines  = text.split('\n');
  const nodes  = [];
  let i = 0;
  let k = 0;
  const key = () => k++;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      nodes.push(<pre key={key()} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: '14px 18px', overflowX: 'auto', fontSize: 12, lineHeight: 1.65, color: '#c9d1d9', margin: '12px 0', fontFamily: 'monospace' }}>{code.join('\n')}</pre>);
      i++; continue;
    }

    // Table
    if (line.startsWith('|') && line.endsWith('|')) {
      const tl = [];
      while (i < lines.length && lines[i].startsWith('|')) { tl.push(lines[i]); i++; }
      const rows    = tl.filter(l => !l.match(/^\|[\s\-:|]+\|$/));
      const cells   = l => l.split('|').slice(1, -1).map(c => c.trim());
      const [hRow, ...bRows] = rows;
      const headers = cells(hRow || '');
      nodes.push(
        <div key={key()} style={{ overflowX: 'auto', margin: '14px 0', borderRadius: 10, border: '1px solid #21262d' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#161b22' }}>
                {headers.map((h, ci) => (
                  <th key={ci} style={{ padding: '9px 14px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #21262d', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < bRows.length - 1 ? '1px solid #21262d20' : 'none' }}>
                  {cells(row).map((cell, ci) => (
                    <td key={ci} style={{ padding: '9px 14px', color: '#c9d1d9', verticalAlign: 'top', lineHeight: 1.5 }}><InlineText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      nodes.push(<hr key={key()} style={{ border: 'none', borderTop: '1px solid #21262d', margin: '20px 0' }} />);
      i++; continue;
    }

    // Headings
    if (line.startsWith('###### ')) {
      nodes.push(<h6 key={key()} style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 700, margin: '14px 0 6px', letterSpacing: '-0.1px' }}><InlineText text={line.slice(7)} /></h6>);
      i++; continue;
    }
    if (line.startsWith('##### ')) {
      nodes.push(<h5 key={key()} style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 700, margin: '16px 0 6px', letterSpacing: '-0.1px' }}><InlineText text={line.slice(6)} /></h5>);
      i++; continue;
    }
    if (line.startsWith('#### ')) {
      nodes.push(<h4 key={key()} style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700, margin: '18px 0 6px', letterSpacing: '-0.15px' }}><InlineText text={line.slice(5)} /></h4>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={key()} style={{ color: '#e6edf3', fontSize: 15, fontWeight: 700, margin: '22px 0 8px', letterSpacing: '-0.2px' }}><InlineText text={line.slice(4)} /></h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={key()} style={{ color: '#e6edf3', fontSize: 18, fontWeight: 700, margin: '28px 0 10px', letterSpacing: '-0.4px', paddingBottom: 8, borderBottom: '1px solid #21262d' }}><InlineText text={line.slice(3)} /></h2>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={key()} style={{ color: '#e6edf3', fontSize: 22, fontWeight: 800, margin: '28px 0 12px', letterSpacing: '-0.6px' }}><InlineText text={line.slice(2)} /></h1>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('> ')) { items.push(lines[i].slice(2)); i++; }
      nodes.push(
        <blockquote key={key()} style={{ borderLeft: '3px solid #7c3aed50', paddingLeft: 14, margin: '10px 0', background: '#7c3aed08', borderRadius: '0 6px 6px 0', padding: '10px 14px' }}>
          {items.map((item, ii) => <p key={ii} style={{ color: '#8b949e', fontSize: 13, lineHeight: 1.7, margin: 0 }}><InlineText text={item} /></p>)}
        </blockquote>
      );
      continue;
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++; }
      nodes.push(
        <ul key={key()} style={{ margin: '8px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, ii) => <li key={ii} style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.7, listStyleType: 'disc' }}><InlineText text={item} /></li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      nodes.push(
        <ol key={key()} style={{ margin: '8px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, ii) => <li key={ii} style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.7 }}><InlineText text={item} /></li>)}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') { nodes.push(<div key={key()} style={{ height: 8 }} />); i++; continue; }

    // Paragraph
    nodes.push(<p key={key()} style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.8, margin: '3px 0' }}><InlineText text={line} /></p>);
    i++;
  }

  return <>{nodes}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading animation
// ─────────────────────────────────────────────────────────────────────────────
const LOAD_STEPS = [
  'Buscando contexto macroeconômico atual…',
  'Avaliando taxa Selic e IPCA…',
  'Pesquisando melhores opções de Renda Fixa…',
  'Analisando indicadores fundamentalistas…',
  'Gerando recomendações personalizadas…',
];

function AnalysisLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '64px 24px' }}>
      <style>{`
        @keyframes aiPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); transform: scale(1); }
          50%      { box-shadow: 0 0 0 20px rgba(124,58,237,0); transform: scale(1.06); }
        }
        @keyframes dotPulse {
          0%,100% { opacity: 0.3; transform: scale(0.7); }
          50%      { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>

      {/* Brain orb */}
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed820, #7c3aed35)', border: '1px solid #7c3aed50', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'aiPulse 2.2s ease-in-out infinite' }}>
        <Brain size={36} color="#7c3aed" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#e6edf3', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Mentor Kraken está analisando…</p>
        <p style={{ color: '#484f58', fontSize: 13 }}>Aguarde enquanto o Mentor busca dados reais e prepara sua análise</p>
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
        {LOAD_STEPS.map((label, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, animation: `stepIn 0.5s ease ${idx * 0.35}s both` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', animation: `dotPulse 1.6s ease ${idx * 0.25}s infinite`, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#8b949e' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle hero card
// ─────────────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: TrendingUp, color: '#3fb950', text: 'Contexto macroeconômico com dados em tempo real (Selic, IPCA, câmbio)' },
  { icon: Target,     color: '#3b82f6', text: 'Avaliação fundamentalista de cada ativo (P/VP, DY, P/L, ROE, vacância)' },
  { icon: Shield,     color: '#8b5cf6', text: 'Diagnóstico da alocação vs Modelo Kraken com desvios e prioridades' },
  { icon: Zap,        color: '#f59e0b', text: 'Recomendação do melhor ativo para aportar agora com justificativa real' },
  { icon: ChevronRight, color: '#ec4899', text: 'Plano de ação priorizado com valores sugeridos e alertas de IR' },
];

function IdleHero({ onStart, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '32px 16px 48px' }}>
      {/* Icon orb */}
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed818, #7c3aed28)', border: '1px solid #7c3aed40', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Brain size={40} color="#7c3aed" />
        {/* Ring decoration */}
        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px dashed #7c3aed25' }} />
        <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px dashed #7c3aed12' }} />
      </div>

      {/* Description */}
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <p style={{ color: '#c9d1d9', fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>
          O <strong style={{ color: '#e6edf3' }}>Mentor Kraken</strong> usa <strong style={{ color: '#a78bfa' }}>Claude Opus</strong> com busca web em tempo real para analisar sua carteira segundo a filosofia de renda passiva.
        </p>
        <p style={{ color: '#484f58', fontSize: 13, lineHeight: 1.6 }}>
          A análise busca dados reais de mercado (Selic, indicadores fundamentalistas) antes de fazer qualquer recomendação.
        </p>
      </div>

      {/* Feature list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, width: '100%', maxWidth: 640 }}>
        {FEATURES.map(({ icon: Icon, color, text }, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-b2)', borderRadius: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '18', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={14} color={color} />
            </div>
            <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onStart}
          disabled={disabled}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            padding:        '14px 32px',
            borderRadius:   12,
            border:         '1px solid',
            borderColor:    disabled ? '#21262d' : '#7c3aed60',
            background:     disabled ? '#161b22' : 'linear-gradient(135deg, #1d4ed815, #7c3aed25)',
            color:          disabled ? '#484f58' : '#c4b5fd',
            fontSize:       15,
            fontWeight:     700,
            cursor:         disabled ? 'not-allowed' : 'pointer',
            transition:     'all 200ms ease',
            letterSpacing:  '-0.2px',
          }}
          onMouseEnter={e => {
            if (disabled) return;
            e.currentTarget.style.borderColor  = '#7c3aedaa';
            e.currentTarget.style.background   = 'linear-gradient(135deg, #1d4ed828, #7c3aed38)';
            e.currentTarget.style.color        = '#ddd6fe';
            e.currentTarget.style.boxShadow    = '0 4px 24px rgba(124,58,237,0.25)';
            e.currentTarget.style.transform    = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            if (disabled) return;
            e.currentTarget.style.borderColor  = '#7c3aed60';
            e.currentTarget.style.background   = 'linear-gradient(135deg, #1d4ed815, #7c3aed25)';
            e.currentTarget.style.color        = '#c4b5fd';
            e.currentTarget.style.boxShadow    = 'none';
            e.currentTarget.style.transform    = 'translateY(0)';
          }}
        >
          <Brain size={18} />
          Analisar Carteira com IA
        </button>

        {disabled && (
          <p style={{ color: '#484f58', fontSize: 12 }}>Adicione ativos em Lançamentos para habilitar a análise</p>
        )}

        {!disabled && (
          <p style={{ color: '#484f58', fontSize: 11 }}>
            ⏱ A análise leva ~30–60 segundos · Usa Claude Opus com busca web em tempo real
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'kraken_last_analysis_ia';

export default function AIAnalysisTab({
  assets,
  lancamentos,
  currentAllocation,
  categoryValues,
  totalValue,
  dailyPnL,
}) {
  const [phase,   setPhase]   = useState('idle');  // idle | loading | streaming | done | error | saved
  const [result,  setResult]  = useState(null);
  const [partial, setPartial] = useState('');
  const [error,   setError]   = useState(null);
  const [errorBillingLink, setErrorBillingLink] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState(null);
  const [isNewAnalysis, setIsNewAnalysis] = useState(false);
  const contentRef = useRef(null);

  // Load saved analysis on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setSavedAnalysis(data);
        setResult(data.result);
        setPhase('saved');
        setIsNewAnalysis(false);
      }
    } catch (err) {
      console.error('Error loading saved analysis:', err);
    }
  }, []);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (phase !== 'streaming') return;
    const el = contentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [partial, phase]);

  const fmtDate = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleAnalyze = async () => {
    setPhase('loading');
    setError(null);
    setErrorBillingLink(false);
    setResult(null);
    setPartial('');

    try {
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets, lancamentos, currentAllocation, categoryValues, totalValue, dailyPnL }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? `Erro ${res.status}`);
        setErrorBillingLink(Boolean(errData.billingLink));
        setPhase('error');
        return;
      }

      // Stream SSE
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   acc     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          let evt;
          try { evt = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (evt.error) {
            setError(evt.error);
            setPhase('error');
            return;
          }

          if (evt.text) {
            acc += evt.text;
            setPartial(acc);
            setPhase('streaming');
          }

          if (evt.done) {
            const resultObj = {
              analysis:     acc,
              model:        evt.model,
              inputTokens:  evt.inputTokens,
              outputTokens: evt.outputTokens,
              analyzedAt:   evt.analyzedAt,
            };
            setResult(resultObj);
            setIsNewAnalysis(true);

            // Save to localStorage
            const savedData = {
              timestamp: new Date().toISOString(),
              isNew: true,
              result: resultObj,
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
              setSavedAnalysis(savedData);
            } catch (err) {
              console.error('Error saving analysis:', err);
            }

            setPhase('done');
          }
        }
      }
    } catch (err) {
      setError(err.message ?? 'Erro de conexão');
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setPartial('');
    setError(null);
    setIsNewAnalysis(false);
  };

  const handleClearAnalysis = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSavedAnalysis(null);
      setResult(null);
      setPhase('idle');
      setIsNewAnalysis(false);
    } catch (err) {
      console.error('Error clearing analysis:', err);
    }
  };

  const handleNewAnalysis = () => {
    setPhase('idle');
    setResult(null);
    setPartial('');
    setError(null);
    setIsNewAnalysis(false);
    setTimeout(() => handleAnalyze(), 100);
  };

  // ── Format timestamp ────────────────────────────────────────────────────────
  const fmtTimestamp = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Page header ─────────────────────────────────────────────────────────────
  const PageHeader = () => (
    <>
      {/* Saved analysis indicator */}
      {phase === 'saved' && savedAnalysis && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🟡</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, margin: '0 0 4px 0' }}>
              ANÁLISE SALVA
            </p>
            <p style={{ color: '#8b949e', fontSize: 12, margin: 0 }}>
              {fmtTimestamp(savedAnalysis.timestamp)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleClearAnalysis}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '6px 14px',
                borderRadius: 7,
                border:       '1px solid #f59e0b40',
                background:   'transparent',
                color:        '#f59e0b',
                fontSize:     12,
                fontWeight:   500,
                cursor:       'pointer',
                transition:   'all 150ms',
                whiteSpace:   'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b60'; e.currentTarget.style.background = '#f59e0b10'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#f59e0b40'; e.currentTarget.style.background = 'transparent'; }}
            >
              🗑 Limpar
            </button>
            <button
              onClick={handleNewAnalysis}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '6px 14px',
                borderRadius: 7,
                border:       '1px solid #7c3aed40',
                background:   'transparent',
                color:        '#7c3aed',
                fontSize:     12,
                fontWeight:   500,
                cursor:       'pointer',
                transition:   'all 150ms',
                whiteSpace:   'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed60'; e.currentTarget.style.background = '#7c3aed10'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#7c3aed40'; e.currentTarget.style.background = 'transparent'; }}
            >
              <RefreshCw size={12} />
              Nova análise
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1d4ed820, #7c3aed30)', border: '1px solid #7c3aed40', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Brain size={22} color="#7c3aed" />
          </div>
          <div>
            <h1 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              Mentor de Investimentos
            </h1>
            <p style={{ color: '#484f58', fontSize: 13, margin: '3px 0 0', lineHeight: 1 }}>
              Análise fundamentalista com IA para renda passiva
            </p>
          </div>
        </div>

        {/* "Analisar novamente" button shown in streaming/done/error states */}
        {phase !== 'idle' && phase !== 'loading' && phase !== 'saved' && (
          <button
            onClick={phase === 'error' ? handleAnalyze : handleReset}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '8px 16px',
              borderRadius: 8,
              border:       '1px solid var(--c-b1)',
              background:   'transparent',
              color:        'var(--c-tx3)',
              fontSize:     13,
              fontWeight:   500,
              cursor:       'pointer',
              transition:   'all 150ms',
              whiteSpace:   'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
          >
            <RefreshCw size={13} />
            {phase === 'error' ? 'Tentar novamente' : 'Nova análise'}
          </button>
        )}
      </div>
    </>
  );

  // ── Saved (recovered from localStorage) ─────────────────────────────────────
  if (phase === 'saved') {
    const displayText = result?.analysis;
    return (
      <div className="fade-in">
        <PageHeader />

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Gradient top bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />

          {/* Content area */}
          <div
            ref={contentRef}
            style={{ padding: '24px 28px', overflowY: 'auto' }}
          >
            {/* Disclaimer */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#2c1f0615', border: '1px solid #6e4c1a30', borderRadius: 8, marginBottom: 24 }}>
              <Sparkles size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5, margin: 0 }}>
                Esta análise é gerada por inteligência artificial com base nos dados informados e não constitui assessoria financeira regulamentada. Consulte um assessor de investimentos antes de tomar decisões.
              </p>
            </div>

            {/* Analysis content */}
            <div>
              <MarkdownBlock text={displayText} />
            </div>
          </div>

          {/* Footer */}
          {result?.model && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--c-b2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--c-s2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Model */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 6 }}>
                  <Brain size={11} color="#f59e0b" />
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{result.model}</span>
                </div>

                {/* Tokens */}
                {result.outputTokens > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Cpu size={11} color="#484f58" />
                    <span style={{ fontSize: 11, color: '#484f58' }}>
                      {result.inputTokens?.toLocaleString()} + {result.outputTokens?.toLocaleString()} tokens
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                {result.analyzedAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} color="#484f58" />
                    <span style={{ fontSize: 11, color: '#484f58' }}>{fmtDate(result.analyzedAt)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleNewAnalysis}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-b1)', background: 'transparent', color: 'var(--c-tx3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
              >
                <RefreshCw size={12} />
                Nova análise
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="fade-in">
        <PageHeader />
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Gradient top bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #1d4ed8, #7c3aed, #ec4899)' }} />
          <IdleHero onStart={handleAnalyze} disabled={totalValue === 0} />
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="fade-in">
        <PageHeader />
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #1d4ed8, #7c3aed, #ec4899)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite' }} />
          <AnalysisLoader />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="fade-in">
        <PageHeader />
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ maxWidth: 520 }}>
            <p style={{ color: '#f85149', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Erro na análise</p>
            <p style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.7, marginBottom: errorBillingLink ? 14 : 0 }}>{error}</p>

            {errorBillingLink && (
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          8,
                  padding:      '10px 18px',
                  borderRadius: 10,
                  border:       '1px solid #7c3aed60',
                  background:   'linear-gradient(135deg, #1d4ed815, #7c3aed25)',
                  color:        '#c4b5fd',
                  fontSize:     13,
                  fontWeight:   700,
                  textDecoration: 'none',
                  marginTop:    4,
                }}
              >
                Adicionar créditos no Anthropic Console →
              </a>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '8px 18px',
              borderRadius: 8,
              border:       '1px solid var(--c-b3)',
              background:   'transparent',
              color:        'var(--c-tx2)',
              fontSize:     13,
              fontWeight:   500,
              cursor:       'pointer',
            }}
          >
            <RefreshCw size={13} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ── Streaming or Done ─────────────────────────────────────────────────────────
  const displayText = phase === 'done' ? result?.analysis : partial;
  const isStreaming = phase === 'streaming';

  // Show new analysis indicator when in 'done' and it's a new analysis
  const showNewIndicator = phase === 'done' && isNewAnalysis;

  return (
    <div className="fade-in">
      <PageHeader />

      {/* New analysis indicator */}
      {showNewIndicator && result?.analyzedAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🟢</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, margin: '0 0 4px 0' }}>
              ANÁLISE EM TEMPO REAL
            </p>
            <p style={{ color: '#8b949e', fontSize: 12, margin: 0 }}>
              {fmtDate(result.analyzedAt)}
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Gradient top bar */}
        <div style={{ height: 3, background: showNewIndicator ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #1d4ed8, #7c3aed, #ec4899)', backgroundSize: isStreaming ? '200% 100%' : undefined, animation: isStreaming ? 'skeleton-shimmer 1.5s infinite' : undefined }} />

        {/* Content area */}
        <div
          ref={contentRef}
          style={{ padding: '24px 28px', overflowY: 'auto' }}
        >
          {/* Streaming indicator */}
          {isStreaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '8px 14px', background: '#7c3aed10', border: '1px solid #7c3aed30', borderRadius: 8 }}>
              <Loader2 size={13} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 500 }}>Mentor Kraken está analisando…</span>
            </div>
          )}

          {/* Disclaimer (shown when done) */}
          {phase === 'done' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#2c1f0615', border: '1px solid #6e4c1a30', borderRadius: 8, marginBottom: 24 }}>
              <Sparkles size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5, margin: 0 }}>
                Esta análise é gerada por inteligência artificial com base nos dados informados e não constitui assessoria financeira regulamentada. Consulte um assessor de investimentos antes de tomar decisões.
              </p>
            </div>
          )}

          {/* Analysis content */}
          <div>
            <MarkdownBlock text={displayText} />
            {/* Blinking cursor while streaming */}
            {isStreaming && (
              <span style={{ display: 'inline-block', width: 8, height: 16, background: '#7c3aed', borderRadius: 2, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 0.9s step-end infinite' }} />
            )}
          </div>
        </div>

        {/* Footer (shown when done) */}
        {phase === 'done' && result?.model && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--c-b2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--c-s2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Model */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: showNewIndicator ? '#22c55e15' : '#7c3aed15', border: `1px solid ${showNewIndicator ? '#22c55e30' : '#7c3aed30'}`, borderRadius: 6 }}>
                <Brain size={11} color={showNewIndicator ? '#22c55e' : '#7c3aed'} />
                <span style={{ fontSize: 11, color: showNewIndicator ? '#22c55e' : '#7c3aed', fontWeight: 600 }}>{result.model}</span>
              </div>

              {/* Tokens */}
              {result.outputTokens > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Cpu size={11} color="#484f58" />
                  <span style={{ fontSize: 11, color: '#484f58' }}>
                    {result.inputTokens?.toLocaleString()} + {result.outputTokens?.toLocaleString()} tokens
                  </span>
                </div>
              )}

              {/* Timestamp */}
              {result.analyzedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} color="#484f58" />
                  <span style={{ fontSize: 11, color: '#484f58' }}>{fmtDate(result.analyzedAt)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {showNewIndicator && (
                <button
                  onClick={handleClearAnalysis}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          6,
                    padding:      '6px 14px',
                    borderRadius: 7,
                    border:       '1px solid var(--c-b1)',
                    background:   'transparent',
                    color:        'var(--c-tx3)',
                    fontSize:     12,
                    fontWeight:   500,
                    cursor:       'pointer',
                    transition:   'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
                >
                  🗑 Limpar
                </button>
              )}

              <button
                onClick={handleNewAnalysis}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-b1)', background: 'transparent', color: 'var(--c-tx3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
              >
                <RefreshCw size={12} />
                Nova análise
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
