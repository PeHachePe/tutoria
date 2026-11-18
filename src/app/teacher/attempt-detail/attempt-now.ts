import type { Attempt } from '../../data/attempt';
import type { LiveExercise } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { HintLevel, TutorTrigger } from '../../data/tutor';
import { failingStreaks } from '../../shared/is-stuck';
import { formatCall, formatValue } from '../../shared/format-value';
import type { TestCount } from '../../shared/status-chip/status-chip';
import type { WorkState } from '../live/live-work';
import type { TimelineEntry } from './attempt-timeline';

/** Tests «Ahora» lists; the rest, the timeline tells them. */
export const NOW_TESTS_SHOWN = 4;

/** `now`: the student is in the session with it; `left`: not submitted and not there; `solved`: submitted. */
export type AttemptMode = 'now' | 'left' | 'solved';

export interface NowTest {
  readonly id: string;
  /** `isStrongPassword("abc12345")`. */
  readonly call: string;
  /** What it expects, as `formatValue()` writes it. */
  readonly expected: string;
  readonly hidden: boolean;
  /** `now` and `left`: runs in a row it has failed, the latest included. `solved`: runs it failed in. */
  readonly runs: number;
}

export interface LastHelp {
  /** The entry of the timeline that tells it whole. */
  readonly entryId: string;
  readonly trigger: TutorTrigger;
  readonly level: HintLevel;
  readonly at: number;
  /** What the student asked, for a question. */
  readonly question: string | null;
  /** What the tutor said; null for a hint whose answer was not recorded. */
  readonly text: string | null;
}

/** Where an attempt stands (ficha 07): the tests that fail and the latest help of the tutor. */
export interface AttemptNow {
  readonly mode: AttemptMode;
  /** The latest run, or null before any. */
  readonly lastRun: TestCount | null;
  /** `now` and `left`: failing in the latest run. `solved`: failed in some run. The longest first. */
  readonly tests: readonly NowTest[];
  /** The event of the latest run that failed a test, where the timeline lists them; null without any. */
  readonly failingRunId: string | null;
  readonly help: LastHelp | null;
}

/** `timeline`, as `attemptTimeline()` gives it; `work`, of the row of the student if it is on this attempt. */
export function attemptNow(
  attempt: Pick<Attempt, 'status'>,
  events: readonly ProcessEvent[],
  timeline: readonly TimelineEntry[],
  { exercise, tests }: LiveExercise,
  work: WorkState,
): AttemptNow {
  const mode: AttemptMode =
    attempt.status === 'submitted' ? 'solved' : work === 'absent' ? 'left' : 'now';
  const runs = events
    .flatMap((event) => (event.type === 'run' ? [event] : []))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const last = runs.at(-1);
  const counts = mode === 'solved' ? failedRuns(runs) : failingStreaks(events);
  return {
    mode,
    lastRun: last
      ? { passed: last.detail.passed, total: last.detail.passed + last.detail.failed }
      : null,
    tests: tests
      .flatMap((test): NowTest[] => {
        const count = counts.get(test.id);
        return count === undefined
          ? []
          : [
              {
                id: test.id,
                call: formatCall(exercise.functionName, test.input),
                expected: formatValue(test.expectedOutput),
                hidden: test.isHidden,
                runs: count,
              },
            ];
      })
      // Stable: a tie keeps the order of the exercise
      .sort((a, b) => b.runs - a.runs),
    failingRunId: runs.filter((run) => run.detail.failed > 0).at(-1)?.id ?? null,
    help: lastHelp(timeline),
  };
}

/** Each test that failed in some run, with the runs it failed in. */
function failedRuns(
  runs: readonly Extract<ProcessEvent, { type: 'run' }>[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const run of runs) {
    for (const id of run.detail.failedTestIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The latest the tutor said, asked for or not: an intervention in which it said nothing is not help. */
function lastHelp(timeline: readonly TimelineEntry[]): LastHelp | null {
  for (const entry of timeline) {
    if (entry.kind === 'tutor') {
      const { trigger, hintLevel, studentMessage, transcript } = entry.interaction;
      return {
        entryId: entry.id,
        trigger,
        level: hintLevel,
        at: entry.at,
        question: trigger === 'question' ? studentMessage : null,
        text: transcript,
      };
    }
    if (entry.kind === 'hint') {
      return {
        entryId: entry.id,
        trigger: 'hint',
        level: entry.level,
        at: entry.at,
        question: null,
        text: null,
      };
    }
  }
  return null;
}
