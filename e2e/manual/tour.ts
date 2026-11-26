import { type Locator, type Page } from '@playwright/test';

import { actionFor, preparationFor } from './actions';

/** One globe of a task, as the manual tells it. */
export interface ManualStep {
  readonly title: string;
  readonly text: string;
  /** What the user has to do to go on («Pulsa «Grupos»»), in the steps with an action. */
  readonly action?: string;
  /** «Paso 2 de 5», as the globe counts it. */
  readonly progress?: string;
  /** The screenshot, beside the data of the task. */
  readonly image: string;
}

/**
 * The tour stopped on a globe that says why its action is not possible yet (GuideStep
 * .whenDisabled), and the task can be prepared and done again (actions.ts).
 */
export class NotPossibleYet extends Error {
  constructor(readonly anchor: string) {
    super(`La acción de «${anchor}» aún no es posible.`);
  }
}

/** The globe of driver.js, and the attribute with the piece of its step (GUIDE_STEP_ATTRIBUTE). */
const GLOBE = '.driver-popover';
const STEP_ATTRIBUTE = 'data-guide-step';
/** A tour never has as many steps: past them, it is going round in circles. */
const MAX_STEPS = 40;
/** A piece of the next page has 8 s to show (TourRunner): a little more, before giving up. */
const NEXT_GLOBE_TIMEOUT_MS = 15_000;
/** Room around the piece and its globe in the screenshot, and its smallest size. */
const PADDING = 32;
const MIN_WIDTH = 880;
const MIN_HEIGHT = 520;

/**
 * Follows the tour that has just started until it ends: on each globe it reads its texts, takes a
 * screenshot and does what the user would, «Siguiente» or the action of the step on its piece.
 */
export async function followTour(
  page: Page,
  screenshot: (index: number) => string,
): Promise<ManualStep[]> {
  const steps: ManualStep[] = [];
  let last: string | null = null;
  for (let index = 1; index <= MAX_STEPS; index++) {
    const shown = await nextGlobe(page, last);
    if (shown === null) return steps;
    const globe = page.locator(GLOBE);
    const step = await readGlobe(globe);
    const image = screenshot(index);
    await capture(page, image);
    steps.push({ ...step, image });
    last = shown;
    await act(page, globe);
  }
  throw new Error(`La tarea pasa de ${MAX_STEPS} pasos: no termina.`);
}

/**
 * Waits for a globe other than the last one, drawn and in place; null once the tour is over. The
 * first one comes once the panel closes and driver.js is downloaded.
 */
async function nextGlobe(page: Page, last: string | null): Promise<string | null> {
  const handle = await page.waitForFunction(
    ({ globeSelector, last }) => {
      const globe = document.querySelector<HTMLElement>(globeSelector);
      const active = document.body.classList.contains('driver-active');
      if (!active) return last === null ? false : 'ended';
      if (!globe || globe.classList.contains('driver-popover-waiting')) return false;
      const { width, height } = globe.getBoundingClientRect();
      if (width === 0 || height === 0) return false;
      const shown = [
        globe.querySelector('.driver-popover-progress-text')?.textContent,
        globe.querySelector('.driver-popover-title')?.textContent,
        globe.querySelector('.driver-popover-description')?.textContent,
      ].join('|');
      return shown !== last ? shown : false;
    },
    { globeSelector: GLOBE, last },
    { timeout: NEXT_GLOBE_TIMEOUT_MS },
  );
  const shown = (await handle.jsonValue()) as string;
  return shown === 'ended' ? null : shown;
}

async function readGlobe(globe: Locator): Promise<Omit<ManualStep, 'image'>> {
  return globe.evaluate((element) => {
    const text = (selector: string) => {
      const part = element.querySelector(selector)?.cloneNode(true) as Element | undefined;
      // The mascot goes inside the title
      part?.querySelectorAll('.app-guide-mascot').forEach((mascot) => mascot.remove());
      return part?.textContent?.replace(/\s+/g, ' ').trim() || undefined;
    };
    const instruction = element.querySelector<HTMLElement>('.driver-popover-instruction');
    const progress = element.querySelector<HTMLElement>('.driver-popover-progress-text');
    return {
      title: text('.driver-popover-title') ?? '',
      text: text('.driver-popover-description') ?? '',
      action: instruction?.checkVisibility() ? text('.driver-popover-instruction-text') : undefined,
      progress: progress?.checkVisibility() ? text('.driver-popover-progress-text') : undefined,
    };
  });
}

/**
 * What the user does on a globe: turn on a switch it offers, «Siguiente» (or «Terminar»), or the
 * action of its step on the piece; a globe that only says why the action is not possible yet ends.
 */
async function act(page: Page, globe: Locator): Promise<void> {
  const next = globe.locator('.driver-popover-next-btn');
  if (await next.isVisible()) {
    // The switch of the voice: on, the next steps show its choices
    const turnOn = globe.locator('.app-guide-primary:not(.app-guide-next-task)');
    await ((await turnOn.isVisible()) ? turnOn : next).click();
    return;
  }
  const anchor = (await globe.getAttribute(STEP_ATTRIBUTE)) ?? '';
  if (!(await globe.locator('.driver-popover-instruction').isVisible())) {
    // Not possible yet: «Entendido» ends the tour as the user would, and the globe that says why
    // is its last step. If it can be prepared («Entregar»), it is, and the task starts again.
    await globe.locator('.app-guide-primary').click();
    if (preparationFor(anchor)) throw new NotPossibleYet(anchor);
    return;
  }
  const piece = page.locator(`[data-guide="${anchor}"]`).filter({ visible: true }).first();
  await actionFor(anchor)(page, piece);
}

/**
 * A screenshot of the piece and its globe, with some of the screen around: the dark layer says
 * what is lit. As big as the viewport at most.
 */
async function capture(page: Page, path: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  // Laid out first: the globe is placed once the piece is in view
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const clip = await page.evaluate(
    ({ globeSelector, padding, minWidth, minHeight }) => {
      const parts = [
        document.querySelector(globeSelector),
        document.querySelector('.driver-active-element'),
      ].flatMap((element) => (element ? [element.getBoundingClientRect()] : []));
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      let left = Math.min(...parts.map((part) => part.left)) - padding;
      let top = Math.min(...parts.map((part) => part.top)) - padding;
      let right = Math.max(...parts.map((part) => part.right)) + padding;
      let bottom = Math.max(...parts.map((part) => part.bottom)) + padding;
      // Never smaller than this, so the screen around it is seen
      const grow = (from: number, to: number, min: number, max: number) => {
        const missing = Math.max(0, min - (to - from)) / 2;
        let start = from - missing;
        let end = to + missing;
        if (start < 0) [start, end] = [0, end - start];
        if (end > max) [start, end] = [Math.max(0, start - (end - max)), max];
        return [Math.max(0, start), Math.min(max, end)];
      };
      [left, right] = grow(left, right, minWidth, viewport.width);
      [top, bottom] = grow(top, bottom, minHeight, viewport.height);
      return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top),
      };
    },
    { globeSelector: GLOBE, padding: PADDING, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT },
  );
  await page.screenshot({ path, clip, animations: 'disabled' });
}
