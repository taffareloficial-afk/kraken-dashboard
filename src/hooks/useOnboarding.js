/**
 * useOnboarding — controls first-launch onboarding visibility.
 *
 * The modal shows once per browser profile. After the user finishes
 * or skips it the flag 'kraken_onboarding_done' is written to
 * localStorage so it never appears again automatically.
 *
 * `reopen()` lets the user re-watch from Configurações (future) or
 * any trigger in the UI.
 */
import { useState, useCallback } from 'react';

const LS_KEY = 'kraken_onboarding_done';

function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch { /* noop */ } }

export function useOnboarding() {
  const [visible, setVisible] = useState(() => !lsGet(LS_KEY));

  const finish = useCallback(() => {
    lsSet(LS_KEY, '1');
    setVisible(false);
  }, []);

  const reopen = useCallback(() => setVisible(true), []);

  return { visible, finish, reopen };
}
