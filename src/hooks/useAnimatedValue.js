import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly animates a numeric value whenever `target` changes.
 * Uses requestAnimationFrame with an ease-out cubic so numbers
 * "count up/down" over `duration` ms.
 *
 * Skips animation on the very first render (when previous value === null)
 * so initial load shows the number immediately.
 */
export function useAnimatedValue(target, duration = 500) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(null);   // null = "not yet set"
  const rafRef  = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    // First render — just set immediately, no animation
    if (prevRef.current === null) {
      prevRef.current = target;
      setValue(target);
      return;
    }

    const from = prevRef.current;
    const to   = target;

    if (from === to) return;

    // Cancel any in-flight animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    startRef.current = null;

    const step = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(to);
        prevRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    prevRef.current = to;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
