/**
 * Firebase initialisation — gracefully disabled when env vars are absent.
 *
 * Required Vite env vars (set in .env.local and in Vercel project settings):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_APP_ID
 *
 * When any of those is missing the entire Firebase feature is silently skipped
 * and the app falls back to localStorage-only mode.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth }                from 'firebase/auth';
import { getFirestore }           from 'firebase/firestore';

const {
  VITE_FIREBASE_API_KEY:            apiKey,
  VITE_FIREBASE_AUTH_DOMAIN:        authDomain,
  VITE_FIREBASE_PROJECT_ID:         projectId,
  VITE_FIREBASE_APP_ID:             appId,
  VITE_FIREBASE_STORAGE_BUCKET:     storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
} = import.meta.env;

export const FIREBASE_ENABLED = Boolean(apiKey && authDomain && projectId && appId);

let auth = null;
let db   = null;

if (FIREBASE_ENABLED) {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ apiKey, authDomain, projectId, appId, storageBucket, messagingSenderId });

  auth = getAuth(app);
  db   = getFirestore(app);
}

export { auth, db };
