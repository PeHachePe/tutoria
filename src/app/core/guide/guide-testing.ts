import { computed, signal } from '@angular/core';

import type { GuideState } from '../../data/guide-state';
import { firstStepsOf, firstStepsProgress, showFirstSteps } from './guide-progress';
import type { GuideFacts, GuideScreen, GuideTask } from './guide-task';

/**
 * Test double of GuideStore for the components of the help: each test sets its signals, and its
 * progress is worked out as in the store.
 */
export class FakeGuideStore {
  readonly state = signal<GuideState>({});
  readonly facts = signal<GuideFacts>({ known: new Set(), places: {} });
  readonly tasks = signal<readonly GuideTask[]>([]);
  /** The ids of the first steps of the profile, in its order. */
  readonly firstStepIds = signal<readonly string[]>([]);
  readonly firstStepTasks = computed(() => firstStepsOf(this.tasks(), this.firstStepIds()));
  readonly screen = signal<GuideScreen | undefined>(undefined);
  readonly screenTour = signal<GuideTask | undefined>(undefined);
  readonly hasBeacons = signal(false);
  readonly beaconsShown = signal(false);
  readonly welcomeDue = signal(false);

  readonly firstSteps = computed(() =>
    firstStepsProgress(this.firstStepTasks(), this.state(), this.facts()),
  );
  readonly firstStepsShown = computed(() =>
    showFirstSteps(this.firstStepTasks(), this.state(), this.facts()),
  );
  readonly pendingFirstSteps = computed(() => {
    const { done, total } = this.firstSteps();
    return this.firstStepsShown() ? total - done : 0;
  });

  refreshFacts = vi.fn();
  startWelcome = vi.fn(() => Promise.resolve());
  startTask = vi.fn<(task: GuideTask) => Promise<void>>(() => Promise.resolve());
  hideFirstSteps = vi.fn();
  showBeacons = vi.fn(() => Promise.resolve());
  hideBeacons = vi.fn();
}

/** A guided task for the tests, with what each one changes. */
export function guideTask(id: string, changes: Partial<GuideTask> = {}): GuideTask {
  return {
    id,
    title: id,
    summary: `Resumen de ${id}`,
    keywords: [],
    screen: 'catalog',
    steps: [],
    ...changes,
  };
}
