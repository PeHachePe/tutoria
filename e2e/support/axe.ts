import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Popups that axe's `region` rule accepts outside the landmarks. By default only dialogs; Material
 * also draws menus and the options of a select at the end of <body>, outside every landmark. They
 * only exist while in use and take the focus, so no one can miss them (D-020).
 */
const POPUP_REGIONS = 'dialog, [role=dialog], [role=alertdialog], svg, [role=menu], [role=listbox]';

/**
 * The two passes of every state (D-025): all of axe's rules in light mode and, in dark mode, only
 * the contrast, which is all the theme changes. The rest would repeat the light pass and double the
 * time of every accessibility test.
 */
const PASSES = [
  { colorScheme: 'light', label: 'claro', rules: null },
  { colorScheme: 'dark', label: 'oscuro', rules: ['color-contrast'] },
] as const;

/**
 * Runs axe on the page as it is now, in light and in dark mode, and fails with a readable list of
 * the violations (D-002, 5.4). Only the accessibility test of each screen calls it, once for every
 * state of its ficha; `state` names that state in the report.
 */
export async function expectNoAxeViolations(page: Page, state: string): Promise<void> {
  // axe takes a Material Symbols ligature ("build") for an icon only once its font has loaded;
  // before that it reads it as visible text and reports label-content-name-mismatch (step 1.1c)
  await page.evaluate(() => document.fonts.ready);
  for (const { colorScheme, label, rules } of PASSES) {
    await page.emulateMedia({ colorScheme });
    // Legacy mode runs axe inside the page. By default it opens a blank page on every call to put
    // the results together, which took 3 to 6 s per pass even on a page of 41 elements; this way it
    // takes about 1 s. It only gives up cross-origin iframes, which the app does not have (D-025).
    let axe = new AxeBuilder({ page })
      .setLegacyMode(true)
      .options({ checks: { region: { options: { regionMatcher: POPUP_REGIONS } } } });
    if (rules) axe = axe.withRules([...rules]);
    const { violations } = await axe.analyze();
    const report = violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
    );
    expect(report, `axe en «${state}», modo ${label}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: null });
}
