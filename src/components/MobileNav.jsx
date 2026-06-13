/**
 * MobileNav — fixed bottom navigation bar for mobile.
 * Receives activeTab + onChange from App and mirrors 4 of the 6 tabs.
 */

import { Home, BarChart2, Calendar, BookOpen, Rocket } from 'lucide-react';

// Análise, Histórico e Análise IA ficam disponíveis apenas no desktop (TabNav).
const MOBILE_TABS = [
  { id: 'resumo',      label: 'Início',      Icon: Home      },
  { id: 'carteira',    label: 'Carteira',    Icon: BarChart2 },
  { id: 'proventos',   label: 'Proventos',   Icon: Calendar  },
  { id: 'projecao',    label: 'Projeção',    Icon: Rocket    },
  { id: 'lancamentos', label: 'Lançamentos', Icon: BookOpen  },
];

export default function MobileNav({ activeTab, onChange }) {
  return (
    <nav
      className="mobile-only"
      style={{
        position:             'fixed',
        bottom:               0,
        left:                 0,
        right:                0,
        zIndex:               100,
        background:           'rgba(10, 14, 20, 0.97)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop:            '1px solid #21262d',
        display:              'flex',
        paddingBottom:        'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {MOBILE_TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex:                    1,
              display:                 'flex',
              flexDirection:           'column',
              alignItems:              'center',
              justifyContent:          'center',
              gap:                     4,
              padding:                 '9px 4px 10px',
              minHeight:               56,
              background:              'transparent',
              border:                  'none',
              cursor:                  'pointer',
              color:                   isActive ? '#3b82f6' : 'var(--c-tx4)',
              transition:              'color 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon size={21} strokeWidth={isActive ? 2.5 : 1.75} />
            <span style={{
              fontSize:      10,
              fontWeight:    isActive ? 600 : 400,
              letterSpacing: '0.02em',
              lineHeight:    1,
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
