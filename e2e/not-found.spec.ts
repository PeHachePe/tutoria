import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { startAs, USERS } from './support/session';

test.describe('página no encontrada', () => {
  test.beforeEach(async ({ page }) => {
    await startAs(page, USERS.student);
    await page.goto('/no-existe');
    await expect(page).toHaveTitle('Página no encontrada · TutorIA');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeVisible();
  });

  test('accesibilidad: pasa axe', async ({ page }) => {
    await expectNoAxeViolations(page, 'con sesión');
  });

  test('lleva al inicio del rol', async ({ page }) => {
    await page.getByRole('link', { name: 'Ir a mi inicio' }).click();

    await expect(page).toHaveURL('/alumno');
  });
});
