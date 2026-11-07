import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Popups that axe's `region` rule accepts outside the landmarks. By default only dialogs; Material
 * also draws menus and the options of a select at the end of <body>, outside every landmark. They
 * only exist while in use and take the focus, so no one can miss them (D-020).
 */
const POPUP_REGIONS = 'dialog, [role=dialog], [role=alertdialog], svg, [role=menu], [role=listbox]';

/**
 * Runs axe with all its rules on the page as it is now, in light and in dark mode, and fails with
 * a readable list of the violations (D-002, 5.4). Every screen e2e calls it.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const { violations } = await new AxeBuilder({ page })
      .options({ checks: { region: { options: { regionMatcher: POPUP_REGIONS } } } })
      .analyze();
    const report = violations.map(
      (violation) =>
        `[${colorScheme}] ${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
    );
    expect(report, `axe en modo ${colorScheme === 'light' ? 'claro' : 'oscuro'}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: null });
}
