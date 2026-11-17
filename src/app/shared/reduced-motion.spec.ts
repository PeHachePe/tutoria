import { prefersReducedMotion, REDUCED_MOTION } from './reduced-motion';

describe('prefersReducedMotion', () => {
  it('asks the window for its media query', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);

    expect(prefersReducedMotion({ matchMedia } as unknown as Window)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION);
  });

  it('is false where the window cannot tell', () => {
    expect(prefersReducedMotion(null)).toBe(false);
    expect(prefersReducedMotion({} as Window)).toBe(false);
  });
});
