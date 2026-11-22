import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Attempt, StoredAttemptStatus } from '../../data/attempt';
import type { RunResult } from '../../data/code-runner/run-result';
import type { NewProcessEvent, ProcessEvent } from '../../data/process-event';
import { testEvents } from '../../data/process-event-testing';
import type { ProactiveReason } from '../../data/tutor';
import { SettingsStore } from '../settings/settings-store';
import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import {
  DEFAULT_PROACTIVE_TIMING,
  PROACTIVE_TIMING,
  type ProactiveTiming,
} from '../../core/proactive-timing';
import { ProactivityMonitor } from './proactivity-monitor';
import { TutorSpeaker } from './tutor-speaker';
import { type TutorTurn, TutorStore } from './tutor-store';
import { type CallState, VoiceCall } from './voice-call';

const START = Date.parse('2026-11-22T10:00:00.000Z');
const MINUTE = 60_000;
const EXERCISE = { id: 'exercise-1', maxRepeatedFailures: 3, maxIdleMinutes: 4 };
const PROACTIVE_CHECK_MS = DEFAULT_PROACTIVE_TIMING.checkMs;
const WRITING_PAUSE_MS = DEFAULT_PROACTIVE_TIMING.writingPauseMs;

function attemptOf(id: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id,
    exerciseId: EXERCISE.id,
    userId: 'student-1',
    assignmentId: 'assignment-1',
    number: 1,
    currentCode: 'function sum(v) {}',
    finalCode: null,
    status,
    startedAt: new Date(START).toISOString(),
    finishedAt: null,
    updatedAt: new Date(START).toISOString(),
  };
}

/** A run of five tests in which `failing` fail. */
function runOf(failing: readonly string[]): RunResult {
  const ids = ['t1', 't2', 't3', 't4', 't5'];
  return {
    status: failing.length > 0 ? 'tests_failed' : 'passed',
    results: ids.map((testId) => ({ testId, passed: !failing.includes(testId), timeout: false })),
  };
}

/** A client event as BrowserSignals keeps it: not stored yet, so without an id. */
function focusEvent(type: 'focus_lost' | 'focus_gained', minute: number): NewProcessEvent {
  const timestamp = new Date(START + minute * MINUTE).toISOString();
  return type === 'focus_lost'
    ? { attemptId: 'a1', type, timestamp, detail: null }
    : { attemptId: 'a1', type, timestamp, detail: { awayMs: MINUTE } };
}

/** A past question of the student, at `minute`. */
function questionAt(minute: number): TutorTurn {
  return {
    id: `q-${minute}`,
    trigger: 'question',
    studentMessage: '¿Y esto?',
    answer: 'Mira el bucle.',
    hintLevel: 1,
    emotion: 'joy',
    intensity: 1,
    reaction: null,
    elusion: false,
    createdAt: new Date(START + minute * MINUTE).toISOString(),
    status: 'done',
    fresh: false,
    actions: [],
    queried: [],
  };
}

describe('ProactivityMonitor', () => {
  let attempt: ReturnType<typeof signal<Attempt | undefined>>;
  let lastRun: ReturnType<typeof signal<RunResult | undefined>>;
  let running: ReturnType<typeof signal<boolean>>;
  let submitting: ReturnType<typeof signal<boolean>>;
  let editable: ReturnType<typeof signal<boolean>>;
  let openedAt: ReturnType<typeof signal<number>>;
  let lastEditAt: ReturnType<typeof signal<number>>;
  let runOutdated: ReturnType<typeof signal<boolean>>;
  let proactive: ReturnType<typeof signal<boolean>>;
  let loadedEvents: ReturnType<typeof signal<readonly ProcessEvent[]>>;
  let turns: ReturnType<typeof signal<readonly TutorTurn[]>>;
  let canAsk: ReturnType<typeof signal<boolean>>;
  let intervening: ReturnType<typeof signal<boolean>>;
  let drafting: ReturnType<typeof signal<boolean>>;
  let intervene: ReturnType<typeof vi.fn<TutorStore['intervene']>>;
  let browserEvents: NewProcessEvent[];
  let saying: ReturnType<typeof signal<string | null>>;
  let callState: ReturnType<typeof signal<CallState | null>>;
  let onLine: ReturnType<typeof vi.spyOn>;

  function setUp({
    call = true,
    timing = signal(DEFAULT_PROACTIVE_TIMING),
  }: { call?: boolean; timing?: WritableSignal<ProactiveTiming> } = {}): ProactivityMonitor {
    TestBed.configureTestingModule({
      providers: [
        ProactivityMonitor,
        {
          provide: AttemptStore,
          useValue: {
            attempt,
            lastRun,
            running,
            submitting,
            editable,
            openedAt,
            lastEditAt,
            runOutdated,
          },
        },
        { provide: SettingsStore, useValue: { proactive } },
        {
          provide: TutorStore,
          useValue: { loadedEvents, turns, canAsk, intervening, drafting, intervene },
        },
        {
          provide: BrowserSignals,
          useValue: {
            events: (attemptId: string) => browserEvents.filter((e) => e.attemptId === attemptId),
          },
        },
        { provide: TutorSpeaker, useValue: { saying } },
        call ? [{ provide: VoiceCall, useValue: { state: callState } }] : [],
        { provide: PROACTIVE_TIMING, useValue: timing },
      ],
    });
    const monitor = TestBed.inject(ProactivityMonitor);
    monitor.watch(EXERCISE);
    TestBed.tick();
    return monitor;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    attempt = signal<Attempt | undefined>(attemptOf('a1'));
    lastRun = signal<RunResult | undefined>(undefined);
    running = signal(false);
    submitting = signal(false);
    editable = signal(true);
    openedAt = signal(START);
    lastEditAt = signal(0);
    runOutdated = signal(false);
    proactive = signal(true);
    loadedEvents = signal<readonly ProcessEvent[]>([]);
    turns = signal<readonly TutorTurn[]>([]);
    canAsk = signal(true);
    intervening = signal(false);
    drafting = signal(false);
    intervene = vi.fn<TutorStore['intervene']>(() => Promise.resolve(true));
    browserEvents = [];
    saying = signal<string | null>(null);
    callState = signal<CallState | null>(null);
    onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    onLine.mockRestore();
    vi.useRealTimers();
  });

  /** The student runs the tests a minute after the last thing that happened. */
  async function runTests(...failing: string[]): Promise<void> {
    vi.setSystemTime(Date.now() + MINUTE);
    lastRun.set(runOf(failing));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }

  /** Time goes by, with the checks of the timer. */
  async function wait(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  const reasons = () => intervene.mock.calls.map(([reason]) => reason);

  describe('after a run', () => {
    it('steps in when the same test fails three runs in a row', async () => {
      setUp();

      await runTests('t1');
      await runTests('t1');
      expect(intervene).not.toHaveBeenCalled();
      await runTests('t1');

      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);
    });

    it('celebrates a test that resisted, without waiting for the cooldown', async () => {
      setUp();

      await runTests('t1');
      await runTests('t1');
      await runTests('t1');
      await runTests();

      expect(reasons()).toEqual<ProactiveReason[]>(['failures', 'achievement']);
    });

    it('celebrates first, when another test reaches its failures in the same run', async () => {
      setUp();
      // A question at half a minute: the help waits until the fourth run
      turns.set([questionAt(0.5)]);

      await runTests('t1');
      await runTests('t1', 't2');
      await runTests('t1', 't2');
      expect(intervene).not.toHaveBeenCalled();
      await runTests('t2');

      expect(reasons()).toEqual<ProactiveReason[]>(['achievement']);
    });

    it('counts the runs loaded with the conversation', async () => {
      loadedEvents.set([
        testEvents.run('a1', START - 2 * MINUTE, ['t1']),
        testEvents.run('a1', START - MINUTE, ['t1']),
      ]);
      setUp();

      await runTests('t1');

      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);
    });

    it('loses an achievement that cannot come out at once', async () => {
      setUp();
      await runTests('t1');
      await runTests('t1');
      // Asked a minute ago: the help waits, the achievement does not
      turns.set([questionAt(1.5)]);
      await runTests('t1');
      canAsk.set(false);
      await runTests();
      expect(intervene).not.toHaveBeenCalled();

      canAsk.set(true);
      await wait(4 * MINUTE);

      expect(reasons()).not.toContain('achievement');
    });
  });

  describe('on the timer', () => {
    it('steps in once a pause reaches the idle threshold, and once for each pause', async () => {
      setUp();

      await wait(4 * MINUTE - PROACTIVE_CHECK_MS);
      expect(intervene).not.toHaveBeenCalled();
      await wait(PROACTIVE_CHECK_MS);
      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);

      await wait(10 * MINUTE);
      expect(intervene).toHaveBeenCalledTimes(1);
    });

    it('takes up the help that waited for the cooldown', async () => {
      setUp();
      await runTests('t1');
      await runTests('t1');
      turns.set([questionAt(1.5)]);
      await runTests('t1');
      expect(intervene).not.toHaveBeenCalled();

      await wait(2 * MINUTE);

      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);
    });

    it('records the intervention it asked for, so it does not ask again in 15 seconds', async () => {
      setUp();
      intervene.mockResolvedValue(false);
      await runTests('t1');
      await runTests('t1');
      await runTests('t1');

      await wait(2 * MINUTE);

      // The tutor kept quiet, or the request failed (a 429 too): the cooldown counts from it
      expect(intervene).toHaveBeenCalledTimes(1);
    });

    it('stops when the screen goes away', async () => {
      setUp();

      TestBed.resetTestingModule();
      await wait(10 * MINUTE);

      expect(intervene).not.toHaveBeenCalled();
    });
  });

  describe('keeps quiet on the client (2.7)', () => {
    const cases: [string, () => void][] = [
      ['with the setting off', () => proactive.set(false)],
      ['when the student cannot ask', () => canAsk.set(false)],
      ['with another intervention on its way', () => intervening.set(true)],
      ['with a question half written', () => drafting.set(true)],
      ['while the tests run', () => running.set(true)],
      ['while it is submitted', () => submitting.set(true)],
      ['when the attempt is not open for changes', () => editable.set(false)],
      ['without a connection', () => onLine.mockReturnValue(false)],
      ['while the tutor speaks', () => saying.set('¿Sigues ahí?')],
      ['while the student speaks in a call', () => callState.set('hearing')],
      ['with the student out of the tab', () => browserEvents.push(focusEvent('focus_lost', 1))],
    ];

    it.each(cases)('%s', async (_, quiet) => {
      setUp();
      quiet();

      await wait(5 * MINUTE);
      expect(intervene).not.toHaveBeenCalled();
    });

    it('steps in once the setting is on again, at the next check', async () => {
      setUp();
      proactive.set(false);
      await wait(5 * MINUTE);

      proactive.set(true);
      await wait(PROACTIVE_CHECK_MS);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('stops at once when the setting is turned off', async () => {
      setUp();
      await runTests('t1');
      await runTests('t1');

      proactive.set(false);
      await runTests('t1');
      await wait(10 * MINUTE);

      expect(intervene).not.toHaveBeenCalled();
    });

    it('steps in with the student back in the tab', async () => {
      browserEvents.push(focusEvent('focus_lost', 1), focusEvent('focus_gained', 2));
      setUp();

      await wait(6 * MINUTE);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('without the call, as in a browser without voice', async () => {
      setUp({ call: false });

      await wait(4 * MINUTE);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('without the thresholds of the exercise of the attempt', async () => {
      setUp().watch({ ...EXERCISE, id: 'another-exercise' });

      await wait(5 * MINUTE);

      expect(intervene).not.toHaveBeenCalled();
    });

    it('before the exercise has loaded', async () => {
      setUp();
      attempt.set(undefined);

      await wait(5 * MINUTE);

      expect(intervene).not.toHaveBeenCalled();
    });
  });

  it('does not carry the events of one attempt into another', async () => {
    setUp();
    await runTests('t1');
    await runTests('t1');

    attempt.set({ ...attemptOf('a2'), updatedAt: new Date(Date.now()).toISOString() });
    loadedEvents.set([]);
    TestBed.tick();
    await runTests('t1');

    expect(intervene).not.toHaveBeenCalled();
  });

  it('does not count in another attempt an intervention that ended there', async () => {
    let speak!: (spoke: boolean) => void;
    intervene.mockImplementationOnce(() => new Promise((resolve) => (speak = resolve)));
    setUp();
    await wait(4 * MINUTE);
    expect(reasons()).toEqual<ProactiveReason[]>(['idle']);

    // The other attempt had failed twice: one run more and it gets help, no cooldown in between
    attempt.set({ ...attemptOf('a2'), updatedAt: new Date(Date.now()).toISOString() });
    loadedEvents.set([
      testEvents.run('a2', Date.now() - 2 * MINUTE, ['t1']),
      testEvents.run('a2', Date.now() - MINUTE, ['t1']),
    ]);
    TestBed.tick();
    speak(true);
    await wait(0);
    await runTests('t1');

    expect(reasons()).toEqual<ProactiveReason[]>(['idle', 'failures']);
  });

  describe('a visit that starts on an attempt of another day', () => {
    const yesterday = START - 24 * 60 * MINUTE;

    beforeEach(() => {
      attempt.set({ ...attemptOf('a1'), updatedAt: new Date(yesterday).toISOString() });
    });

    it('counts the pause from when the student opened the exercise', async () => {
      setUp();

      await wait(4 * MINUTE - PROACTIVE_CHECK_MS);
      expect(intervene).not.toHaveBeenCalled();
      await wait(PROACTIVE_CHECK_MS);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('does not take the student for away because of an absence of another visit', async () => {
      // Closing the tab records leaving, and never coming back
      loadedEvents.set([testEvents.focusLost('a1', yesterday)]);
      setUp();

      await wait(4 * MINUTE);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('does not bring up on the timer the failures of another visit', async () => {
      loadedEvents.set([1, 2, 3].map((m) => testEvents.run('a1', yesterday + m * MINUTE, ['t1'])));
      setUp();

      await wait(4 * MINUTE);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });
  });

  describe('never while the student writes code (2.7)', () => {
    it('counts typing as activity, before it is even saved', async () => {
      setUp();
      lastEditAt.set(START + 3 * MINUTE);

      await wait(7 * MINUTE - PROACTIVE_CHECK_MS);
      expect(intervene).not.toHaveBeenCalled();
      await wait(PROACTIVE_CHECK_MS);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('brings the help that waited once the code is still for a while', async () => {
      setUp();
      await runTests('t1');
      await runTests('t1');
      turns.set([questionAt(1.5)]);
      await runTests('t1');

      // The student keeps writing past the cooldown
      for (let second = 0; second < 150; second += 5) {
        lastEditAt.set(Date.now());
        await wait(5000);
      }
      expect(intervene).not.toHaveBeenCalled();
      await wait(WRITING_PAUSE_MS);

      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);
    });

    it('says nothing after a run if the code changed while it ran', async () => {
      setUp();
      await runTests('t1');
      await runTests('t1');

      runOutdated.set(true);
      await runTests('t1');

      expect(intervene).not.toHaveBeenCalled();
    });
  });

  describe('when the first words arrive (2.7)', () => {
    /** Asks for an idle intervention and gives what decides whether it is still wanted. */
    async function asked(): Promise<() => boolean> {
      setUp();
      await wait(4 * MINUTE);
      const [, stillWanted] = intervene.mock.calls[0];
      return stillWanted as () => boolean;
    }

    it('still wants it when nothing changed', async () => {
      expect((await asked())()).toBe(true);
    });

    const cases: [string, () => void][] = [
      ['with the setting turned off', () => proactive.set(false)],
      ['with a question started', () => drafting.set(true)],
      ['with the tutor speaking', () => saying.set('Hola')],
      ['with the tests running', () => running.set(true)],
      ['with the student gone', () => browserEvents.push(focusEvent('focus_lost', 4))],
      ['with the code changed', () => lastEditAt.set(Date.now() + 1)],
    ];

    it.each(cases)('drops it %s', async (_, change) => {
      const stillWanted = await asked();

      change();

      expect(stillWanted()).toBe(false);
    });
  });

  describe('with the short times of the dev toolbar', () => {
    const fast: ProactiveTiming = {
      checkMs: 5000,
      writingPauseMs: 5000,
      idleMinutes: 0.5,
      limits: { ...DEFAULT_PROACTIVE_TIMING.limits, cooldownMs: 20_000 },
    };

    it('asks about a pause of 30 s, checking every 5 s', async () => {
      setUp({ timing: signal(fast) });

      await wait(25_000);
      expect(intervene).not.toHaveBeenCalled();
      await wait(5000);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });

    it('asks about the pause 20 s after helping with the failures', async () => {
      setUp({ timing: signal(fast) });
      await runTests('t1');
      await runTests('t1');
      await runTests('t1');
      // The runs are a minute apart: the pause counts from the last one, and the cooldown from the help
      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);

      await wait(30_000);

      expect(reasons()).toEqual<ProactiveReason[]>(['failures', 'idle']);
    });

    it('takes up a help that waited once the code is still for 5 s', async () => {
      setUp({ timing: signal(fast) });
      await runTests('t1');
      await runTests('t1');
      // A question a moment ago: the help waits 20 s
      turns.set([questionAt(2.9)]);
      await runTests('t1');
      await wait(10_000);

      lastEditAt.set(Date.now());
      await wait(5000);

      expect(reasons()).toEqual<ProactiveReason[]>(['failures']);
    });

    it('takes the new times at the next check', async () => {
      const timing = signal(DEFAULT_PROACTIVE_TIMING);
      setUp({ timing });

      timing.set(fast);
      await wait(PROACTIVE_CHECK_MS + 30_000);

      expect(reasons()).toEqual<ProactiveReason[]>(['idle']);
    });
  });
});
