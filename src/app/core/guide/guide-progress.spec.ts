import type { GuideState } from '../../data/guide-state';
import {
  filterTasks,
  firstStepsOf,
  firstStepsProgress,
  isTaskDone,
  nextFirstStep,
  orderTasks,
  showFirstSteps,
  startPath,
  taskAvailability,
  welcomePending,
  withFirstStepsHidden,
  withTaskDone,
  withWelcomeSeen,
} from './guide-progress';
import type { GuideFact, GuideFacts, GuideTask } from './guide-task';

function task(id: string, changes: Partial<GuideTask> = {}): GuideTask {
  return {
    id,
    title: id,
    summary: '',
    keywords: [],
    screen: 'workspace',
    place: 'openExercise',
    steps: [],
    ...changes,
  };
}

function facts(known: readonly GuideFact[] = [], places: GuideFacts['places'] = {}): GuideFacts {
  return { known: new Set(known), places };
}

const START = task('start-exercise', { doneBy: 'started', screen: 'catalog' });
const RUN = task('run-tests', { doneBy: 'ran' });
const HINT = task('ask-hint', { doneBy: 'askedHint' });
const SETTINGS = task('settings', { screen: 'settings', place: 'settings' });
const DATA = task('registered-data', {
  title: 'Ver qué datos se registran',
  keywords: ['privacidad', 'información'],
  screen: 'registered-data',
  place: 'catalog',
});
const TASKS = [START, RUN, HINT, SETTINGS, DATA];
/** The first steps of the profile, in its order. */
const FIRST = [START, RUN, HINT];
const NOTHING: GuideState = {};

describe('guide progress', () => {
  describe('isTaskDone', () => {
    it('takes a task as done by its data', () => {
      expect(isTaskDone(RUN, NOTHING, facts(['ran']))).toBe(true);
      expect(isTaskDone(RUN, NOTHING, facts(['started']))).toBe(false);
    });

    it('or by having finished its tour, also when the data cannot tell yet', () => {
      const state = { done: { 'run-tests': '2026-11-23T10:00:00.000Z' } };

      expect(isTaskDone(RUN, state, facts())).toBe(true);
      expect(isTaskDone(SETTINGS, state, facts())).toBe(false);
    });
  });

  describe('first steps', () => {
    it('are the tasks the profile names, in its order, leaving out the ids it does not know', () => {
      expect(firstStepsOf(TASKS, ['run-tests', 'nope', 'start-exercise'])).toEqual([RUN, START]);
      expect(firstStepsOf(TASKS, [])).toEqual([]);
    });

    it('counts the first steps done, with the next one pending', () => {
      expect(firstStepsProgress(FIRST, NOTHING, facts(['started']))).toEqual({
        done: 1,
        total: 3,
        next: RUN,
      });
    });

    it('has no next one once all are done', () => {
      expect(firstStepsProgress(FIRST, NOTHING, facts(['started', 'ran', 'askedHint']))).toEqual({
        done: 3,
        total: 3,
        next: undefined,
      });
    });

    it('shows them while some is pending and the user did not hide them', () => {
      expect(showFirstSteps(FIRST, NOTHING, facts())).toBe(true);
      expect(showFirstSteps(FIRST, { firstStepsHidden: true }, facts())).toBe(false);
      expect(showFirstSteps(FIRST, NOTHING, facts(['started', 'ran', 'askedHint']))).toBe(false);
    });

    it('offers the next pending one after finishing one, going round to the first', () => {
      expect(nextFirstStep(FIRST, NOTHING, facts(['started']), 'run-tests')).toBe(HINT);
      expect(nextFirstStep(FIRST, NOTHING, facts(['ran', 'askedHint']), 'ask-hint')).toBe(START);
    });

    it('offers none when the one finished was the last pending', () => {
      expect(
        nextFirstStep(FIRST, NOTHING, facts(['started', 'ran', 'askedHint']), 'ask-hint'),
      ).toBeUndefined();
    });

    it('offers none after a task that is not a first step', () => {
      expect(nextFirstStep(FIRST, NOTHING, facts(), 'settings')).toBeUndefined();
    });

    it('does not offer the one just finished while its data is not read yet', () => {
      expect(nextFirstStep(FIRST, NOTHING, facts(['started', 'ran']), 'ask-hint')).toBeUndefined();
    });
  });

  describe('the list of the panel', () => {
    it('puts first the tasks of the open screen, keeping their order', () => {
      expect(orderTasks(TASKS, 'settings', [])).toEqual([SETTINGS, START, RUN, HINT, DATA]);
      expect(orderTasks(TASKS, 'workspace', [])).toEqual([RUN, HINT, START, SETTINGS, DATA]);
    });

    it('keeps the order on a screen without tasks', () => {
      expect(orderTasks(TASKS, undefined, [])).toEqual(TASKS);
    });

    it('leaves out the first steps while they show above', () => {
      expect(orderTasks(TASKS, 'catalog', FIRST)).toEqual([SETTINGS, DATA]);
    });

    it('filters by title and keywords, without accents nor capitals', () => {
      expect(filterTasks(TASKS, 'DATOS')).toEqual([DATA]);
      expect(filterTasks(TASKS, 'informacion')).toEqual([DATA]);
      expect(filterTasks(TASKS, '  privacídad ')).toEqual([DATA]);
      expect(filterTasks(TASKS, 'nada de esto')).toEqual([]);
    });

    it('keeps them all with an empty filter', () => {
      expect(filterTasks(TASKS, '  ')).toEqual(TASKS);
    });
  });

  describe('availability', () => {
    const SUBMITTED = task('practise-again', {
      place: 'submittedExercise',
      unavailable: 'Cuando hayas entregado un ejercicio',
    });
    const NEEDS = task('needs', { place: 'catalog', needs: 'hasOpenExercise', unavailable: 'No' });

    it('is possible where its place has a page and its need is known', () => {
      expect(taskAvailability(SUBMITTED, facts([], { submittedExercise: ['/x'] }))).toBeNull();
      expect(taskAvailability(NEEDS, facts(['hasOpenExercise'], { catalog: ['/'] }))).toBeNull();
    });

    it('says why it is not possible', () => {
      expect(taskAvailability(SUBMITTED, facts([], { submittedExercise: [] }))).toBe(
        'Cuando hayas entregado un ejercicio',
      );
      expect(taskAvailability(SUBMITTED, facts())).toBe('Cuando hayas entregado un ejercicio');
      expect(taskAvailability(NEEDS, facts([], { catalog: ['/'] }))).toBe('No');
    });

    it('has an empty reason when the task gives none', () => {
      expect(taskAvailability(task('x', { place: 'catalog' }), facts())).toBe('');
    });

    it('is always possible for a task that starts where the user is', () => {
      expect(taskAvailability(task('x', { place: undefined }), facts())).toBeNull();
    });
  });

  describe('startPath', () => {
    const PAGES = facts([], { openExercise: ['/alumno/ejercicio/a', '/alumno/ejercicio/b'] });

    it('goes to the first page of the place', () => {
      expect(startPath('openExercise', PAGES, '/alumno')).toBe('/alumno/ejercicio/a');
    });

    it('stays where the user is if it is one of its pages, whatever its query', () => {
      expect(startPath('openExercise', PAGES, '/alumno/ejercicio/b?intento=2')).toBe(
        '/alumno/ejercicio/b?intento=2',
      );
    });

    it('has none for a place without pages', () => {
      expect(startPath('submittedExercise', PAGES, '/alumno')).toBeUndefined();
    });

    it('stays where the user is without a place', () => {
      expect(startPath(undefined, PAGES, '/alumno/ajustes')).toBe('/alumno/ajustes');
    });
  });

  describe('the welcome', () => {
    it('is pending until its version is seen', () => {
      expect(welcomePending(1, NOTHING)).toBe(true);
      expect(welcomePending(1, { welcome: 1 })).toBe(false);
      expect(welcomePending(2, { welcome: 1 })).toBe(true);
    });
  });

  describe('what is saved', () => {
    it('adds a task done with its date, keeping the rest', () => {
      const state = { welcome: 1, done: { 'run-tests': 'antes' } };

      expect(withTaskDone(state, 'ask-hint', 'ahora')).toEqual({
        welcome: 1,
        done: { 'run-tests': 'antes', 'ask-hint': 'ahora' },
      });
    });

    it('keeps the first date of a task done again', () => {
      const state = { done: { 'run-tests': 'antes' } };

      expect(withTaskDone(state, 'run-tests', 'ahora')).toBe(state);
    });

    it('records the welcome seen and the first steps hidden', () => {
      expect(withWelcomeSeen({ firstStepsHidden: true }, 2)).toEqual({
        firstStepsHidden: true,
        welcome: 2,
      });
      expect(withFirstStepsHidden({ welcome: 1 })).toEqual({ welcome: 1, firstStepsHidden: true });
    });
  });
});
