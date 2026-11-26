import { expect, type Locator, type Page } from '@playwright/test';

import { ADMIN_ANCHORS } from '../../src/app/core/guide/anchors/admin-anchors';
import { STUDENT_ANCHORS } from '../../src/app/core/guide/anchors/student-anchors';
import { TEACHER_ANCHORS } from '../../src/app/core/guide/anchors/teacher-anchors';
import { SAMPLE_CODE } from '../../src/app/data/mock/fixtures/activity';

/** What the manual does on the piece of a step with an action, as the user would. */
type Action = (page: Page, piece: Locator) => Promise<void>;

/** What the user writes in the dialogs that save: made-up data, as in the seed. */
const DATA = {
  className: '2.º DAW B',
  blockTitle: 'Tema 9: Repaso',
  userName: 'Lucía Navarro Gil',
  userEmail: 'lucia.navarro@tutoria.test',
  userPassword: 'manual-de-usuario',
};

/** The dialog of Material that holds a piece. */
function dialogOf(piece: Locator): Locator {
  return piece.locator('xpath=ancestor::*[@role="dialog"][1]');
}

/**
 * The dialogs that save: the step goes on once they close saving (GuideStep.savesDialog), so they
 * are filled in first. Any other action is a click on its piece.
 */
const ACTIONS: Readonly<Record<string, Action>> = {
  [TEACHER_ANCHORS.classDialogSave]: async (_page, piece) => {
    // With its suggestions, the field is a combobox (its list has the same name)
    await dialogOf(piece).getByRole('combobox', { name: 'Nombre' }).fill(DATA.className);
    // The suggestions of existing classes cover the button: Tab closes them, choosing none (Esc
    // would also end the tour)
    await piece.page().keyboard.press('Tab');
    await piece.click();
  },
  [TEACHER_ANCHORS.subjectsDialogSave]: async (page, piece) => {
    const dialog = dialogOf(piece);
    await dialog.getByRole('checkbox', { checked: false, disabled: false }).first().check();
    // The administration chooses who teaches them
    const teacher = dialog.getByRole('combobox', { name: 'Docente' });
    if (await teacher.isVisible()) {
      await teacher.click();
      await page.getByRole('option').first().click();
    }
    await piece.click();
  },
  [TEACHER_ANCHORS.enrollDialogSave]: async (_page, piece) => {
    // «Seleccionar todos», the first one: whoever has no class this year
    await dialogOf(piece).getByRole('checkbox', { disabled: false }).first().check();
    await piece.click();
  },
  [TEACHER_ANCHORS.blockDialogSave]: async (_page, piece) => {
    await dialogOf(piece).getByLabel('Título', { exact: true }).fill(DATA.blockTitle);
    await piece.click();
  },
  [TEACHER_ANCHORS.addExercisesSave]: async (_page, piece) => {
    await dialogOf(piece).getByRole('option', { disabled: false, selected: false }).first().click();
    await piece.click();
  },
  [ADMIN_ANCHORS.userDialogSave]: async (_page, piece) => {
    const dialog = dialogOf(piece);
    await dialog.getByLabel('Nombre y apellidos').fill(DATA.userName);
    await dialog.getByLabel('Correo').fill(DATA.userEmail);
    await dialog.getByLabel('Contraseña', { exact: true }).fill(DATA.userPassword);
    await piece.click();
  },
};

export function actionFor(anchor: string): Action {
  return ACTIONS[anchor] ?? ((_page, piece) => piece.click());
}

/**
 * What makes possible an action that is not yet, for a task that stopped on it: «Entregar» needs
 * code that passes every test, so the sample solution of the seed is written and run.
 */
const PREPARATIONS: Readonly<Record<string, (page: Page) => Promise<void>>> = {
  [STUDENT_ANCHORS.submit]: async (page) => {
    const editor = page.locator(`[data-guide="${STUDENT_ANCHORS.editor}"]`).getByRole('textbox');
    const code = (await editor.textContent()) ?? '';
    const name = /function\s+(\w+)/.exec(code)?.[1];
    const solution = Object.values(SAMPLE_CODE).find(({ solved }) =>
      solved.includes(`function ${name}(`),
    )?.solved;
    if (!name || !solution) throw new Error(`Sin solución de ejemplo para «${name}».`);
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(solution);
    await page.locator(`[data-guide="${STUDENT_ANCHORS.runTests}"]`).click();
    await expect(page.locator(`[data-guide="${STUDENT_ANCHORS.submit}"]`)).toBeEnabled({
      timeout: 15_000,
    });
  },
};

export function preparationFor(anchor: string): ((page: Page) => Promise<void>) | undefined {
  return PREPARATIONS[anchor];
}
