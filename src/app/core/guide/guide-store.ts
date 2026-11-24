import { computed, inject, linkedSignal, resource, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { AuthService } from '../../data/auth-service';
import type { GuideState } from '../../data/guide-state';
import {
  firstStepsOf,
  firstStepsProgress,
  nextFirstStep,
  showFirstSteps,
  startPath,
  taskAvailability,
  welcomePending,
  withFirstStepsHidden,
  withTaskDone,
  withWelcomeSeen,
} from './guide-progress';
import type { GuideFacts, GuidePlace, GuideProfile, GuideStep, GuideTask } from './guide-task';
import { type TourEnd, type TourOptions, TourRunner } from './tour-runner';

const NO_FACTS: GuideFacts = { known: new Set(), places: {} };

const SKIP_WELCOME = $localize`:@@guide.skipWelcome:Saltar la bienvenida`;

/**
 * What the user saw and did of the guided help (2.12, 4.5): the help button, its panel, the welcome
 * and the tours read it, on every screen. Each area gives its profile (its tasks, welcome, beacons
 * and facts) when its layout starts. What is saved is shown at once and sent whole, one save after
 * the other; if the server refuses one, it still counts in this visit and goes with the next one.
 */
@Service()
export class GuideStore {
  private readonly auth = inject(AuthStore);
  private readonly service = inject(AuthService);
  private readonly runner = inject(TourRunner);
  private readonly router = inject(Router);

  private readonly profileState = signal<GuideProfile | undefined>(undefined);
  private readonly saved = resource({
    params: () => this.auth.userId(),
    loader: () => this.service.guideState(),
  });
  /** What is saved, with the changes of this visit; it starts again with another user. */
  private readonly stateState = linkedSignal<GuideState>(() =>
    this.saved.hasValue() ? this.saved.value() : {},
  );
  /**
   * The facts are read again only for another profile or user: the same profile comes again from
   * the layout of another area, with its own side menu (D-093).
   */
  private readonly factsResource = resource({
    params: () => {
      const profile = this.profileState();
      const userId = this.auth.userId();
      return profile && userId ? `${profile.id}:${userId}` : undefined;
    },
    loader: () => this.profileState()!.loadFacts(),
  });
  private readonly runningState = signal(false);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(({ urlAfterRedirects }) => urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** The saves in course, in order: each one sends the whole state as it is by then. */
  private saving = Promise.resolve();

  readonly state = this.stateState.asReadonly();
  readonly facts = computed(() =>
    this.factsResource.hasValue() ? this.factsResource.value() : NO_FACTS,
  );
  readonly tasks = computed(() => this.profileState()?.tasks ?? []);
  /** The first steps of the profile, in its order. */
  readonly firstStepTasks = computed(() =>
    firstStepsOf(this.tasks(), this.profileState()?.firstSteps ?? []),
  );
  /** The screen open, if its area has guided help for it. */
  readonly screen = computed(() => this.profileState()?.screenOf(this.url()));
  /** A tour is running: no other starts meanwhile. */
  readonly running = this.runningState.asReadonly();
  readonly beaconsShown = this.runner.beaconsShown;
  /** What is saved and what the data says are both read. */
  readonly loaded = computed(
    () => this.saved.status() === 'resolved' && this.factsResource.status() === 'resolved',
  );

  readonly firstSteps = computed(() =>
    firstStepsProgress(this.firstStepTasks(), this.state(), this.facts()),
  );
  readonly firstStepsShown = computed(() =>
    showFirstSteps(this.firstStepTasks(), this.state(), this.facts()),
  );
  /** First steps left, for the dot of the help button; none once done or hidden. */
  readonly pendingFirstSteps = computed(() => {
    const { done, total } = this.firstSteps();
    return this.firstStepsShown() ? total - done : 0;
  });
  /** «Ayuda de esta pantalla» has something to show on the screen open. */
  readonly hasBeacons = computed(() => this.beaconsOfScreen().length > 0);

  /**
   * The welcome has to start now: everything read (never after a failure, so it is not repeated),
   * not seen in its version, on its screen, with nothing running and what its area waits for done.
   */
  readonly welcomeDue = computed(() => {
    const welcome = this.profileState()?.welcome;
    return (
      !!welcome &&
      this.loaded() &&
      welcomePending(welcome.version, this.state()) &&
      this.screen() === welcome.screen &&
      !this.runningState() &&
      (welcome.when?.() ?? true)
    );
  });

  /** The tour of every piece of the screen open, if it has one. */
  readonly screenTour = computed(() => {
    const screen = this.screen();
    return screen ? this.tasks().find((task) => task.tourOf === screen) : undefined;
  });

  /** Those of the screen open, then those of the bars, which every screen has. */
  private readonly beaconsOfScreen = computed(() => {
    const profile = this.profileState();
    const screen = this.screen();
    if (!profile || !screen) return [];
    const { beacons } = profile;
    return [
      ...beacons.filter((beacon) => beacon.screen === screen),
      ...beacons.filter((beacon) => beacon.screen === undefined),
    ];
  });

  /**
   * The guided help of the area that starts: its layout gives it. The same profile again (the staff,
   * crossing areas) only brings the side menu of the new layout: its facts stay.
   */
  use(profile: GuideProfile): void {
    this.profileState.set(profile);
  }

  /** What the data says may have changed: when the panel opens, and after each task. */
  refreshFacts(): void {
    this.factsResource.reload();
  }

  /**
   * The welcome counts as seen once it ends, also skipped (2.12): changing the language in the
   * middle opens the app again in it, and the welcome too. Its last globe offers the first step
   * still pending.
   */
  async startWelcome(): Promise<void> {
    const welcome = this.profileState()?.welcome;
    if (!welcome || this.runningState()) return;
    const next = this.possible(this.firstSteps().next);
    const end = await this.runTour(welcome.place, welcome.steps, {
      closeLabel: SKIP_WELCOME,
      next: next?.title,
    });
    if (end === undefined) return;
    this.save(withWelcomeSeen(this.state(), welcome.version));
    if (end === 'next' && next) await this.startTask(next);
  }

  /**
   * Runs a task where it starts. Finished, it is saved as done; if the user chose the next first
   * step on its last globe, that one starts at once.
   */
  async startTask(task: GuideTask): Promise<void> {
    if (!this.profileState() || this.runningState()) return;
    const next = this.possible(
      nextFirstStep(this.firstStepTasks(), this.state(), this.facts(), task.id),
    );
    const end = await this.runTour(task.place, task.steps, { next: next?.title });
    if (end === undefined) return;
    if (end === 'done' || end === 'next') {
      this.save(withTaskDone(this.state(), task.id, new Date().toISOString()));
    }
    this.refreshFacts();
    if (end === 'next' && next) await this.startTask(next);
  }

  /** «Ya sé usarla»: the first steps hide, and the dot of the button goes. */
  hideFirstSteps(): void {
    this.save(withFirstStepsHidden(this.state()));
  }

  showBeacons(): Promise<void> {
    return this.runner.showBeacons(this.beaconsOfScreen());
  }

  hideBeacons(): void {
    this.runner.hideBeacons();
  }

  /** The task, if it can be done now: «Siguiente: …» never offers one the user cannot do. */
  private possible(task: GuideTask | undefined): GuideTask | undefined {
    return task && taskAvailability(task, this.facts()) === null ? task : undefined;
  }

  /** Goes where the tour starts, unless the user is there already, and runs it. */
  private async runTour(
    place: GuidePlace | undefined,
    steps: readonly GuideStep[],
    options: TourOptions,
  ): Promise<TourEnd | undefined> {
    const path = startPath(place, this.facts(), this.router.url);
    if (path === undefined) return undefined;
    this.runningState.set(true);
    try {
      if (path !== this.router.url && !(await this.router.navigateByUrl(path))) return undefined;
      return await this.runner.run(steps, {
        ...options,
        sideMenu: this.profileState()?.sideMenu,
      });
    } finally {
      this.runningState.set(false);
    }
  }

  private save(state: GuideState): void {
    this.stateState.set(state);
    this.saving = this.saving
      .then(() => this.service.saveGuideState(this.stateState()))
      .catch(() => {
        // Kept for this visit: the next change sends it again, as every save sends everything
      });
  }
}
