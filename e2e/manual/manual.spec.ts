import { type Browser, expect, type Page, test } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { startAs } from '../support/session';
import { preparationFor } from './actions';
import { type PanelList, type PanelTask, readPanel, startFromPanel, WELCOME } from './panel';
import { MANUAL_PROFILES, type ManualProfile, type ManualProfileId } from './profiles';
import { followTour, NotPossibleYet } from './tour';

/**
 * `npm run manual` (7.0c, D-080): does every guided task of each profile from beginning to end, on
 * the simulated data and in Spanish, and keeps the texts of each globe with its screenshot in
 * tmp/manual, for scripts/manual.mjs to write the manuals of docs/manual. The tasks are those the
 * help panel lists, so a new one comes in by itself; one that no longer works makes it fail.
 */

/** A task of the panel and, if it is not possible from the home of its profile, where it is. */
export interface ManualTask extends PanelTask {
  readonly from?: string;
}

/** What scripts/manual.mjs reads of each profile, besides the tasks done. */
export interface ManualIndex {
  /** The ids of its first steps, in their order. */
  readonly firstSteps: readonly string[];
  /** Its tasks, in the order of its panel, with the page where they start if not its home. */
  readonly tasks: readonly ManualTask[];
  /** The tasks of `sharesWith` it also has, which its manual links to. */
  readonly shared: readonly PanelTask[];
}

const OUTPUT = join(process.cwd(), 'tmp', 'manual');
/** A desktop: the pieces of every width are in the manual with their tours. */
const VIEWPORT = { width: 1280, height: 800 };
/** The dev toolbar and the dev-only parts of a screen are not part of the app. */
const DEV_ONLY = 'app-dev-toolbar, [data-dev-only] { display: none !important; }';
/** A shard does a dozen tasks, each in a few seconds. */
const SHARD_TIMEOUT_MS = 20 * 60_000;
const ACTION_TIMEOUT_MS = 10_000;
/** The first load of a page, with several browsers at once, takes longer. */
const LOAD_TIMEOUT_MS = 30_000;
/** A task that fails is done once more from scratch before giving up: the first load may be slow. */
const ATTEMPTS = 2;

const wanted = readWanted();
/** To fix a task without doing them all: MANUAL_TASKS=voice,submit (the manual is not written). */
const only = process.env['MANUAL_TASKS']?.split(',');

for (const profile of MANUAL_PROFILES.filter(({ id }) => wanted.includes(id))) {
  for (let shard = 0; shard < profile.shards; shard++) {
    test(`manual de ${profile.id} (${shard + 1} de ${profile.shards})`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(SHARD_TIMEOUT_MS);
      const open = (userId: string, home: string) => openAs(browser, baseURL!, userId, home);
      const index = await indexOf(profile, open);
      const folder = join(OUTPUT, profile.id);
      mkdirSync(folder, { recursive: true });
      if (shard === 0) {
        writeFileSync(join(folder, 'index.json'), JSON.stringify(index, null, 2));
      }

      const tasks = [
        { id: WELCOME } as ManualTask,
        ...index.tasks.filter((task) => !task.unavailable),
      ];
      const failures: string[] = [];
      const mine = tasks
        .filter(({ id }) => !only || only.includes(id))
        .filter((_, position) => position % profile.shards === shard);
      for (const { id: key, from } of mine) {
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
          try {
            await record(await open(profile.user, from ?? profile.home), key, folder);
            break;
          } catch (error) {
            if (attempt === ATTEMPTS) failures.push(`${key}: ${firstLine(error)}`);
          }
        }
      }
      expect(failures, `Tareas que no se completan:\n${failures.join('\n')}`).toEqual([]);
    });
  }
}

/**
 * The tasks of a profile, as its panel lists them, and its first steps, read from the panel of a
 * newcomer. A profile that shares the tasks of another keeps its own and its first steps.
 */
async function indexOf(
  profile: ManualProfile,
  open: (userId: string, home: string) => Promise<Page>,
): Promise<ManualIndex> {
  const read = async (userId: string, home: string) => {
    const page = await open(userId, home);
    try {
      return await readPanel(page);
    } finally {
      await page.context().close();
    }
  };
  const all = await withPlaces(await read(profile.user, profile.home));
  const newcomer =
    profile.newcomer === profile.user ? all : await read(profile.newcomer, profile.home);
  const firstSteps = newcomer.firstSteps.map((title) => {
    const task = all.tasks.find((candidate) => candidate.title === title);
    if (!task) throw new Error(`Primer paso sin tarea en el panel: «${title}».`);
    return task.id;
  });
  const other = MANUAL_PROFILES.find(({ id }) => id === profile.sharesWith);
  const sharedIds = other
    ? new Set((await read(other.user, other.home)).tasks.map(({ id }) => id))
    : new Set<string>();
  const isShared = (task: ManualTask) => sharedIds.has(task.id) && !firstSteps.includes(task.id);
  return {
    firstSteps,
    tasks: all.tasks.filter((task) => !isShared(task)),
    shared: all.tasks.filter(isShared),
  };

  /** The tasks not possible from home, possible from one of `alsoFrom`, start there. */
  async function withPlaces(
    list: PanelList,
  ): Promise<{ tasks: readonly ManualTask[] } & PanelList> {
    let tasks: readonly ManualTask[] = list.tasks;
    for (const page of profile.alsoFrom ?? []) {
      const there = await read(profile.user, page);
      tasks = tasks.map((task) => {
        const found = there.tasks.find(({ id }) => id === task.id);
        return task.unavailable && found && !found.unavailable ? { ...found, from: page } : task;
      });
    }
    return { ...list, tasks };
  }
}

/** Does the task on a page of its own, keeping its globes and screenshots in `folder`. */
async function record(page: Page, key: string, folder: string): Promise<void> {
  const screenshot = (index: number) =>
    join(folder, `${key}-${String(index).padStart(2, '0')}.png`);
  try {
    await startFromPanel(page, key);
    let steps;
    try {
      steps = await followTour(page, screenshot);
    } catch (error) {
      // Not possible yet («Entregar» with failing tests): prepared, the task starts again
      const prepare = error instanceof NotPossibleYet ? preparationFor(error.anchor) : undefined;
      if (!prepare) throw error;
      await prepare(page);
      await startFromPanel(page, key);
      steps = await followTour(page, screenshot);
    }
    const done = steps.map((step) => ({ ...step, image: basename(step.image) }));
    writeFileSync(join(folder, `${key}.json`), JSON.stringify({ id: key, steps: done }, null, 2));
    // Done at the second attempt: the screenshot of the first failure no longer applies
    rmSync(join(folder, `${key}-error.png`), { force: true });
  } catch (error) {
    await page.screenshot({ path: join(folder, `${key}-error.png`) }).catch(() => undefined);
    throw error;
  } finally {
    await page.context().close();
  }
}

/** A page of its own for the user, on the simulated data, ready to open the help panel. */
async function openAs(browser: Browser, baseURL: string, userId: string, home: string) {
  const { locale, timezoneId } = test.info().project.use;
  const context = await browser.newContext({
    baseURL,
    locale,
    timezoneId,
    viewport: VIEWPORT,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  // A click on a piece that never comes fails, instead of waiting for the whole shard
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  await context.addInitScript((css) => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
    });
  }, DEV_ONLY);
  const page = await context.newPage();
  await startAs(page, userId);
  await page.goto(home);
  await page.locator('[data-guide="help"]').waitFor({ timeout: LOAD_TIMEOUT_MS });
  return page;
}

function readWanted(): readonly ManualProfileId[] {
  const raw = process.env['MANUAL_PROFILES'];
  if (!raw) {
    throw new Error('Lanza el manual con «npm run manual», no con Playwright directamente.');
  }
  return raw.split(',') as ManualProfileId[];
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Without the colours of Playwright's messages
  // eslint-disable-next-line no-control-regex
  return message.replace(/\u001b\[\d+m/g, '').split('\n')[0];
}
