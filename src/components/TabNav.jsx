/**
 * TabNav — horizontal desktop tab bar, sticky below the header.
 * Hidden on mobile (MobileNav handles mobile navigation).
 * Uses role="tablist" / role="tab" for full ARIA tab-panel semantics.
 */

import { LayoutDashboard, Briefcase, TrendingUp, LineChart, Landmark, ClipboardList, Zap, Rocket } from 'lucide-react';

export const TABS = [
  { id: 'resumo',        label: 'Resumo',        Icon: LayoutDashboard },
  { id: 'carteira',      label: 'Carteira',      Icon: Briefcase },
  { id: 'analise',       label: 'Análise',       Icon: TrendingUp },
  { id: 'historico',     label: 'Histórico',     Icon: LineChart },
  { id: 'proventos',     label: 'Proventos',     Icon: Landmark },
  { id: 'projecao',      label: 'Projeção',      Icon: Rocket },
  { id: 'lancamentos',   label: 'Lançamentos',   Icon: ClipboardList },
  { id: 'analise-ia-v3', label: 'Análise IA v3', Icon: Zap },
];

export default function TabNav({ activeTab, onChange }) {
  // Allow arrow-key navigation within the tab list
  const handleKeyDown = (e, id, idx) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(TABS[(idx + 1) % TABS.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(TABS[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(TABS[TABS.length - 1].id);
    }
  };

  return (
    <nav
      className="desktop-only"
      aria-label="Navegação principal"
      style={{
        position:             'sticky',
        top:                  54,
        zIndex:               40,
        background:           'var(--c-header-bg)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom:         '1px solid var(--c-b1)',
      }}
    >
      <div
        role="tablist"
        aria-label="Abas do dashboard"
        style={{ padding: '0 40px', display: 'flex', gap: 0, overflowX: 'auto' }}
      >
        {TABS.map(({ id, label, Icon }, idx) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              aria-controls={`tabpanel-${id}`}
              id={`tab-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(e) => handleKeyDown(e, id, idx)}
              className="btn-inline"
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '0 18px',
                height:       42,
                background:   'transparent',
                border:       'none',
                borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
                color:        active ? 'var(--c-tx1)' : 'var(--c-tx4)',
                fontSize:     13,
                fontWeight:   active ? 600 : 400,
                cursor:       'pointer',
                whiteSpace:   'nowrap',
                transition:   'color 0.15s, border-color 0.15s',
                marginBottom: -1,
                flexShrink:   0,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--c-tx3)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--c-tx4)'; }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.75} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
