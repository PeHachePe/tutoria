/** The media query of whoever asks the system for less motion. */
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Whether the user asks for less motion, for an animation drawn from code (CSS has
 * `motion-reduce:`). False where the window cannot tell, as in a test without `matchMedia`.
 */
export function prefersReducedMotion(window: Window | null): boolean {
  return window?.matchMedia?.(REDUCED_MOTION).matches ?? false;
}
