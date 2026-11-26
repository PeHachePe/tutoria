import { expect, type Locator, type Page } from '@playwright/test';

/** A task as the help panel lists it in «¿Cómo se hace…?». */
export interface PanelTask {
  readonly id: string;
  readonly title: string;
  /** The line under its title: what it achieves or, if it is not possible, why. */
  readonly summary: string;
  readonly unavailable: boolean;
}

/** What the panel of a user lists: the titles of the first steps, in order, and every task. */
export interface PanelList {
  readonly firstSteps: readonly string[];
  readonly tasks: readonly PanelTask[];
}

/** The key of the welcome, which the panel starts with «Ver la bienvenida», not as a task. */
export const WELCOME = 'welcome';

/** The help button, marked for the guided help like any piece of the bar (GUIDE_ANCHORS.help). */
const HELP_BUTTON = '[data-guide="help"]';
/** The rows of the panel say their task in the id of their description (help-panel.html). */
const DESCRIPTION_PREFIX = 'help-task-';
/** What the data says is read when the panel opens: its rows change until then. */
const SETTLE_MS = 300;
const SETTLE_TIMEOUT_MS = 8000;
const CLOSE_TIMEOUT_MS = 2000;

export async function openPanel(page: Page): Promise<Locator> {
  await page.locator(HELP_BUTTON).click();
  const panel = page.getByRole('dialog', { name: 'Ayuda' });
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Every task of the panel of the user on the page, with the first steps in their order. The first
 * steps leave the list while their section shows them, so «Ya sé usarla» brings them back to it.
 */
export async function readPanel(page: Page): Promise<PanelList> {
  const panel = await openPanel(page);
  await settle(() => readRows(panel));
  const firstSteps = await titlesOf(panel.getByRole('region', { name: 'Primeros pasos' }));
  await showAllTasks(panel);
  const tasks = await settle(() => readRows(panel));
  await page.keyboard.press('Escape');
  return { firstSteps, tasks };
}

/** Starts a task, or the welcome, from the panel, as the user would. */
export async function startFromPanel(page: Page, key: string): Promise<void> {
  const panel = await openPanel(page);
  let button: Locator;
  if (key === WELCOME) {
    button = panel.getByRole('button', { name: 'Ver la bienvenida' });
  } else {
    await showAllTasks(panel);
    button = howTo(panel).locator(`button[aria-describedby="${DESCRIPTION_PREFIX}${key}"]`);
    // Possible once what the data says is read
    await expect(button).toHaveAttribute('aria-disabled', 'false', {
      timeout: SETTLE_TIMEOUT_MS,
    });
  }
  // The panel closes as the task starts; a click while it was still opening is lost
  await expect(async () => {
    if (await panel.isVisible()) await button.click();
    await expect(panel).toBeHidden({ timeout: CLOSE_TIMEOUT_MS });
  }).toPass({ timeout: SETTLE_TIMEOUT_MS });
}

async function showAllTasks(panel: Locator): Promise<void> {
  const hide = panel.getByRole('button', { name: 'Ya sé usarla' });
  if (await hide.isVisible()) await hide.click();
}

function howTo(panel: Locator): Locator {
  return panel.getByRole('region', { name: '¿Cómo se hace…?' });
}

async function readRows(panel: Locator): Promise<readonly PanelTask[]> {
  return howTo(panel)
    .getByRole('listitem')
    .getByRole('button')
    .evaluateAll(
      (buttons, prefix) =>
        buttons.map((button) => {
          const describedBy = button.getAttribute('aria-describedby') ?? '';
          return {
            id: describedBy.slice(prefix.length),
            title: titleOf(button),
            summary: document.getElementById(describedBy)?.textContent?.trim() ?? '',
            unavailable: button.getAttribute('aria-disabled') === 'true',
          };

          /** The first line of the row, without what only a screen reader hears («, hecha»). */
          function titleOf(row: Element): string {
            const line = row.querySelector(':scope > span > span')?.cloneNode(true) as Element;
            line?.querySelectorAll('.sr-only').forEach((hidden) => hidden.remove());
            return line?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          }
        }),
      DESCRIPTION_PREFIX,
    );
}

async function titlesOf(section: Locator): Promise<readonly string[]> {
  if (!(await section.isVisible())) return [];
  return section
    .getByRole('listitem')
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const line = button.querySelector(':scope > span > span')?.cloneNode(true) as Element;
        line?.querySelectorAll('.sr-only').forEach((hidden) => hidden.remove());
        return line?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      }),
    );
}

/** Reads until two readings in a row agree: the rows change while the facts are read. */
async function settle<T>(read: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let last = JSON.stringify(await read());
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    const value = await read();
    const now = JSON.stringify(value);
    if (now === last || Date.now() > deadline) return value;
    last = now;
  }
}
