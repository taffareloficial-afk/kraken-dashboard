/**
 * ProjectionTab — "Projeção" / Simulador de Metas.
 *
 * Projeta o patrimônio ano a ano (juros compostos: aportes mensais +
 * reinvestimento de proventos via DY + valorização) até a idade-alvo e compara
 * a renda passiva projetada com a meta (padrão R$ 8.000/mês aos 60 anos).
 *
 * Todos os inputs são editáveis e a projeção recalcula em tempo real (useMemo).
 * Persiste os inputs em localStorage. Tema dark/light via variáveis --c-*.
 */

import { useState, useMemo, useEffect } from 'react';
import { useIsDark } from '../ThemeContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import { Rocket, TrendingUp, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { KRAKEN_CRITERIA } from '../config/krakenCriteria';

const C = KRAKEN_CRITERIA;
const LS_KEY = 'kraken_projection_v1';

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtBRL0 = v =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtBRL2 = v =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtCompact = v => {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  return fmtBRL0(v);
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULTS = {
  aporteMensal: 0,                              // sem valor fixo — usuário ajusta
  dyAnual:      C.targets.dyPortfolio,          // 11% — botão sincroniza com o DY real
  valorizacao:  6,                              // estimativa conservadora editável
  idadeAtual:   35,
  idadeAlvo:    60,
  metaMensal:   C.targets.monthlyPassiveIncome, // R$ 8.000
};

function loadInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    return saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

// ── Campo numérico editável (prefixo R$ ou sufixo %) ───────────────────────────
function NumberField({ label, value, onChange, prefix, suffix, min = 0, max = Infinity, step = 1, hint }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--c-tx4)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--c-bg)', border: '1px solid var(--c-b1)',
        borderRadius: 8, padding: '7px 10px',
      }}>
        {prefix && <span style={{ fontSize: 12, color: 'var(--c-tx4)' }}>{prefix}</span>}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => {
            const n = Number(e.target.value);
            onChange(Math.min(max, Math.max(min, isNaN(n) ? min : n)));
          }}
          style={{
            flex: 1, width: '100%', minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--c-tx1)',
            fontFamily: 'JetBrains Mono, monospace',
            fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600,
          }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--c-tx4)' }}>{suffix}</span>}
      </div>
      {hint && <p style={{ fontSize: 10, color: 'var(--c-tx4)', marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

// ── Tooltip do gráfico ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-b1)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--c-tx1)', fontWeight: 700, marginBottom: 4 }}>{p.idade} anos · {p.ano}</p>
      <p style={{ color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
        Patrimônio: {fmtBRL0(p.patrimonio)}
      </p>
      <p style={{ color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>
        Renda passiva: {fmtBRL2(p.rendaMensal)}/mês
      </p>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function ProjectionTab({ totalValue = 0, lancamentos = [], loading = false }) {
  const isDark = useIsDark();

  // DY atual da carteira (proventos dos últimos 12 meses / patrimônio)
  const currentDY = useMemo(() => {
    const cut = new Date();
    cut.setFullYear(cut.getFullYear() - 1);
    const total12m = (lancamentos ?? [])
      .filter(l => l.category === 'provento' && l.date && new Date(l.date) >= cut)
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return totalValue > 0 ? (total12m / totalValue) * 100 : 0;
  }, [lancamentos, totalValue]);

  // Inputs editáveis (persistidos)
  const [inputs, setInputs] = useState(loadInputs);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch { /* noop */ }
  }, [inputs]);
  const set = (k, v) => setInputs(prev => ({ ...prev, [k]: v }));

  // Patrimônio inicial: puxado da carteira, mas editável (override opcional)
  const [patrimonioOverride, setPatrimonioOverride] = useState(null);
  const patrimonioAtual = patrimonioOverride ?? (loading ? 0 : totalValue);

  const { aporteMensal, dyAnual, valorizacao, idadeAtual, idadeAlvo, metaMensal } = inputs;

  // ── Projeção (juros compostos mensais) ───────────────────────────────────────
  const proj = useMemo(() => {
    const anos = Math.max(0, Math.round(idadeAlvo - idadeAtual));
    const months = anos * 12;
    // Crescimento anual = valorização + DY reinvestido; convertido para taxa mensal.
    const annualGrowth = (valorizacao + dyAnual) / 100;
    const r = annualGrowth > -1 ? Math.pow(1 + annualGrowth, 1 / 12) - 1 : 0;

    const thisYear = new Date().getFullYear();
    let p = patrimonioAtual;
    const series = [{
      idade: idadeAtual, ano: thisYear,
      patrimonio: p, rendaMensal: p * (dyAnual / 100) / 12,
    }];
    for (let m = 1; m <= months; m++) {
      p = p * (1 + r) + aporteMensal;
      if (m % 12 === 0) {
        const idade = idadeAtual + m / 12;
        series.push({
          idade, ano: thisYear + m / 12,
          patrimonio: p, rendaMensal: p * (dyAnual / 100) / 12,
        });
      }
    }

    const patrimonioFinal = p;
    const rendaFinal = patrimonioFinal * (dyAnual / 100) / 12;
    // Patrimônio necessário para gerar metaMensal ao DY informado
    const patrimonioMeta = dyAnual > 0 ? (metaMensal * 12) / (dyAnual / 100) : Infinity;
    const achieved = rendaFinal >= metaMensal;
    const faltamMes = Math.max(0, metaMensal - rendaFinal);

    // Aporte mensal necessário para fechar o gap (mantendo r e horizonte)
    const fn = Math.pow(1 + r, months);
    const annuityFactor = r !== 0 ? (fn - 1) / r : months;
    const aporteNecessario = annuityFactor > 0
      ? Math.max(0, (patrimonioMeta - patrimonioAtual * fn) / annuityFactor)
      : Infinity;

    // DY necessário sobre o patrimônio projetado para render a meta
    const dyNecessario = patrimonioFinal > 0 ? (metaMensal * 12) / patrimonioFinal * 100 : Infinity;

    return {
      series, anos, patrimonioFinal, rendaFinal, patrimonioMeta,
      achieved, faltamMes, aporteNecessario, dyNecessario,
    };
  }, [patrimonioAtual, aporteMensal, dyAnual, valorizacao, idadeAtual, idadeAlvo, metaMensal]);

  const axisColor = isDark ? '#636d79' : '#6e7781';
  const gridColor = isDark ? '#21262d' : '#d8dee4';
  const metaFinite = isFinite(proj.patrimonioMeta);

  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 20px', borderBottom: '1px solid var(--c-b2)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#3b82f618', border: '1px solid #3b82f640',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Rocket size={18} color="#3b82f6" />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-tx1)', margin: 0 }}>
            Projeção · Simulador de Metas
          </h1>
          <p style={{ fontSize: 12, color: 'var(--c-tx4)', margin: '2px 0 0' }}>
            No ritmo atual, você chega à meta de {fmtBRL0(metaMensal)}/mês aos {idadeAlvo} anos?
          </p>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Inputs ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
        }}>
          <div>
            <NumberField
              label="Patrimônio atual"
              value={Math.round(patrimonioAtual)}
              onChange={v => setPatrimonioOverride(v)}
              prefix="R$" min={0} step={1000}
            />
            {patrimonioOverride != null && !loading && (
              <button
                onClick={() => setPatrimonioOverride(null)}
                className="btn-inline"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#3b82f6', fontSize: 10, padding: 0,
                }}
              >
                <RotateCcw size={10} /> usar carteira ({fmtCompact(totalValue)})
              </button>
            )}
          </div>

          <NumberField
            label="Aporte mensal"
            value={aporteMensal}
            onChange={v => set('aporteMensal', v)}
            prefix="R$" min={0} step={50}
            hint="varia mês a mês — simule cenários"
          />

          <div>
            <NumberField
              label="DY médio anual"
              value={dyAnual}
              onChange={v => set('dyAnual', v)}
              suffix="%" min={0} max={30} step={0.5}
            />
            {currentDY > 0 && Math.abs(currentDY - dyAnual) > 0.05 && (
              <button
                onClick={() => set('dyAnual', +currentDY.toFixed(2))}
                className="btn-inline"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#3b82f6', fontSize: 10, padding: 0,
                }}
              >
                <RotateCcw size={10} /> usar DY da carteira ({currentDY.toFixed(1)}%)
              </button>
            )}
          </div>

          <NumberField
            label="Valorização anual"
            value={valorizacao}
            onChange={v => set('valorizacao', v)}
            suffix="%" min={0} max={30} step={0.5}
            hint="estimativa conservadora"
          />
          <NumberField
            label="Idade atual"
            value={idadeAtual}
            onChange={v => set('idadeAtual', v)}
            min={0} max={120} step={1}
          />
          <NumberField
            label="Idade alvo"
            value={idadeAlvo}
            onChange={v => set('idadeAlvo', v)}
            min={idadeAtual + 1} max={120} step={1}
          />
          <NumberField
            label="Meta de renda passiva"
            value={metaMensal}
            onChange={v => set('metaMensal', v)}
            prefix="R$" min={0} step={500}
            suffix="/mês"
          />
        </div>

        {/* ── Card resumo + veredito ─────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
        }}>
          {/* Patrimônio projetado */}
          <div style={{ background: 'var(--c-s2)', border: '1px solid var(--c-b2)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: 0, fontWeight: 500 }}>
              Patrimônio aos {idadeAlvo} anos
            </p>
            <p className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-tx1)', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL0(proj.patrimonioFinal)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: '2px 0 0' }}>
              em {proj.anos} anos · {proj.series.length - 1} aportes anuais
            </p>
          </div>

          {/* Renda passiva projetada */}
          <div style={{ background: 'var(--c-s2)', border: '1px solid var(--c-b2)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: 0, fontWeight: 500 }}>
              Renda passiva projetada
            </p>
            <p className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#3fb950', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL2(proj.rendaFinal)}<span style={{ fontSize: 12, color: 'var(--c-tx4)', fontWeight: 400 }}>/mês</span>
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: '2px 0 0' }}>
              meta: {fmtBRL0(metaMensal)}/mês
            </p>
          </div>

          {/* Veredito */}
          <div style={{
            background: proj.achieved ? '#0d2c1a' : '#2c1f06',
            border: `1px solid ${proj.achieved ? '#1a4731' : '#6e4c1a'}`,
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {proj.achieved
                ? <CheckCircle size={18} color="#3fb950" />
                : <AlertTriangle size={18} color="#f59e0b" />}
              <p style={{ fontSize: 14, fontWeight: 800, color: proj.achieved ? '#3fb950' : '#f59e0b', margin: 0 }}>
                {proj.achieved ? 'Meta atingida' : 'Meta não atingida'}
              </p>
            </div>
            <p style={{ fontSize: 12, color: proj.achieved ? '#3fb950' : '#f59e0b', margin: '6px 0 0', opacity: 0.9 }}>
              {proj.achieved
                ? `Sobra ${fmtBRL2(proj.rendaFinal - metaMensal)}/mês acima da meta.`
                : `Faltam ${fmtBRL2(proj.faltamMes)}/mês para a meta.`}
            </p>
          </div>
        </div>

        {/* ── Como fechar o gap (só quando falta) ────────────────────────────── */}
        {!proj.achieved && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
          }}>
            <div style={{ background: 'var(--c-s2)', border: '1px solid var(--c-b2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <TrendingUp size={13} color="#3b82f6" />
                <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 600 }}>Para atingir a meta — aportando mais</span>
              </div>
              <p className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-tx1)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {isFinite(proj.aporteNecessario) ? fmtBRL2(proj.aporteNecessario) : '—'}
                <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 400 }}>/mês</span>
              </p>
              <p style={{ fontSize: 10, color: 'var(--c-tx4)', margin: '3px 0 0' }}>
                {isFinite(proj.aporteNecessario) && proj.aporteNecessario > aporteMensal
                  ? `${fmtBRL2(proj.aporteNecessario - aporteMensal)}/mês a mais que o aporte atual`
                  : 'mantendo DY e valorização atuais'}
              </p>
            </div>

            <div style={{ background: 'var(--c-s2)', border: '1px solid var(--c-b2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <TrendingUp size={13} color="#8b5cf6" />
                <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 600 }}>Ou elevando o DY para</span>
              </div>
              <p className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-tx1)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {isFinite(proj.dyNecessario) ? `${proj.dyNecessario.toFixed(1)}%` : '—'}
                <span style={{ fontSize: 11, color: 'var(--c-tx4)', fontWeight: 400 }}> a.a.</span>
              </p>
              <p style={{ fontSize: 10, color: 'var(--c-tx4)', margin: '3px 0 0' }}>
                DY necessário sobre o patrimônio projetado (atual: {dyAnual}%)
              </p>
            </div>
          </div>
        )}

        {/* ── Gráfico ─────────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--c-tx3)', fontWeight: 600 }}>
              Evolução do patrimônio
            </span>
            {metaFinite && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--c-tx4)' }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed #8b5cf6', display: 'inline-block' }} />
                meta de patrimônio ({fmtCompact(proj.patrimonioMeta)})
              </span>
            )}
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={proj.series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="idade"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false} axisLine={{ stroke: gridColor }}
                  tickFormatter={v => `${v}a`}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false} axisLine={false}
                  width={52}
                  tickFormatter={fmtCompact}
                />
                <Tooltip content={<ChartTooltip />} />
                {metaFinite && proj.patrimonioMeta <= proj.patrimonioFinal * 3 && (
                  <ReferenceLine
                    y={proj.patrimonioMeta}
                    stroke="#8b5cf6"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="patrimonio"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6' }}
                />
                <ReferenceDot
                  x={idadeAlvo}
                  y={proj.patrimonioFinal}
                  r={5}
                  fill={proj.achieved ? '#3fb950' : '#f59e0b'}
                  stroke="var(--c-surface)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--c-tx4)', lineHeight: 1.6, margin: 0 }}>
          📈 Projeção com juros compostos: patrimônio cresce por valorização ({valorizacao}% a.a.) + reinvestimento dos proventos
          (DY {dyAnual}% a.a.) somados aos aportes mensais. É uma estimativa — rentabilidade passada não garante resultado futuro.
        </p>
      </div>
    </div>
  );
}
