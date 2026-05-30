/**
 * SyncBadge — cloud sync status indicator + sign-in trigger.
 *
 * Supports two backends (detected automatically from env vars):
 *   • Supabase  → "Entrar com Google" + "Entrar com Email" (magic link)
 *   • Firebase  → "Entrar com Google" only (existing behaviour)
 *
 * States:
 *   • Backend not configured → hidden
 *   • Auth loading           → subtle cloud icon
 *   • Not signed in          → "☁ Sincronizar" button → dropdown with sign-in options
 *   • Signed in, syncing     → spinning cloud
 *   • Signed in, synced      → green cloud ✓
 *   • Signed in, error       → yellow ⚠
 */
import { useState, useRef, useEffect } from 'react';
import {
  Cloud, CloudDownload, LogIn, LogOut, Check, AlertTriangle, Mail, Loader2,
} from 'lucide-react';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { FIREBASE_ENABLED } from '../lib/firebase';

const SYNC_ENABLED = FIREBASE_ENABLED || SUPABASE_ENABLED;

export default function SyncBadge({
  user,
  authLoading,
  syncStatus,          // 'idle' | 'syncing' | 'synced' | 'error'
  onSignIn,            // Google sign-in (works for both backends)
  onSignInWithEmail,   // (email: string) => Promise<{error}> — Supabase only
  onSignOut,
}) {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [emailMode, setEmailMode] = useState(false); // show email input
  const [email,     setEmail]     = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailErr,  setEmailErr]  = useState('');
  const [sending,   setSending]   = useState(false);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Focus email input when mode activates
  useEffect(() => {
    if (emailMode && inputRef.current) inputRef.current.focus();
  }, [emailMode]);

  if (!SYNC_ENABLED) return null;

  // ── Shared button base style ──────────────────────────────────────────────
  const base = {
    display:    'flex',
    alignItems: 'center',
    gap:          5,
    height:       32,
    padding:      '0 10px',
    borderRadius: 6,
    border:       '1px solid var(--c-b1)',
    background:   'transparent',
    cursor:       'pointer',
    fontSize:     12,
    color:        'var(--c-tx3)',
    transition:   'all 0.15s',
    whiteSpace:   'nowrap',
  };

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ ...base, cursor: 'default', pointerEvents: 'none' }}>
        <Cloud size={12} style={{ opacity: 0.4 }} />
      </div>
    );
  }

  // ── Signed-in state helpers ───────────────────────────────────────────────
  const { icon: StatusIcon, color: statusColor, title: statusTitle } = {
    syncing: { icon: CloudDownload, color: '#3b82f6', title: 'Sincronizando…'  },
    synced:  { icon: Cloud,         color: '#3fb950', title: 'Sincronizado'    },
    error:   { icon: AlertTriangle, color: '#f59e0b', title: 'Erro de sync'    },
    idle:    { icon: Cloud,         color: 'var(--c-tx4)', title: 'Conectado'  },
  }[syncStatus] ?? { icon: Cloud, color: 'var(--c-tx4)', title: 'Conectado' };

  // Normalise Firebase user vs Supabase user shapes
  const displayName = user?.displayName               // Firebase
    ?? user?.user_metadata?.full_name                  // Supabase Google
    ?? user?.user_metadata?.name
    ?? 'Usuário';
  const userEmail     = user?.email ?? '';
  const avatarLetter  = (displayName[0] ?? userEmail[0] ?? '?').toUpperCase();

  // ── Handle email magic-link submission ────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setEmailErr('');
    const { error } = await onSignInWithEmail(email);
    setSending(false);
    if (error) {
      setEmailErr(error.message ?? 'Erro ao enviar email');
    } else {
      setEmailSent(true);
    }
  };

  // ── Dropdown panel (shared between signed-in & not-signed-in) ────────────
  const dropdownStyle = {
    position:     'absolute',
    top:          'calc(100% + 6px)',
    right:        0,
    zIndex:       200,
    minWidth:     220,
    background:   'var(--c-surface)',
    border:       '1px solid var(--c-b1)',
    borderRadius: 10,
    boxShadow:    '0 8px 32px rgba(0,0,0,0.45)',
    overflow:     'hidden',
    animation:    'fade-in 0.12s ease-out',
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NOT SIGNED IN
  // ════════════════════════════════════════════════════════════════════════════
  if (!user) {
    // Firebase: direct Google sign-in on click (no dropdown needed)
    if (!SUPABASE_ENABLED) {
      return (
        <button
          onClick={onSignIn}
          title="Sincronizar entre dispositivos com Google"
          className="btn-inline"
          style={base}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
        >
          <LogIn size={12} aria-hidden="true" />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      );
    }

    // Supabase: "Sincronizar" opens dropdown with Google + Email options
    return (
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          title="Sincronizar entre dispositivos"
          className="btn-inline"
          aria-expanded={menuOpen}
          style={base}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
        >
          <LogIn size={12} aria-hidden="true" />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>

        {menuOpen && (
          <div style={dropdownStyle} role="menu">
            {/* Header */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--c-b1)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-tx1)', marginBottom: 2 }}>
                Entrar na conta
              </p>
              <p style={{ fontSize: 11, color: 'var(--c-tx4)' }}>
                Sincroniza PC e iPhone automaticamente
              </p>
            </div>

            {/* Google sign-in */}
            <button
              onClick={() => { setMenuOpen(false); onSignIn(); }}
              role="menuitem"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: 'var(--c-tx2)', textAlign: 'left',
                borderBottom: '1px solid var(--c-b1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-s2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Google G logo */}
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Entrar com Google
            </button>

            {/* Email magic link */}
            <div style={{ padding: '10px 14px 12px' }}>
              {!emailMode && !emailSent && (
                <button
                  onClick={() => setEmailMode(true)}
                  role="menuitem"
                  style={{
                    width: '100%', padding: '8px 0',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13, color: 'var(--c-tx3)', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-tx1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-tx3)'; }}
                >
                  <Mail size={15} aria-hidden="true" />
                  Entrar com Email
                </button>
              )}

              {emailMode && !emailSent && (
                <form onSubmit={handleEmailSubmit} style={{ marginTop: 2 }}>
                  <p style={{ fontSize: 11, color: 'var(--c-tx4)', marginBottom: 6 }}>
                    Você receberá um link de acesso
                  </p>
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                    placeholder="seu@email.com"
                    required
                    style={{
                      width: '100%', padding: '7px 10px',
                      borderRadius: 6, border: '1px solid var(--c-b4)',
                      background: 'var(--c-bg)', color: 'var(--c-tx1)',
                      fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      marginBottom: emailErr ? 4 : 8,
                    }}
                  />
                  {emailErr && (
                    <p style={{ fontSize: 11, color: '#f85149', marginBottom: 6 }}>{emailErr}</p>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="submit"
                      disabled={sending}
                      style={{
                        flex: 1, padding: '7px 0',
                        borderRadius: 6, border: 'none',
                        background: '#1d4ed8', color: 'white',
                        fontSize: 12, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        opacity: sending ? 0.7 : 1,
                      }}
                    >
                      {sending ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                      {sending ? 'Enviando…' : 'Enviar link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmailMode(false); setEmail(''); setEmailErr(''); }}
                      style={{
                        padding: '7px 10px', borderRadius: 6,
                        border: '1px solid var(--c-b1)', background: 'transparent',
                        color: 'var(--c-tx4)', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </form>
              )}

              {emailSent && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', color: '#3fb950',
                }}>
                  <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--c-tx2)' }}>
                    Email enviado para <strong>{email}</strong>. Clique no link para entrar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNED IN
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      {/* Avatar chip */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        title={statusTitle}
        className="btn-inline"
        aria-label={`Conta sincronizada — ${statusTitle}`}
        aria-expanded={menuOpen}
        style={{ ...base, gap: 6, padding: '0 8px 0 6px' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-b4)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-b1)'; }}
      >
        {/* Avatar circle */}
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {avatarLetter}
        </span>

        {/* Sync icon */}
        <StatusIcon
          size={11}
          color={statusColor}
          aria-hidden="true"
          style={syncStatus === 'syncing' ? { animation: 'spin 1.2s linear infinite' } : undefined}
        />

        {/* Label desktop */}
        <span className="desktop-only" style={{ color: statusColor, fontWeight: 500, fontSize: 11 }}>
          {syncStatus === 'syncing' ? 'Salvando…' : syncStatus === 'error' ? 'Erro' : 'Sync ✓'}
        </span>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div style={dropdownStyle} role="menu">
          {/* Account info */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--c-b1)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-tx1)', marginBottom: 2 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-tx4)', wordBreak: 'break-all' }}>
              {userEmail}
            </div>
          </div>

          {/* Sync status row */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid var(--c-b1)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <StatusIcon size={13} color={statusColor} />
            <span style={{ fontSize: 12, color: 'var(--c-tx3)' }}>{statusTitle}</span>
            {syncStatus === 'synced' && (
              <Check size={11} color="#3fb950" style={{ marginLeft: 'auto' }} />
            )}
          </div>

          {/* Backend badge */}
          <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--c-b1)' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              color: SUPABASE_ENABLED ? '#3b82f6' : '#f59e0b',
              background: SUPABASE_ENABLED ? '#0d1e2e' : '#2c1f06',
              border: `1px solid ${SUPABASE_ENABLED ? '#1e3a5f' : '#6e4c1a'}`,
              padding: '2px 6px', borderRadius: 4,
            }}>
              {SUPABASE_ENABLED ? '⚡ Supabase' : '🔥 Firebase'}
            </span>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { setMenuOpen(false); onSignOut(); }}
            role="menuitem"
            style={{
              width: '100%', padding: '10px 14px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--c-tx3)', textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-s2)'; e.currentTarget.style.color = 'var(--c-tx1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-tx3)'; }}
          >
            <LogOut size={13} aria-hidden="true" />
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
