import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test of the published app (step 3.1, docs/DESPLIEGUE.md): `npm run smoke` runs it against
 * SMOKE_URL with a student account of the cloud, whose credentials come from the environment and
 * never from the repository. It goes through the real back end, the real tutor included: sign in,
 * solve, ask for a hint and submit. It can run again and again: a submitted exercise is practised
 * again.
 */
const EMAIL = process.env['SMOKE_EMAIL'] ?? '';
const PASSWORD = process.env['SMOKE_PASSWORD'] ?? '';
const EXERCISE = 'Suma de los elementos de un vector';
const WRONG_CODE = 'function sum(numbers) {\n  return 0;\n}\n';
const RIGHT_CODE =
  'function sum(numbers) {\n  let total = 0;\n  for (const n of numbers) total += n;\n  return total;\n}\n';
/** The tutor calls a model in the cloud: on a free plan, the chain of fallbacks may take a while. */
const TUTOR_TIMEOUT_MS = 90_000;

async function replaceCode(page: Page, code: string): Promise<void> {
  const editor = page.getByRole('textbox', { name: 'Código' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  // insertText, not type: the editor would close every bracket typed one by one
  await page.keyboard.insertText(code);
}

test('acceso, resolver, pista y entrega en la URL pública', async ({ page }) => {
  // A failure, not a skip: a skipped smoke test would look like a passed one
  expect(
    EMAIL && PASSWORD,
    'Faltan SMOKE_EMAIL y SMOKE_PASSWORD (docs/DESPLIEGUE.md, paso 9)',
  ).toBeTruthy();
  test.setTimeout(240_000);
  const policyViolations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) policyViolations.push(message.text());
  });

  await test.step('acceso', async () => {
    await page.goto('/login');
    await page.getByLabel('Correo').fill(EMAIL);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    // The data notice of the first sign-in, only the first time the account comes in
    const heading = page.getByRole('heading', { level: 1, name: 'Ejercicios' });
    const notice = page.getByRole('button', { name: 'Entendido' });
    await expect(heading.or(notice)).toBeVisible();
    if (await notice.isVisible()) await notice.click();
    await expect(heading).toBeVisible();
  });

  await test.step('abrir el ejercicio', async () => {
    await page.getByRole('link', { name: EXERCISE }).first().click();
    await expect(page.getByRole('textbox', { name: 'Código' })).toBeVisible();
    const again = page.getByRole('button', { name: 'Practicar de nuevo' });
    if (await again.isVisible()) await again.click();
    await expect(page.getByRole('button', { name: 'Ejecutar pruebas' })).toBeEnabled();
  });

  await test.step('pruebas que fallan y una pista del tutor', async () => {
    await replaceCode(page, WRONG_CODE);
    await page.getByRole('button', { name: 'Ejecutar pruebas' }).click();
    await expect(page.getByText(/\d+ de \d+ superadas/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Pedir pista' }).click();
    const conversation = page.getByRole('group', { name: 'Conversación con el tutor' });
    await expect(conversation.getByText(/^Pista · nivel \d/)).toBeVisible({
      timeout: TUTOR_TIMEOUT_MS,
    });
  });

  await test.step('resolver y entregar', async () => {
    await replaceCode(page, RIGHT_CODE);
    await page.getByRole('button', { name: 'Ejecutar pruebas' }).click();
    await expect(page.getByText(/Todas superadas/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Entregar', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText(/Entregado el .* El código ya no se puede cambiar/)).toBeVisible();
  });

  expect(policyViolations, 'la CSP de vercel.json no bloquea nada').toEqual([]);
});
