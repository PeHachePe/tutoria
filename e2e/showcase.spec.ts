import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { startAs } from './support/session';

// The /dev/ui showcase (step 0.4): every visual piece of the app, so axe covers them all at once
test.describe('muestrario', () => {
  test.beforeEach(async ({ page }) => {
    await startAs(page, null);
    await page.goto('/dev/ui');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Muestrario de la interfaz' }),
    ).toBeVisible();
  });

  // The menus are checked by the shells test, and the snack bar lasts only 4 seconds
  test('accesibilidad: pasa axe con sus piezas y un diálogo', async ({ page }) => {
    test.slow();
    await expectNoAxeViolations(page, 'inicial');

    await page.getByRole('button', { name: 'Entregar…' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page, 'diálogo');
  });
});
