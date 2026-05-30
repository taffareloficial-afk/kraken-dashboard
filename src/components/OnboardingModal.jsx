/**
 * OnboardingModal — first-launch walkthrough (5 steps).
 *
 * Props:
 *   open    boolean — controlled by useOnboarding
 *   onDone  () => void — called when user finishes or skips
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight,
  ClipboardList, Briefcase, Landmark, TrendingUp, LineChart,
  ArrowRight,
} from 'lucide-react';
import KrakenLogo from './KrakenLogo';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id:    'lancamentos',
    icon:  ClipboardList,
    color: '#3b82f6',
    glow:  'rgba(59,130,246,0.18)',
    bg:    'rgba(59,130,246,0.08)',
    tab:   'Lançamentos',
    title: 'Registre suas operações',
    desc:  'Na aba Lançamentos, adicione compras, vendas, rendimentos e dividendos. Tudo fica salvo localmente no seu navegador.',
    tips: [
      'Compras e vendas de ações, FIIs, ETFs e cripto',
      'Rendimentos de FIIs e dividendos de ações',
      'Importação e exportação em JSON',
    ],
  },
  {
    id:    'carteira',
    icon:  Briefcase,
    color: '#8b5cf6',
    glow:  'rgba(139,92,246,0.18)',
    bg:    'rgba(139,92,246,0.08)',
    tab:   'Carteira',
    title: 'Acompanhe sua carteira',
    desc:  'A aba Carteira consolida todos os seus ativos em tempo real — preço atual, variação do dia e retorno desde a compra.',
    tips: [
      'Preços ao vivo via Yahoo Finance e CoinGecko',
      'Retorno total de cada posição',
      'Clique em qualquer ativo para ver detalhes',
    ],
  },
  {
    id:    'proventos',
    icon:  Landmark,
    color: '#3fb950',
    glow:  'rgba(63,185,80,0.18)',
    bg:    'rgba(63,185,80,0.08)',
    tab:   'Proventos',
    title: 'Acompanhe seus proventos',
    desc:  'A aba Proventos mostra os próximos dividendos e rendimentos dos ativos que você possui, com data ex e valor estimado.',
    tips: [
      'Próximas datas ex-dividendo',
      'Valor estimado com base nas suas cotas',
      'Registro automático de proventos recebidos',
    ],
  },
  {
    id:    'analise',
    icon:  TrendingUp,
    color: '#f59e0b',
    glow:  'rgba(245,158,11,0.18)',
    bg:    'rgba(245,158,11,0.08)',
    tab:   'Análise',
    title: 'Analise seu portfólio',
    desc:  'Compare sua carteira com o Modelo Kraken e os benchmarks CDI e Ibovespa. Veja insights e sugestões de rebalanceamento.',
    tips: [
      'Comparativo com CDI e Ibovespa',
      'Sugestões de aporte baseadas no Modelo Kraken',
      'Metas e acompanhamento de objetivos',
    ],
  },
  {
    id:    'historico',
    icon:  LineChart,
    color: '#06b6d4',
    glow:  'rgba(6,182,212,0.18)',
    bg:    'rgba(6,182,212,0.08)',
    tab:   'Histórico',
    title: 'Histórico detalhado',
    desc:  'Filtre, edite e exclua lançamentos na aba Histórico. Veja o extrato completo com totais por operação.',
    tips: [
      'Filtros por tipo, ativo e período',
      'Edição e exclusão de lançamentos',
      'Expandir linha para ver detalhes completos',
    ],
  },
];

const TOTAL = STEPS.length;

// ── Focus trap selector ───────────────────────────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIllustration({ step, dir }) {
  const Icon = step.icon;

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '32px 24px 20px',
        background:     `radial-gradient(ellipse 80% 60% at 50% 0%, ${step.glow}, transparent 70%)`,
        position:       'relative',
        overflow:       'hidden',
        minHeight:      220,
      }}
    >
      {/* Decorative rings */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        transform:    'translate(-50%, -50%)',
        width:        280,
        height:       280,
        borderRadius: '50%',
        border:       `1px solid ${step.color}18`,
        pointerEvents:'none',
      }} />
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        transform:    'translate(-50%, -50%)',
        width:        200,
        height:       200,
        borderRadius: '50%',
        border:       `1px solid ${step.color}28`,
        pointerEvents:'none',
      }} />

      {/* Icon orb */}
      <div style={{
        width:        88,
        height:       88,
        borderRadius: '50%',
        background:   step.bg,
        border:       `2px solid ${step.color}50`,
        display:      'flex',
        alignItems:   'center',
        justifyContent:'center',
        boxShadow:    `0 0 32px ${step.glow}`,
        marginBottom: 20,
        position:     'relative',
        zIndex:       1,
      }}>
        <Icon size={38} color={step.color} strokeWidth={1.5} />
      </div>

      {/* Tab badge */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '4px 12px',
        borderRadius: 99,
        background:   step.bg,
        border:       `1px solid ${step.color}40`,
        position:     'relative',
        zIndex:       1,
      }}>
        <Icon size={11} color={step.color} />
        <span style={{ fontSize: 11, fontWeight: 600, color: step.color, letterSpacing: '0.03em' }}>
          Aba {step.tab}
        </span>
      </div>
    </div>
  );
}

function DotIndicator({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width:        i === current ? 20 : 6,
            height:       6,
            borderRadius: 99,
            background:   i === current ? '#3b82f6' : '#30363d',
            transition:   'all 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingModal({ open, onDone }) {
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1);   // 1 = forward, -1 = back (for future animation)
  const dialogRef = useRef(null);
  const titleId   = 'onboarding-title';

  const current = STEPS[step];
  const isLast  = step === TOTAL - 1;

  // Reset step on (re-)open
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Focus trap + ESC
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      const els = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (els?.length) els[0].focus();
    }, 80);

    const handler = (e) => {
      if (e.key === 'Escape') { onDone(); return; }
      if (e.key !== 'Tab') return;
      const els = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (!els.length) return;
      const first = els[0];
      const last  = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handler);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handler); };
  }, [open, onDone]);

  const goNext = useCallback(() => {
    if (isLast) { onDone(); return; }
    setDir(1);
    setStep(s => s + 1);
  }, [isLast, onDone]);

  const goPrev = useCallback(() => {
    if (step === 0) return;
    setDir(-1);
    setStep(s => s - 1);
  }, [step]);

  if (!open) return null;

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(6px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         2000,
        padding:        16,
        animation:      'focusFadeIn 0.22s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDone(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background:    'var(--c-surface)',
          border:        '1px solid var(--c-b1)',
          borderRadius:  18,
          width:         '100%',
          maxWidth:      500,
          boxShadow:     '0 32px 80px rgba(0,0,0,0.7)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          maxHeight:     '95vh',
          animation:     'fadeSlideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 18px 0',
          flexShrink:     0,
        }}>
          {/* Logo + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KrakenLogo size={22} id="onb" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-tx3)', letterSpacing: '0.04em' }}>
              KRAKEN DASHBOARD
            </span>
          </div>

          {/* Step counter + close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 500 }}>
              {step + 1} / {TOTAL}
            </span>
            <button
              onClick={onDone}
              aria-label="Fechar guia de boas-vindas"
              className="btn-inline"
              style={{
                background:   'transparent',
                border:       'none',
                cursor:       'pointer',
                padding:      5,
                borderRadius: 7,
                color:        'var(--c-tx4)',
                display:      'flex',
                alignItems:   'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-s2)'; e.currentTarget.style.color = 'var(--c-tx2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-tx4)'; }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Illustration area ───────────────────────────────────────────── */}
        <StepIllustration step={current} dir={dir} />

        {/* ── Text content ────────────────────────────────────────────────── */}
        <div style={{ padding: '0 28px 4px', flex: 1, overflowY: 'auto' }}>
          <h2
            id={titleId}
            style={{
              fontSize:      22,
              fontWeight:    700,
              color:         'var(--c-tx1)',
              margin:        '0 0 10px',
              letterSpacing: '-0.4px',
              lineHeight:    1.2,
            }}
          >
            {current.title}
          </h2>

          <p style={{
            fontSize:   14,
            color:      'var(--c-tx3)',
            lineHeight: 1.6,
            margin:     '0 0 18px',
          }}>
            {current.desc}
          </p>

          {/* Tips list */}
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.tips.map((tip, i) => (
              <li
                key={i}
                style={{
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap:        10,
                  fontSize:   13,
                  color:      'var(--c-tx2)',
                }}
              >
                <span style={{
                  flexShrink:   0,
                  width:        18,
                  height:       18,
                  borderRadius: '50%',
                  background:   current.bg,
                  border:       `1px solid ${current.color}40`,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  marginTop:    1,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: current.color }}>{i + 1}</span>
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          padding:     '18px 28px 22px',
          display:     'flex',
          alignItems:  'center',
          gap:         12,
          flexShrink:  0,
          borderTop:   '1px solid var(--c-b1)',
          marginTop:   18,
        }}>
          {/* Dot indicator */}
          <DotIndicator total={TOTAL} current={step} />

          <div style={{ flex: 1 }} />

          {/* Skip / Prev */}
          {step === 0 ? (
            <button
              onClick={onDone}
              className="btn-inline"
              style={{
                background:   'transparent',
                border:       'none',
                cursor:       'pointer',
                padding:      '8px 14px',
                borderRadius: 8,
                fontSize:     13,
                color:        'var(--c-tx4)',
                fontWeight:   500,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-tx2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-tx4)'; }}
            >
              Pular
            </button>
          ) : (
            <button
              onClick={goPrev}
              className="btn-inline"
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          4,
                background:   'transparent',
                border:       '1px solid var(--c-b1)',
                cursor:       'pointer',
                padding:      '8px 14px',
                borderRadius: 8,
                fontSize:     13,
                color:        'var(--c-tx3)',
                fontWeight:   500,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Anterior
            </button>
          )}

          {/* Next / Start */}
          <button
            onClick={goNext}
            className="btn-inline"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '9px 20px',
              borderRadius: 8,
              background:   isLast ? '#1d4ed8' : '#3b82f6',
              border:       `1px solid ${isLast ? '#2563eb' : '#60a5fa'}`,
              color:        '#fff',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
              transition:   'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLast ? '#1d4ed8' : '#3b82f6'; }}
          >
            {isLast ? (
              <>Começar <ArrowRight size={14} aria-hidden="true" /></>
            ) : (
              <>Próximo <ChevronRight size={14} aria-hidden="true" /></>
            )}
          </button>
        </div>

        {/* Decorative gradient line at top */}
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          height:     2,
          background: `linear-gradient(90deg, ${current.color}00 0%, ${current.color} 50%, ${current.color}00 100%)`,
          transition: 'background 0.4s ease',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}
