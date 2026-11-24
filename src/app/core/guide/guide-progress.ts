import type { GuideState } from '../../data/guide-state';
import { searchable } from '../../shared/searchable';
import type { GuideFacts, GuidePlace, GuideScreen, GuideTask } from './guide-task';

/** The guided help as pure functions (2.12): progress, the list of the panel and what is saved. */

/** Done according to its data or because its tour was finished, also before the data says so. */
export function isTaskDone(task: GuideTask, state: GuideState, facts: GuideFacts): boolean {
  return (task.doneBy !== undefined && facts.known.has(task.doneBy)) || !!state.done?.[task.id];
}

/**
 * The first steps of a profile: the tasks it names, in its order (D-093). An id it does not know is
 * left out, so a task can leave a profile without breaking it.
 */
export function firstStepsOf(
  tasks: readonly GuideTask[],
  ids: readonly string[],
): readonly GuideTask[] {
  return ids.flatMap((id) => tasks.filter((task) => task.id === id));
}

export interface FirstStepsProgress {
  readonly done: number;
  readonly total: number;
  /** The first one pending, in the order of the profile. */
  readonly next: GuideTask | undefined;
}

export function firstStepsProgress(
  firstSteps: readonly GuideTask[],
  state: GuideState,
  facts: GuideFacts,
): FirstStepsProgress {
  const pending = firstSteps.filter((task) => !isTaskDone(task, state, facts));
  return { done: firstSteps.length - pending.length, total: firstSteps.length, next: pending[0] };
}

/** The section of the first steps shows while some is pending, unless the user hid it. */
export function showFirstSteps(
  firstSteps: readonly GuideTask[],
  state: GuideState,
  facts: GuideFacts,
): boolean {
  return !state.firstStepsHidden && firstStepsProgress(firstSteps, state, facts).next !== undefined;
}

/**
 * The first step to offer after finishing `finishedId`: the next pending one in the order of the
 * profile, going round to the first. Never the one just finished, whose data may not be read yet,
 * and none after a task that is not a first step.
 */
export function nextFirstStep(
  firstSteps: readonly GuideTask[],
  state: GuideState,
  facts: GuideFacts,
  finishedId: string,
): GuideTask | undefined {
  const finished = firstSteps.findIndex((task) => task.id === finishedId);
  if (finished < 0) return undefined;
  const roundFromNext = [...firstSteps.slice(finished + 1), ...firstSteps.slice(0, finished + 1)];
  return roundFromNext.find((task) => task.id !== finishedId && !isTaskDone(task, state, facts));
}

/**
 * «¿Cómo se hace…?»: the tasks of the open screen first, each group in the order of the profile;
 * without `leftOut`: the first steps, while their own section shows them.
 */
export function orderTasks(
  tasks: readonly GuideTask[],
  screen: GuideScreen | undefined,
  leftOut: readonly GuideTask[],
): readonly GuideTask[] {
  const listed = tasks.filter((task) => !leftOut.includes(task));
  return [
    ...listed.filter((task) => task.screen === screen),
    ...listed.filter((task) => task.screen !== screen),
  ];
}

/** By title and keywords, without accents nor capitals, in the language of the interface. */
export function filterTasks(tasks: readonly GuideTask[], query: string): readonly GuideTask[] {
  const wanted = searchable(query.trim());
  if (!wanted) return tasks;
  return tasks.filter((task) =>
    [task.title, ...task.keywords].some((text) => searchable(text).includes(wanted)),
  );
}

/** Null if the task is possible now; otherwise why not, for the panel to say it. */
export function taskAvailability(task: GuideTask, facts: GuideFacts): string | null {
  const hasPage = task.place === undefined || (facts.places[task.place]?.length ?? 0) > 0;
  const hasNeed = task.needs === undefined || facts.known.has(task.needs);
  return hasPage && hasNeed ? null : (task.unavailable ?? '');
}

/**
 * Where a tour of `place` starts: where the user is if it is one of its pages (whatever its query)
 * or if it has no place, else its first page; undefined if the place has none.
 */
export function startPath(
  place: GuidePlace | undefined,
  facts: GuideFacts,
  currentUrl: string,
): string | undefined {
  if (place === undefined) return currentUrl;
  const pages = facts.places[place] ?? [];
  const here = pathOf(currentUrl);
  return pages.some((page) => pathOf(page) === here) ? currentUrl : pages[0];
}

/** The welcome shows once per version: a new one shows again. */
export function welcomePending(version: number, state: GuideState): boolean {
  return (state.welcome ?? 0) < version;
}

/** The task done at `at`; a task done again keeps its first date. */
export function withTaskDone(state: GuideState, taskId: string, at: string): GuideState {
  if (state.done?.[taskId]) return state;
  return { ...state, done: { ...state.done, [taskId]: at } };
}

export function withWelcomeSeen(state: GuideState, version: number): GuideState {
  return { ...state, welcome: version };
}

export function withFirstStepsHidden(state: GuideState): GuideState {
  return { ...state, firstStepsHidden: true };
}

/** The path of a URL of the app, without its query nor its fragment. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
