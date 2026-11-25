import { ApplicationRef, Component, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { FakeAuthService } from '../../auth/auth-testing';
import { AuthService } from '../../data/auth-service';
import { DataError } from '../../data/data-error';
import type { GuideState } from '../../data/guide-state';
import { GuideStore } from './guide-store';
import type { GuideFacts, GuideProfile, GuideTask } from './guide-task';
import { type TourEnd, TourRunner } from './tour-runner';

@Component({ template: '' })
class EmptyPage {}

/** A tour that gets to its last globe, which asks for the next first step, and ends so. */
function endingWith(end: TourEnd): TourRunner['run'] {
  return async (_steps, options) => {
    await options?.next?.();
    return end;
  };
}

class FakeTourRunner {
  readonly beaconsShown = signal(false);
  run = vi.fn<TourRunner['run']>(endingWith('done'));
  showBeacons = vi.fn<TourRunner['showBeacons']>(() => Promise.resolve());
  hideBeacons = vi.fn<TourRunner['hideBeacons']>();
}

const STEP = { title: 'Paso', text: 'Texto' };
const START: GuideTask = {
  id: 'start-exercise',
  title: 'Empezar un ejercicio',
  summary: '',
  keywords: [],
  screen: 'catalog',
  place: 'catalog',
  steps: [STEP],
  doneBy: 'started',
};
const RUN: GuideTask = {
  ...START,
  id: 'run-tests',
  title: 'Ejecutar las pruebas',
  screen: 'workspace',
  place: 'openExercise',
  doneBy: 'ran',
};
const SETTINGS: GuideTask = {
  ...START,
  id: 'settings',
  screen: 'settings',
  place: 'settings',
  doneBy: undefined,
};

const FACTS: GuideFacts = {
  known: new Set(),
  places: {
    catalog: ['/alumno'],
    settings: ['/alumno/ajustes'],
    openExercise: ['/alumno/ejercicio/a'],
  },
};

describe('GuideStore', () => {
  let service: FakeAuthService;
  let runner: FakeTourRunner;
  let userId: ReturnType<typeof signal<string | undefined>>;
  let noticeSeen: ReturnType<typeof signal<boolean>>;
  let loadFacts: ReturnType<typeof vi.fn<GuideProfile['loadFacts']>>;
  let profile: GuideProfile;
  let store: GuideStore;
  let router: Router;

  beforeEach(async () => {
    service = new FakeAuthService();
    runner = new FakeTourRunner();
    userId = signal<string | undefined>('lucia');
    noticeSeen = signal(true);
    loadFacts = vi.fn<GuideProfile['loadFacts']>(() => Promise.resolve(FACTS));
    profile = {
      id: 'student',
      tasks: [START, RUN, SETTINGS],
      firstSteps: ['start-exercise', 'run-tests'],
      welcome: { version: 1, screen: 'catalog', place: 'catalog', steps: [STEP], when: noticeSeen },
      beacons: [
        { screen: 'catalog', anchor: 'catalog-next', title: 'Siguiente', text: '' },
        { screen: 'workspace', anchor: 'run-tests', title: 'Ejecutar', text: '' },
      ],
      screenOf: (url) =>
        url.startsWith('/alumno/ajustes')
          ? 'settings'
          : url.startsWith('/alumno/ejercicio')
            ? 'workspace'
            : url.startsWith('/alumno')
              ? 'catalog'
              : undefined,
      loadFacts,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        { provide: AuthService, useValue: service },
        { provide: AuthStore, useValue: { userId } },
        { provide: TourRunner, useValue: runner },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/alumno');
    store = TestBed.inject(GuideStore);
  });

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /** The title the tour of that call offered on its last globe. */
  function offeredBy(call: number): Promise<string | undefined> | undefined {
    return runner.run.mock.calls[call][1]?.next?.();
  }

  async function useProfile(state: GuideState = {}, facts: GuideFacts = FACTS): Promise<void> {
    service.guideState.mockResolvedValue(state);
    loadFacts.mockResolvedValue(facts);
    store.use(profile);
    await settle();
  }

  describe('reading', () => {
    it('reads what the user saved and the facts of the profile', async () => {
      await useProfile({ welcome: 1 }, { ...FACTS, known: new Set(['started']) });

      expect(store.state()).toEqual({ welcome: 1 });
      expect(store.tasks()).toEqual([START, RUN, SETTINGS]);
      expect(store.firstSteps()).toEqual({ done: 1, total: 2, next: RUN });
      expect(store.pendingFirstSteps()).toBe(1);
      expect(store.loaded()).toBe(true);
    });

    it('has nothing without a profile or a session', async () => {
      userId.set(undefined);
      store.use(profile);
      await settle();

      expect(store.state()).toEqual({});
      expect(store.facts().known.size).toBe(0);
      expect(loadFacts).not.toHaveBeenCalled();
      expect(store.loaded()).toBe(false);
    });

    it('takes the first steps the profile names, in its order', async () => {
      await useProfile();
      store.use({ ...profile, firstSteps: ['run-tests'] });

      expect(store.firstSteps()).toEqual({ done: 0, total: 1, next: RUN });
    });

    it('keeps the facts read when the same profile comes again, as from another area', async () => {
      await useProfile();
      const sideMenu = { open: vi.fn(), close: vi.fn(), closed: vi.fn() };

      store.use({ ...profile, sideMenu });
      await settle();

      expect(loadFacts).toHaveBeenCalledOnce();
      await store.startTask(SETTINGS);
      expect(runner.run.mock.calls[0][1]?.sideMenu).toBeDefined();
    });

    it('gives the tour the side menu of the layout open now, not of the one where it started', async () => {
      const first = { open: vi.fn(() => Promise.resolve()), close: vi.fn(), closed: vi.fn() };
      const second = { open: vi.fn(), close: vi.fn(), closed: vi.fn(() => Promise.resolve()) };
      profile = { ...profile, sideMenu: first };
      await useProfile();
      await store.startTask(SETTINGS);
      const sideMenu = runner.run.mock.calls[0][1]!.sideMenu!;

      await sideMenu.open();
      store.use({ ...profile, sideMenu: second });
      sideMenu.close();
      await sideMenu.closed();

      expect(first.open).toHaveBeenCalledOnce();
      expect(second.close).toHaveBeenCalledOnce();
      expect(second.closed).toHaveBeenCalledOnce();
      // An area without one, as the student's: nothing to open, nothing to wait for
      store.use({ ...profile, sideMenu: undefined });
      expect(sideMenu.open()).toBeUndefined();
      sideMenu.close();
      await expect(sideMenu.closed()).resolves.toBeUndefined();
    });

    it('gives no side menu to an area without one', async () => {
      await useProfile();

      await store.startTask(SETTINGS);

      expect(runner.run.mock.calls[0][1]?.sideMenu).toBeUndefined();
    });

    it('gives the mascot of the globes the injector of the area open now', async () => {
      const injector = TestBed.inject(EnvironmentInjector);
      profile = { ...profile, injector };
      await useProfile();

      await store.startTask(SETTINGS);

      expect(runner.run.mock.calls[0][1]?.injector?.()).toBe(injector);
    });

    it('reads the facts of another profile', async () => {
      await useProfile();
      const teacherFacts = vi.fn(() => Promise.resolve(FACTS));

      store.use({ ...profile, id: 'teacher', loadFacts: teacherFacts });
      await settle();

      expect(teacherFacts).toHaveBeenCalledOnce();
    });

    it('counts no first step pending once they are hidden', async () => {
      await useProfile({ firstStepsHidden: true });

      expect(store.firstStepsShown()).toBe(false);
      expect(store.pendingFirstSteps()).toBe(0);
    });

    it('reads the facts again when asked', async () => {
      await useProfile();
      loadFacts.mockResolvedValue({ ...FACTS, known: new Set(['started', 'ran']) });

      store.refreshFacts();
      await settle();

      expect(store.firstSteps().done).toBe(2);
    });

    it('knows the screen open and whether it has beacons', async () => {
      await useProfile();
      expect(store.screen()).toBe('catalog');
      expect(store.hasBeacons()).toBe(true);

      await router.navigateByUrl('/alumno/ajustes');
      expect(store.screen()).toBe('settings');
      expect(store.hasBeacons()).toBe(false);
    });

    it('shows the beacons of the bars on every screen, and none outside the area', async () => {
      profile = {
        ...profile,
        beacons: [...profile.beacons, { anchor: 'help', title: 'Ayuda', text: '' }],
      };
      await useProfile();
      await router.navigateByUrl('/alumno/ajustes');
      expect(store.hasBeacons()).toBe(true);

      await router.navigateByUrl('/docente');
      expect(store.screen()).toBeUndefined();
      expect(store.hasBeacons()).toBe(false);
    });

    it('knows the tour of the screen open, if it has one', async () => {
      const tour = { ...SETTINGS, id: 'tour-catalog', tourOf: 'catalog' as const };
      profile = { ...profile, tasks: [...profile.tasks, tour] };
      await useProfile();
      expect(store.screenTour()).toBe(tour);

      await router.navigateByUrl('/alumno/ajustes');
      expect(store.screenTour()).toBeUndefined();
      await router.navigateByUrl('/docente');
      expect(store.screenTour()).toBeUndefined();
    });

    it('has no tasks, first steps, beacons nor tour before an area gives its profile', () => {
      expect(store.tasks()).toEqual([]);
      expect(store.firstStepTasks()).toEqual([]);
      expect(store.screen()).toBeUndefined();
      expect(store.hasBeacons()).toBe(false);
      expect(store.screenTour()).toBeUndefined();
      expect(store.welcomeDue()).toBe(false);
    });
  });

  describe('the welcome', () => {
    it('is due once everything is read, on its screen and when the area allows it', async () => {
      noticeSeen.set(false);
      await useProfile();
      expect(store.welcomeDue()).toBe(false);

      noticeSeen.set(true);
      expect(store.welcomeDue()).toBe(true);

      await router.navigateByUrl('/alumno/ajustes');
      expect(store.welcomeDue()).toBe(false);
    });

    it('waits for nothing else when its area does not say what to wait for', async () => {
      profile = { ...profile, welcome: { ...profile.welcome, when: undefined } };
      await useProfile();

      expect(store.welcomeDue()).toBe(true);
    });

    it('is not due once seen, nor if what was seen could not be read', async () => {
      await useProfile({ welcome: 1 });
      expect(store.welcomeDue()).toBe(false);

      service.guideState.mockRejectedValue(new DataError('network'));
      userId.set('hugo');
      await settle();
      expect(store.welcomeDue()).toBe(false);
    });

    it('counts as seen once it ends, however it ends', async () => {
      await useProfile();
      runner.run.mockResolvedValue('closed');

      await store.startWelcome();

      expect(runner.run).toHaveBeenCalledWith(
        profile.welcome.steps,
        expect.objectContaining({ closeLabel: 'Saltar la bienvenida' }),
      );
      await expect(offeredBy(0)).resolves.toBe('Empezar un ejercicio');
      expect(service.saveGuideState).toHaveBeenCalledWith({ welcome: 1 });
      expect(store.welcomeDue()).toBe(false);
    });

    it('is not seen while it runs: a reload in the middle, as changing the language, shows it again', async () => {
      await useProfile();
      runner.run.mockReturnValueOnce(new Promise(() => undefined));

      void store.startWelcome();
      await settle();

      expect(service.saveGuideState).not.toHaveBeenCalled();
    });

    it('starts the first step pending if chosen on its last globe', async () => {
      await useProfile();
      runner.run.mockImplementationOnce(endingWith('next')).mockResolvedValueOnce('closed');

      await store.startWelcome();

      expect(runner.run).toHaveBeenNthCalledWith(2, START.steps, expect.anything());
      await expect(offeredBy(1)).resolves.toBe('Ejecutar las pruebas');
      expect(store.state().welcome).toBe(1);
    });

    it('offers no first step once all are done', async () => {
      await useProfile({}, { ...FACTS, known: new Set(['started', 'ran']) });

      await store.startWelcome();

      await expect(offeredBy(0)).resolves.toBeUndefined();
    });

    it('offers no first step that cannot be done yet', async () => {
      await useProfile({}, { known: new Set(['started']), places: { catalog: ['/alumno'] } });

      await store.startWelcome();

      await expect(offeredBy(0)).resolves.toBeUndefined();
    });

    it('is not seen if it could not start', async () => {
      await useProfile({}, { ...FACTS, places: {} });

      await store.startWelcome();

      expect(runner.run).not.toHaveBeenCalled();
      expect(service.saveGuideState).not.toHaveBeenCalled();
    });

    it('goes to its screen first when asked for from another one', async () => {
      await useProfile({ welcome: 1 });
      await router.navigateByUrl('/alumno/ajustes');

      await store.startWelcome();

      expect(router.url).toBe('/alumno');
      expect(runner.run).toHaveBeenCalledOnce();
    });
  });

  describe('a task', () => {
    it('goes to its place, runs and is saved as done with its date', async () => {
      await useProfile();
      vi.useFakeTimers({ now: new Date('2026-11-23T10:00:00.000Z'), toFake: ['Date'] });

      await store.startTask(SETTINGS);
      vi.useRealTimers();
      await settle();

      expect(router.url).toBe('/alumno/ajustes');
      expect(runner.run).toHaveBeenCalledWith(SETTINGS.steps, expect.anything());
      expect(service.saveGuideState).toHaveBeenCalledWith({
        done: { settings: '2026-11-23T10:00:00.000Z' },
      });
      // Once at the start, once on the last globe and once after it
      expect(loadFacts).toHaveBeenCalledTimes(3);
      await expect(offeredBy(0)).resolves.toBeUndefined();
    });

    it('stays where it is when it is already in its place', async () => {
      await useProfile();
      await router.navigateByUrl('/alumno/ejercicio/a?intento=2');

      await store.startTask(RUN);

      expect(router.url).toBe('/alumno/ejercicio/a?intento=2');
    });

    it('is not saved if it was closed or cut short', async () => {
      await useProfile();
      runner.run.mockResolvedValueOnce('closed').mockResolvedValueOnce('interrupted');

      await store.startTask(SETTINGS);
      await store.startTask(SETTINGS);

      expect(service.saveGuideState).not.toHaveBeenCalled();
    });

    it('offers the next first step on its last globe, and starts it if chosen', async () => {
      await useProfile();
      runner.run.mockImplementationOnce(endingWith('next')).mockResolvedValueOnce('closed');

      await store.startTask(START);

      expect(runner.run).toHaveBeenNthCalledWith(1, START.steps, expect.anything());
      expect(runner.run).toHaveBeenNthCalledWith(2, RUN.steps, expect.anything());
      await expect(offeredBy(0)).resolves.toBe('Ejecutar las pruebas');
      await expect(offeredBy(1)).resolves.toBeUndefined();
      expect(router.url).toBe('/alumno/ejercicio/a');
      expect(store.state().done).toHaveProperty('start-exercise');
    });

    it('does not offer a next first step that cannot be done yet', async () => {
      await useProfile({}, { known: new Set(), places: { catalog: ['/alumno'] } });

      await store.startTask(START);

      await expect(offeredBy(0)).resolves.toBeUndefined();
    });

    it('chooses the next first step with the data read on its last globe (7.0b2)', async () => {
      // No exercise open at the start: «Ejecutar las pruebas» is not possible yet
      await useProfile({}, { known: new Set(), places: { catalog: ['/alumno'] } });
      loadFacts.mockResolvedValue(FACTS);
      let loadedOnLastGlobe = false;
      runner.run
        .mockImplementationOnce(async (_steps, options) => {
          await options?.next?.();
          loadedOnLastGlobe = store.loaded();
          return 'next';
        })
        .mockResolvedValueOnce('closed');

      await store.startTask(START);

      expect(runner.run).toHaveBeenNthCalledWith(2, RUN.steps, expect.anything());
      // The facts read by the last globe count as read
      expect(loadedOnLastGlobe).toBe(true);
    });

    it('chooses with the data it had if they cannot be read on its last globe', async () => {
      await useProfile();
      loadFacts.mockRejectedValue(new DataError('network'));
      runner.run.mockImplementationOnce(endingWith('next')).mockResolvedValueOnce('closed');

      await store.startTask(START);

      expect(runner.run).toHaveBeenNthCalledWith(2, RUN.steps, expect.anything());
    });

    it('does not start without a page for its place, or while another tour runs', async () => {
      await useProfile({}, { ...FACTS, places: { catalog: ['/alumno'] } });
      await store.startTask(RUN);
      expect(runner.run).not.toHaveBeenCalled();

      let finish: (end: TourEnd) => void = () => undefined;
      runner.run.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
      const first = store.startTask(START);
      await settle();
      expect(store.running()).toBe(true);
      await store.startTask(START);
      finish('closed');
      await first;

      expect(runner.run).toHaveBeenCalledOnce();
      expect(store.running()).toBe(false);
    });

    it('does not start where the navigation is refused', async () => {
      await useProfile();
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(false);

      await store.startTask(SETTINGS);

      expect(runner.run).not.toHaveBeenCalled();
    });

    it('does nothing before the profile is given', async () => {
      await store.startTask(SETTINGS);
      await store.startWelcome();

      expect(runner.run).not.toHaveBeenCalled();
    });
  });

  describe('saving', () => {
    it('hides the first steps', async () => {
      await useProfile({ welcome: 1 });

      store.hideFirstSteps();
      await settle();

      expect(store.firstStepsShown()).toBe(false);
      expect(service.saveGuideState).toHaveBeenCalledWith({ welcome: 1, firstStepsHidden: true });
    });

    it('keeps a change the server refused for this visit, and sends it again with the next one', async () => {
      await useProfile();
      service.saveGuideState.mockRejectedValueOnce(new DataError('network'));

      store.hideFirstSteps();
      await store.startWelcome();
      await settle();

      expect(store.state()).toEqual({ firstStepsHidden: true, welcome: 1 });
      expect(service.saveGuideState).toHaveBeenLastCalledWith({
        firstStepsHidden: true,
        welcome: 1,
      });
    });

    it('sends the changes one after the other, each with everything known by then', async () => {
      await useProfile();
      let release = () => undefined as void;
      service.saveGuideState.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

      store.hideFirstSteps();
      await store.startWelcome();
      expect(service.saveGuideState).toHaveBeenCalledOnce();

      release();
      await settle();
      expect(service.saveGuideState).toHaveBeenCalledTimes(2);
      expect(service.saveGuideState).toHaveBeenLastCalledWith({
        firstStepsHidden: true,
        welcome: 1,
      });
    });
  });

  describe('beacons', () => {
    it('shows those of the screen open, and hides them', async () => {
      await useProfile();

      await store.showBeacons();
      store.hideBeacons();

      expect(runner.showBeacons).toHaveBeenCalledWith([profile.beacons[0]]);
      expect(runner.hideBeacons).toHaveBeenCalled();
    });
  });
});
