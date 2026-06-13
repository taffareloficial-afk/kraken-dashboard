/**
 * CriteriaAlerts — seção de Alertas automáticos de critério.
 *
 * Consome buildAlerts(assets, lancamentos, totalValue) (utils/krakenCompliance):
 * lista cada ativo que saiu dos critérios de ELIMINAÇÃO computáveis localmente,
 * com severidade 🔴 crítico / 🟡 atenção. Críticos primeiro.
 *
 * P/VP, vacância, dívida e recuperação judicial não têm fonte local — ficam
 * a cargo da Análise IA; isso é declarado no rodapé do card.
 */
import { Bell, AlertOctagon, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';

const SEV = {
  critical: { color: '#f85149', bg: '#2d1215', border: '#6e1c1f', Icon: AlertOctagon, label: 'Crítico' },
  warning:  { color: '#f59e0b', bg: '#2c1f06', border: '#6e4c1a', Icon: AlertTriangle, label: 'Atenção' },
};

function AlertRow({ alert }) {
  const s = SEV[alert.severity] ?? SEV.warning;
  const catColor = CATEGORY_COLORS[alert.classe] ?? s.color;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 14px', borderRadius: 10,
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: catColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15,
      }}>
        {CATEGORY_ICONS[alert.classe] ?? <s.Icon size={15} color={s.color} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {alert.ticker && (
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-tx1)' }}>
              {alert.ticker}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>
            {alert.criterio}
          </span>
          <span className="mono" style={{
            fontSize: 10, fontWeight: 700, color: s.color,
            background: s.color + '20', borderRadius: 4, padding: '1px 6px',
          }}>
            {s.label}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--c-tx3)', margin: '3px 0 0' }}>
          {alert.detalhe}
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
          {alert.atual}
        </span>
        <span style={{ display: 'block', fontSize: 10, color: 'var(--c-tx4)' }}>
          limite {alert.limite}
        </span>
      </div>
    </div>
  );
}

export default function CriteriaAlerts({ data, loading = false }) {
  const { alerts = [], criticalCount = 0, warningCount = 0 } = data ?? {};

  const criticos = alerts.filter(a => a.severity === 'critical');
  const atencao  = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="card fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Bell size={15} color={criticalCount > 0 ? '#f85149' : warningCount > 0 ? '#f59e0b' : '#3fb950'} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-tx1)', margin: 0 }}>
          Alertas de critério
        </h2>
        {alerts.length > 0 && (
          <span className="mono" style={{
            fontSize: 11, fontWeight: 700,
            color: criticalCount > 0 ? '#f85149' : '#f59e0b',
            background: (criticalCount > 0 ? '#f85149' : '#f59e0b') + '20',
            border: `1px solid ${(criticalCount > 0 ? '#f85149' : '#f59e0b')}40`,
            borderRadius: 99, padding: '1px 8px',
          }}>
            {alerts.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--c-tx4)' }}>
          {criticalCount > 0 && <span style={{ color: '#f85149' }}>{criticalCount} crítico{criticalCount > 1 ? 's' : ''}</span>}
          {criticalCount > 0 && warningCount > 0 && ' · '}
          {warningCount > 0 && <span style={{ color: '#f59e0b' }}>{warningCount} atenção</span>}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map(i => <div key={i} className="skeleton rounded" style={{ height: 56 }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '28px 0', borderRadius: 10,
          background: '#0d2c1a', border: '1px solid #1a4731',
        }}>
          <CheckCircle size={26} color="#3fb950" />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#3fb950', margin: 0 }}>
            Nenhum ativo fora dos critérios avaliáveis
          </p>
          <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: 0 }}>
            Concentração, DY, % CDI e contagem por classe dentro do modelo Kraken
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {criticos.map(a => <AlertRow key={a.key} alert={a} />)}
          {atencao.map(a => <AlertRow key={a.key} alert={a} />)}
        </div>
      )}

      {/* Rodapé: o que fica a cargo da Análise IA */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-b2)' }}>
        <Sparkles size={12} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11, color: 'var(--c-tx4)', lineHeight: 1.6, margin: 0 }}>
          Alertas automáticos cobrem os critérios quantitativos com dados locais (concentração, DY 12m, % CDI, contagem).
          P/VP, vacância, dívida líq./EBITDA e recuperação judicial são verificados na <strong style={{ color: 'var(--c-tx3)' }}>Análise IA</strong>.
        </p>
      </div>
    </div>
  );
}
