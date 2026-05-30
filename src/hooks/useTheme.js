import { useState, useEffect } from 'react';

const STORAGE_KEY = 'theme-preference';

/**
 * Manages dark/light theme.
 * - Reads initial preference from localStorage (default: 'dark')
 * - Applies/removes `.light` class on <html>
 * - Persists choice to localStorage
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('light');
    } else {
      html.classList.add('light');
    }
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}
