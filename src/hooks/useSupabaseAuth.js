/**
 * useSupabaseAuth — autenticação via Supabase Auth.
 *
 * Cria o próprio client JS localmente (isolado do sbFetch de dados),
 * então uma falha de auth não quebra a sincronização.
 */
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY, SUPABASE_ENABLED } from '../lib/supabase';

// createClient em si não faz chamadas de rede — só falha quando
// auth.getSession() / signInWithOAuth() etc. são chamados.
const authClient = SUPABASE_ENABLED
  ? createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export function useSupabaseAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(Boolean(authClient));

  useEffect(() => {
    if (!authClient) { setLoading(false); return; }

    authClient.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(e => {
        console.warn('[SupabaseAuth] getSession falhou:', e.message);
        setLoading(false);
      });

    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!authClient) return;
    await authClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    if (!authClient) return { error: new Error('Auth não disponível') };
    const { error } = await authClient.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!authClient) return;
    await authClient.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signInWithGoogle, signInWithEmail, signOut, SUPABASE_ENABLED };
}
