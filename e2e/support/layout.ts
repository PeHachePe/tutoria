import { expect, type Page } from '@playwright/test';

/** The three widths of the definition of done of a screen (5.4), at the heights it names. */
export const VIEWPORTS = [
  { name: 'móvil', width: 375, height: 667 },
  { name: 'tableta', width: 768, height: 1024 },
  { name: 'escritorio', width: 1280, height: 720 },
] as const;

/** The narrowest width WCAG asks a page to reflow to without scrolling sideways (1.4.10). */
export const REFLOW_WIDTH = 320;

/** How far the page scrolls beyond the window, in pixels, on each axis. */
function pageOverflow(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight };
  });
}

/**
 * The page never scrolls sideways and, when its content fits, not down either: what is long
 * scrolls inside its own area (5.4, point 3).
 */
export async function expectNoPageScroll(
  page: Page,
  state: string,
  { vertical = true } = {},
): Promise<void> {
  const { x, y } = await pageOverflow(page);
  expect(x, `desplazamiento lateral en «${state}»`).toBe(0);
  if (vertical) expect(y, `desplazamiento vertical en «${state}»`).toBe(0);
}
