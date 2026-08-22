import * as React from 'react';

/**
 * The analytics page's motion, restated for a plugin.
 *
 * The host's `useChartGrowIn` / `RollingNumber` live behind `motion/react`,
 * which is not one of the modules a plugin may import — so the curve, the
 * duration and the reduced-motion rule are copied here rather than approximated.
 * Same numbers as `shared/app/hooks/useChartGrowIn.ts`: change them there and
 * change them here.
 */

/** `cubic-bezier(0.22, 1, 0.36, 1)` — the page's grow-in / morph easing. */
export const CHART_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const CHART_GROW_MS = 500;
/** The count-up is slower than the grow-in, exactly as `RollingNumber` has it. */
export const ROLL_MS = 900;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mount grow-in flag. `grown` is `false` on the first paint so a mark can render
 * collapsed, then flips on the next frame — that change drives the CSS
 * transition, and because the transition stays attached, later value changes
 * morph on the same curve instead of jumping.
 *
 * Under reduced motion it is `true` from the first paint and `animate` is
 * `false`, so marks appear at full size with no transition at all.
 */
export const useGrowIn = (): { grown: boolean; animate: boolean } => {
  const reduced = prefersReducedMotion();
  const [grown, setGrown] = React.useState(reduced);

  React.useEffect(() => {
    if (reduced) return;
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return { grown: reduced || grown, animate: !reduced };
};

/**
 * Evaluate a CSS cubic-bezier at `t`, by Newton–Raphson on x with a bisection
 * fallback. Needed because the roll is driven by `requestAnimationFrame` rather
 * than by CSS, and eyeballing "something easeOut-ish" would put the figures on a
 * different curve from the bars right next to them.
 */
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const calc = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) =>
    3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const dx = slope(t, x1, x2);
      if (dx === 0) break;
      const error = calc(t, x1, x2) - x;
      if (Math.abs(error) < 1e-5) return calc(t, y1, y2);
      t -= error / dx;
    }

    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      if (calc(t, x1, x2) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return calc(t, y1, y2);
  };
};

const easeOut = bezier(0.22, 1, 0.36, 1);

/**
 * Count-up figure, the `RollingNumber` behaviour: rolls 0 → value on mount, and
 * from whatever is currently on screen to the new value on every later change,
 * so an interrupted roll continues from where it visually was rather than
 * snapping back.
 *
 * Returns the interpolated number; the caller formats it, which is what keeps
 * `41,310자` and `8.5자` spinning up with their units attached.
 */
export const useRollingNumber = (value: number, durationMs = ROLL_MS): number => {
  const reduced = prefersReducedMotion();
  const current = React.useRef(reduced ? value : 0);
  const [display, setDisplay] = React.useState(current.current);

  React.useEffect(() => {
    if (reduced) {
      current.current = value;
      setDisplay(value);
      return;
    }

    const from = current.current;
    if (from === value) return;

    let raf = 0;
    let start: number | undefined;

    const step = (now: number) => {
      if (start === undefined) start = now;
      const progress = Math.min(1, (now - start) / durationMs);
      const next = from + (value - from) * easeOut(progress);
      current.current = next;
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, durationMs]);

  return display;
};
