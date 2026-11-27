import { expect, type Page } from '@playwright/test';

/** The failures of «Fallar la siguiente petición», by the label the dev toolbar gives them. */
export type SimulatedFailure =
  | 'Sin conexión'
  | 'Sesión caducada'
  | 'Sin permiso'
  | 'No encontrado'
  | 'Demasiadas peticiones'
  | 'Servicio no disponible'
  | 'Datos no válidos'
  | 'Error desconocido';

/**
 * Makes the next request of the simulated data fail, as a person trying the error states would:
 * from the dev toolbar of the `demo` build, which is then closed so it covers nothing.
 */
export async function failNextRequest(page: Page, failure: SimulatedFailure): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Herramientas de desarrollo' });
  await toggle.click();
  await page.getByRole('combobox', { name: 'Fallar la siguiente petición' }).click();
  await page.getByRole('option', { name: failure, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
}
