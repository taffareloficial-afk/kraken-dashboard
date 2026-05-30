/**
 * ErrorBoundary — catches any unhandled React render errors and shows a
 * recovery screen instead of a blank white page.
 *
 * Usage: wrap <App /> in <ErrorBoundary> inside main.jsx.
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Kraken] Render error:', error, info?.componentStack ?? '');
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? 'Erro desconhecido';

    return (
      <div style={{
        minHeight:      '100dvh',
        background:     '#030712',
        color:          '#e6edf3',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 16px',
        fontFamily:     'system-ui, -apple-system, sans-serif',
        textAlign:      'center',
        gap:            20,
      }}>
        {/* Icon */}
        <div style={{
          width:          64,
          height:         64,
          borderRadius:   '50%',
          background:     'rgba(248,81,73,0.12)',
          border:         '1px solid rgba(248,81,73,0.3)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       28,
        }}>
          ⚠
        </div>

        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#e6edf3' }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 4px' }}>
            O Kraken Dashboard encontrou um erro inesperado.
          </p>
          <p style={{
            fontSize:     11,
            color:        '#484f58',
            fontFamily:   'monospace',
            background:   '#0d1117',
            border:       '1px solid #21262d',
            borderRadius: 6,
            padding:      '6px 10px',
            marginTop:    10,
            wordBreak:    'break-all',
          }}>
            {msg}
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding:      '10px 24px',
            borderRadius: 8,
            background:   '#1d4ed8',
            border:       '1px solid #2563eb',
            color:        '#fff',
            fontSize:     14,
            fontWeight:   600,
            cursor:       'pointer',
          }}
        >
          Recarregar página
        </button>

        <p style={{ fontSize: 11, color: '#484f58', maxWidth: 300 }}>
          Se o problema persistir, limpe o cache do navegador ou acesse em outra rede.
        </p>
      </div>
    );
  }
}
