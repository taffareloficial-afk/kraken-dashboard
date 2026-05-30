/**
 * useAuth — Google Sign-In via Firebase Authentication.
 *
 * Returns { user, authLoading, signIn, signOut, FIREBASE_ENABLED }.
 *
 * When FIREBASE_ENABLED is false (no env vars) all methods are no-ops and
 * user is always null.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, FIREBASE_ENABLED } from '../lib/firebase';

export function useAuth() {
  // authLoading starts true when Firebase is configured so the UI
  // can wait for the initial auth state before showing sign-in prompts.
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(FIREBASE_ENABLED);

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      // user dismissed popup — not a real error
      if (err.code !== 'auth/popup-closed-by-user' &&
          err.code !== 'auth/cancelled-popup-request') {
        console.error('[Kraken] Google sign-in error:', err.message);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await fbSignOut(auth);
  }, []);

  return { user, authLoading, signIn, signOut, FIREBASE_ENABLED };
}
