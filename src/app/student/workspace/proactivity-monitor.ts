import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  Service,
  signal,
  untracked,
} from '@angular/core';

import { runEventDetail } from '../../data/code-runner/run-result';
import type { Exercise } from '../../data/exercise';
import type { ProcessEvent } from '../../data/process-event';
import { awaySince } from '../../shared/away-since';
import { type AttemptEvent, proactiveReasons } from '../../shared/proactive-reason';
import { SettingsStore } from '../settings/settings-store';
import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import { TutorSpeaker } from './tutor-speaker';
import { TutorStore } from './tutor-store';
import { VoiceCall } from './voice-call';

/** How often the tutor looks whether the student stopped, or whether a help that waited can come (2.7). */
export const PROACTIVE_CHECK_MS = 15_000;

/** What the monitor needs of the exercise open: its thresholds (2.7). */
export type WatchedExercise = Pick<Exercise, 'id' | 'maxRepeatedFailures' | 'maxIdleMinutes'>;

/**
 * The proactive tutor (2.7, 6.2): right after each run and every 15 seconds it works out with
 * `proactiveReasons()` whether the tutor steps in and why, and asks `TutorStore` for it. Before
 * that, it keeps quiet without asking the server when the student turned it off, is out of the tab
 * or offline, or is busy: the tutor answering or speaking, the tests running, a submission, a
 * question half written or the student speaking in a call. What waits is looked at again in the
 * next check; an achievement does not wait, as late congratulations make no sense.
 *
 * It reads the events loaded with the conversation and those of this visit: the runs, the absences
 * and pastes of `BrowserSignals` and its own requests, which count even if the tutor kept quiet or
 * the request failed, so the cooldown and the episode hold and it does not ask every 15 seconds.
 * Screen scoped (the workspace route); not in the teacher's preview (D-061).
 */
@Service({ autoProvided: false })
export class ProactivityMonitor {
  private readonly settings = inject(SettingsStore);
  private readonly attempts = inject(AttemptStore);
  private readonly tutor = inject(TutorStore);
  private readonly signals = inject(BrowserSignals);
  private readonly speaker = inject(TutorSpeaker);
  /** Only where the browser can hold a call (6.1c). */
  private readonly call = inject(VoiceCall, { optional: true });

  private readonly exercise = signal<WatchedExercise | undefined>(undefined);

  /**
   * The runs and the interventions of this visit. They start again with each load of the
   * conversation, which brings them: another attempt, or the same loaded again.
   */
  private readonly visitEvents = linkedSignal<readonly ProcessEvent[], readonly AttemptEvent[]>({
    source: this.tutor.loadedEvents,
    computation: () => [],
  });

  /** The last turn the student asked for, a question or a hint: it counts as activity (D-068). */
  private readonly lastTurnAt = computed(() => {
    const asked = this.tutor
      .turns()
      .filter((turn) => turn.trigger !== 'proactive')
      .map((turn) => Date.parse(turn.createdAt));
    return asked.length > 0 ? Math.max(...asked) : null;
  });

  constructor() {
    const timer = setInterval(() => void this.check('timer'), PROACTIVE_CHECK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Boundary with the timer and the request (4.8): a run is the answer of an imperative call, and
    // the check right after it may send another. Only the run is followed: the rest is read as it is
    effect(() => {
      const run = this.attempts.lastRun();
      if (!run) return;
      untracked(() => {
        this.record({
          type: 'run',
          timestamp: new Date().toISOString(),
          detail: runEventDetail(run),
        });
        void this.check('run');
      });
    });
  }

  /** The exercise open, whose thresholds it uses: the page passes it on once it has loaded. */
  watch(exercise: WatchedExercise): void {
    this.exercise.set(exercise);
  }

  /**
   * Right after a run it takes the first reason; on the timer, the first that is not an
   * achievement, which would come late there and must not hide the others.
   */
  private async check(after: 'run' | 'timer'): Promise<void> {
    const attempt = this.attempts.attempt();
    const exercise = this.exercise();
    if (!attempt || exercise?.id !== attempt.exerciseId) return;
    const events: AttemptEvent[] = [
      ...this.tutor.loadedEvents(),
      ...this.signals.events(attempt.id),
      ...this.visitEvents(),
    ];
    if (this.quiet(events)) return;
    const now = Date.now();
    const reasons = proactiveReasons({
      status: attempt.status,
      updatedAt: attempt.updatedAt,
      events,
      lastTurnAt: this.lastTurnAt(),
      thresholds: exercise,
      now,
    });
    const reason = after === 'run' ? reasons[0] : reasons.find((r) => r !== 'achievement');
    if (!reason) return;
    const spoke = await this.tutor.intervene(reason);
    // Another exercise opened meanwhile has events of its own
    if (this.attempts.attempt()?.id !== attempt.id) return;
    this.record({
      type: 'proactive_intervention',
      timestamp: new Date(now).toISOString(),
      detail: { silent: !spoke, reason },
    });
  }

  /** The silences of the client (2.7): it does not even ask the server. */
  private quiet(events: readonly AttemptEvent[]): boolean {
    return (
      !this.settings.proactive() ||
      !this.tutor.canAsk() ||
      this.tutor.intervening() ||
      this.tutor.drafting() ||
      this.speaker.saying() !== null ||
      this.call?.state() === 'hearing' ||
      this.attempts.running() ||
      this.attempts.submitting() ||
      !this.attempts.editable() ||
      navigator.onLine === false ||
      awaySince(events) !== null
    );
  }

  private record(event: AttemptEvent): void {
    this.visitEvents.update((events) => [...events, event]);
  }
}
