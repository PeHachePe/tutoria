import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../auth/auth-store';
import { userWith } from '../auth/auth-testing';
import { GUIDE_ANCHORS } from '../core/guide/guide-anchor';
import type { GuideStep } from '../core/guide/guide-task';
import { IS_MAC } from '../core/is-mac';
import type { AttemptStatus } from '../data/attempt';
import type { AssignedExercise, AssignedGroup } from '../data/exercise';
import { ExerciseService } from '../data/exercise-service';
import { editorKeys } from '../shared/code-editor/editor-keys';
import {
  screenTours,
  studentBeacons,
  studentFacts,
  studentGuide,
  studentScreen,
} from './student-guide';

const DAW: AssignedGroup = {
  id: 'daw',
  name: '1.º DAW A',
  label: null,
  subject: { id: 'basic', name: 'Programación básica', sourceLocale: 'es', translations: {} },
};
const WEB: AssignedGroup = { ...DAW, id: 'web' };

function entry(
  id: string,
  status: AttemptStatus,
  changes: Partial<AssignedExercise> = {},
): AssignedExercise {
  return {
    exercise: { id } as AssignedExercise['exercise'],
    assignmentId: id,
    group: DAW,
    block: { id: 'b1', groupId: DAW.id, position: 1 } as AssignedExercise['block'],
    dueAt: null,
    updatedAt: status === 'not_started' ? null : '2026-11-20T10:00:00.000Z',
    status,
    hintCount: 0,
    hintLevel: null,
    practice: null,
    repetitions: 0,
    ...changes,
  };
}

const path = (id: string) => `/alumno/ejercicio/${id}`;

/** A practice in progress after the attempt that counts. */
function practice(updatedAt: string): AssignedExercise['practice'] {
  return { number: 2, status: 'in_progress', updatedAt, hintCount: 0, hintLevel: null };
}

describe('student guide', () => {
  describe('studentFacts', () => {
    it('knows nothing, and has only the fixed pages, without exercises', () => {
      const facts = studentFacts([]);

      expect([...facts.known]).toEqual([]);
      expect(facts.places).toEqual({
        catalog: ['/alumno'],
        settings: ['/alumno/ajustes'],
        registeredData: ['/alumno/datos'],
        openExercise: [],
        submittedExercise: [],
        exerciseWithAttempts: [],
      });
    });

    it('knows what the student did, from every exercise and its practice', () => {
      const facts = studentFacts([
        entry('a', 'submitted', {
          hintCount: 2,
          repetitions: 1,
          practice: practice('2026-11-22T10:00:00.000Z'),
        }),
        entry('b', 'not_started', { group: WEB }),
      ]);

      expect([...facts.known].sort()).toEqual(
        [
          'askedHint',
          'hasOpenExercise',
          'hasSeveralSubjects',
          'ran',
          'started',
          'submitted',
        ].sort(),
      );
    });

    it('counts as ran only an attempt with a run, and as started anything begun', () => {
      expect([...studentFacts([entry('a', 'in_progress')]).known].sort()).toEqual([
        'hasOpenExercise',
        'started',
      ]);
      expect(studentFacts([entry('a', 'tests_failed')]).known.has('ran')).toBe(true);
    });

    it('starts the tasks of the workspace at the exercise the catalog suggests first', () => {
      const facts = studentFacts([
        entry('new', 'not_started'),
        entry('halfway', 'in_progress'),
        entry('done', 'submitted', { repetitions: 2 }),
      ]);

      expect(facts.places.openExercise).toEqual([path('halfway'), path('new')]);
      expect(facts.places.submittedExercise).toEqual([path('done')]);
      expect(facts.places.exerciseWithAttempts).toEqual([path('done')]);
    });

    it('takes a submitted exercise practised again as open, not as submitted', () => {
      const facts = studentFacts([
        entry('a', 'submitted', {
          practice: practice('2026-11-21T10:00:00.000Z'),
        }),
      ]);

      expect(facts.places.openExercise).toEqual([path('a')]);
      expect(facts.places.submittedExercise).toEqual([]);
    });
  });

  it.each([
    ['/alumno', 'catalog'],
    ['/alumno?grupo=web', 'catalog'],
    ['/alumno/ejercicio/a?intento=2', 'workspace'],
    ['/alumno/ajustes', 'settings'],
    ['/alumno/datos#arriba', 'registered-data'],
    ['/docente/en-vivo', undefined],
  ])('knows that %s is the screen %s', (url, screen) => {
    expect(studentScreen(url)).toBe(screen);
  });

  describe('beacons and tours of the screens', () => {
    const beacons = studentBeacons(editorKeys(false));

    it('explains every piece once per screen, the bars on every screen', () => {
      const bars = beacons.filter((beacon) => !beacon.screen).map((beacon) => beacon.anchor);
      expect(bars).toEqual([
        'brand',
        'nav-exercises',
        'help',
        'theme-menu',
        'language-menu',
        'user-menu',
      ]);
      for (const screen of ['catalog', 'workspace', 'settings', 'registered-data'] as const) {
        const anchors = beacons.filter((beacon) => beacon.screen === screen).map((b) => b.anchor);
        expect(new Set(anchors).size).toBe(anchors.length);
      }
      expect(beacons.find((beacon) => beacon.anchor === GUIDE_ANCHORS.editor)?.text).toContain(
        'Ctrl + Intro',
      );
    });

    it('makes a tour of each screen from its beacons, which may be missing', () => {
      const tours = screenTours(beacons);
      const anchorsOf = (steps: readonly GuideStep[]) => steps.map((step) => step.anchor);

      expect(tours.map((tour) => [tour.id, tour.tourOf, tour.place])).toEqual([
        ['tour-catalog', 'catalog', 'catalog'],
        ['tour-workspace', 'workspace', 'openExercise'],
        ['tour-settings', 'settings', 'settings'],
        ['tour-registered-data', 'registered-data', 'registeredData'],
      ]);
      const [catalog, workspace, settings] = tours;
      expect(catalog.steps.every((step) => step.optional)).toBe(true);
      // The catalog, home of the area, ends with the bars
      expect(anchorsOf(catalog.steps).slice(-6)).toEqual([
        'brand',
        'nav-exercises',
        'help',
        'theme-menu',
        'language-menu',
        'user-menu',
      ]);
      expect(anchorsOf(settings.steps)).not.toContain('help');
      expect(settings.steps.find((step) => step.anchor === 'settings-voice')?.turnOn).toBe(
        'Activar la voz',
      );
      expect(workspace.unavailable).toBe('Cuando tu docente te asigne un ejercicio');
    });

    it('opens the tabs and the folded tutor on the way through the workspace', () => {
      const workspace = screenTours(beacons)[1];
      const anchors = workspace.steps.map((step) => step.anchor);
      const before = (opener: string, piece: string) =>
        anchors[anchors.indexOf(piece as never) - 1] === opener;

      expect(before('workspace-tab-code', 'save-indicator')).toBe(true);
      expect(before('workspace-tab-tutor', 'tutor-toggle')).toBe(true);
      expect(before('tutor-toggle', 'hint-level')).toBe(true);
      expect(workspace.steps.filter((step) => step.action).map((step) => step.anchor)).toEqual([
        'workspace-tab-code',
        'workspace-tab-tutor',
        'tutor-toggle',
      ]);
    });
  });

  describe('studentGuide', () => {
    const listAssigned = vi.fn<ExerciseService['listAssigned']>();
    const userId = signal<string | undefined>('lucia');
    const noticeSeen = signal(true);

    function guide(mac = false) {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: AuthStore,
            useValue: {
              user: signal({ ...userWith('student'), name: 'Lucía Martín Gómez' }),
              userId,
              privacyNoticeSeen: noticeSeen,
            },
          },
          { provide: ExerciseService, useValue: { listAssigned } },
          { provide: IS_MAC, useValue: mac },
        ],
      });
      return TestBed.runInInjectionContext(() => studentGuide());
    }

    beforeEach(() => {
      listAssigned.mockReset();
      userId.set('lucia');
    });

    it('welcomes by first name, with the bar in its order, ending where the work starts', () => {
      const { welcome } = guide();

      expect(welcome).toMatchObject({ version: 1, screen: 'catalog', place: 'catalog' });
      expect(welcome.steps[0].title).toBe('¡Hola, Lucía!');
      expect(welcome.steps.map((step) => step.anchor)).toEqual([
        undefined,
        'help',
        'theme-menu',
        'language-menu',
        'user-menu',
        'catalog-subjects',
        'catalog-next',
      ]);
      expect(welcome.when?.()).toBe(true);
      noticeSeen.set(false);
      expect(welcome.when?.()).toBe(false);
      noticeSeen.set(true);
    });

    it('lists the first steps, then the tours of the screens, then the rest', () => {
      const { id, tasks, firstSteps, beacons, screenOf } = guide(true);
      const ids = tasks.map((task) => task.id);

      expect(id).toBe('student');
      expect(firstSteps).toEqual(['start-exercise', 'run-tests', 'ask-hint', 'submit']);
      expect(ids.slice(0, 4)).toEqual(firstSteps);
      expect(ids.slice(4, 8)).toEqual([
        'tour-catalog',
        'tour-workspace',
        'tour-settings',
        'tour-registered-data',
      ]);
      expect(new Set(ids).size).toBe(ids.length);
      expect(beacons.find((beacon) => beacon.anchor === 'editor')?.text).toContain('⌘ + Intro');
      expect(screenOf('/alumno')).toBe('catalog');
    });

    it('reads the facts from the exercises of the student, and none without a session', async () => {
      const profile = guide();
      listAssigned.mockResolvedValue([entry('a', 'submitted')]);

      await expect(profile.loadFacts()).resolves.toMatchObject({
        known: new Set(['started', 'ran', 'submitted']),
      });
      expect(listAssigned).toHaveBeenCalledWith('lucia');

      userId.set(undefined);
      await expect(profile.loadFacts()).resolves.toMatchObject({ known: new Set() });
      expect(listAssigned).toHaveBeenCalledOnce();
    });

    it('welcomes without a name if there is no user', () => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: AuthStore,
            useValue: { user: signal(null), userId, privacyNoticeSeen: noticeSeen },
          },
          { provide: ExerciseService, useValue: { listAssigned } },
        ],
      });

      const { welcome } = TestBed.runInInjectionContext(() => studentGuide());

      expect(welcome.steps[0].title).toBe('¡Hola!');
    });
  });
});
