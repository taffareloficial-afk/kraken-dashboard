/**
 * LoginScreen — gate de login obrigatório (e-mail OTP / magic link).
 *
 * Exibido em tela cheia quando o Supabase está habilitado e não há sessão.
 * O usuário informa o e-mail, recebe um link de acesso e, ao clicar, volta
 * autenticado (onAuthStateChange no useSupabaseAuth dispara e o app carrega).
 *
 * Consistente com o tema dark/light via variáveis --c-*.
 */
import { useState } from 'react';
import { Mail, ShieldCheck, Loader2, Sun, Moon, CheckCircle } from 'lucide-react';
import KrakenLogo from './KrakenLogo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onSubmit, isDark, onToggleTheme }) {
  const [email,  setEmail]  = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState('');

  const valid = EMAIL_RE.test(email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || status === 'sending') return;
    setStatus('sending');
    setErrMsg('');
    try {
      const { error } = await onSubmit(email.trim());
      if (error) {
        setStatus('error');
        setErrMsg(error.message ?? 'Não foi possível enviar o link.');
      } else {
        setStatus('sent');
      }
    } catch (err) {
      setStatus('error');
      setErrMsg(err?.message ?? 'Erro inesperado.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--c-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative',
    }}>
      {/* Toggle de tema no canto */}
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
          className="btn-inline"
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent', border: '1px solid var(--c-b1)',
            color: 'var(--c-tx3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      )}

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        {/* Marca */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <KrakenLogo size={48} id="login" />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-tx1)', margin: 0, letterSpacing: '-0.3px' }}>
              Kraken Dashboard
            </h1>
            <p style={{ fontSize: 12, color: 'var(--c-tx4)', margin: '4px 0 0' }}>
              Acesso restrito — entre com seu e-mail
            </p>
          </div>
        </div>

        {status === 'sent' ? (
          /* Estado: link enviado */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '20px 16px', borderRadius: 12,
            background: '#0d2c1a', border: '1px solid #1a4731',
          }}>
            <CheckCircle size={28} color="#3fb950" />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#3fb950', margin: 0, textAlign: 'center' }}>
              Link enviado
            </p>
            <p style={{ fontSize: 12, color: 'var(--c-tx3)', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
              Enviamos um link de acesso para <strong style={{ color: 'var(--c-tx2)' }}>{email.trim()}</strong>.
              Abra o e-mail e clique no link para entrar — esta página carrega sozinha após a confirmação.
            </p>
            <button
              onClick={() => { setStatus('idle'); }}
              className="btn-inline"
              style={{
                marginTop: 4, background: 'transparent', border: 'none',
                color: '#3b82f6', fontSize: 12, cursor: 'pointer',
              }}
            >
              Usar outro e-mail
            </button>
          </div>
        ) : (
          /* Estado: formulário */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--c-bg)', border: '1px solid var(--c-b1)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <Mail size={15} color="var(--c-tx4)" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                placeholder="seu@email.com"
                autoFocus
                autoComplete="email"
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--c-tx1)', fontSize: 14,
                }}
              />
            </div>

            {status === 'error' && (
              <p style={{ fontSize: 12, color: '#f85149', margin: 0 }}>⚠ {errMsg}</p>
            )}

            <button
              type="submit"
              disabled={!valid || status === 'sending'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 16px', borderRadius: 10, border: '1px solid',
                borderColor: valid ? '#3b82f660' : 'var(--c-b1)',
                background:  valid ? 'linear-gradient(135deg, #1d4ed815, #3b82f625)' : 'var(--c-s2)',
                color:       valid ? '#93c5fd' : 'var(--c-tx4)',
                fontSize: 14, fontWeight: 700,
                cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
              }}
            >
              {status === 'sending'
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</>
                : <>Enviar link de acesso</>
              }
            </button>
          </form>
        )}

        {/* Rodapé de segurança */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--c-b2)' }}>
          <ShieldCheck size={13} color="#3fb950" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: 'var(--c-tx4)', margin: 0, lineHeight: 1.5 }}>
            Seus dados de carteira são privados e protegidos por autenticação.
          </p>
        </div>
      </div>
    </div>
  );
}
