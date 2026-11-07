import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';

import { startAs, USERS } from '../support/session';
import { SCREENS, type Screen } from './screens';

/**
 * Takes the screenshots that `npm run screenshots` asks for (scripts/screenshots.mjs, 5.6): the
 * script passes the target and the output folder in SCREENSHOTS_TARGET.
 */
interface Target {
  /** Screens to capture: one for the evolution of a screen, all for a delivery. */
  readonly screens: readonly string[] | 'all';
  /** Folder for each screen, relative to docs/capturas; `{screen}` is replaced by its code. */
  readonly folder: string;
  /** A delivery also takes the desktop in dark mode. */
  readonly dark: boolean;
}

const VIEWPORTS = [
  { file: 'movil', width: 375, height: 812 },
  { file: 'tablet', width: 768, height: 1024 },
  { file: 'escritorio', width: 1280, height: 800 },
] as const;

const OUTPUT = join(process.cwd(), 'docs', 'capturas');

const target = readTarget();
const screens = selectScreens(target);

if (screens.length === 0) {
  test('no hay pantallas terminadas que capturar', () => {
    console.log('Ninguna pantalla registrada en e2e/screenshots/screens.ts.');
  });
}

for (const screen of screens) {
  test(`capturas de ${screen.code}`, async ({ page }) => {
    await startAs(page, screen.user && USERS[screen.user]);
    const folder = join(OUTPUT, target.folder.replace('{screen}', screen.code));

    for (const viewport of VIEWPORTS) {
      await capture(page, screen, viewport, 'light', join(folder, `${viewport.file}.png`));
    }
    if (target.dark) {
      const desktop = VIEWPORTS[2];
      await capture(page, screen, desktop, 'dark', join(folder, 'escritorio-oscuro.png'));
    }
  });
}

async function capture(
  page: Page,
  screen: Screen,
  viewport: (typeof VIEWPORTS)[number],
  colorScheme: 'light' | 'dark',
  path: string,
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto(screen.path);
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The dev toolbar is not part of the app
  await page.addStyleTag({ content: 'app-dev-toolbar { display: none !important; }' });
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}

function readTarget(): Target {
  const raw = process.env['SCREENSHOTS_TARGET'];
  if (!raw) {
    throw new Error(
      'Lanza las capturas con «npm run screenshots», no con Playwright directamente.',
    );
  }
  return JSON.parse(raw) as Target;
}

function selectScreens({ screens: wanted }: Target): readonly Screen[] {
  if (wanted === 'all') return SCREENS;
  const unknown = wanted.filter((code) => !SCREENS.some((screen) => screen.code === code));
  if (unknown.length) {
    const known = SCREENS.map((screen) => screen.code).join(', ') || 'ninguna';
    throw new Error(
      `Pantalla sin registrar en e2e/screenshots/screens.ts: ${unknown.join(', ')}. Registradas: ${known}.`,
    );
  }
  return SCREENS.filter((screen) => wanted.includes(screen.code));
}
