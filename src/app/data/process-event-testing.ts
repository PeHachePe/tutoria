import type { ProcessEvent } from './process-event';

/** Test helpers: process events of one attempt, at a time given in milliseconds. */

let nextId = 0;

function base(attemptId: string, at: number) {
  return { id: `event-${++nextId}`, attemptId, timestamp: new Date(at).toISOString() };
}

export const testEvents = {
  run: (attemptId: string, at: number, failedTestIds: readonly string[] = [], total = 5) =>
    ({
      ...base(attemptId, at),
      type: 'run',
      detail: { passed: total - failedTestIds.length, failed: failedTestIds.length, failedTestIds },
    }) satisfies ProcessEvent,
  submit: (attemptId: string, at: number) =>
    ({ ...base(attemptId, at), type: 'submit', detail: null }) satisfies ProcessEvent,
  hint: (attemptId: string, at: number, level: 1 | 2 | 3 = 1) =>
    ({ ...base(attemptId, at), type: 'hint_requested', detail: { level } }) satisfies ProcessEvent,
  proactive: (attemptId: string, at: number) =>
    ({
      ...base(attemptId, at),
      type: 'proactive_intervention',
      detail: { silent: false },
    }) satisfies ProcessEvent,
  paste: (attemptId: string, at: number, length = 40) =>
    ({ ...base(attemptId, at), type: 'paste', detail: { length } }) satisfies ProcessEvent,
  focusLost: (attemptId: string, at: number) =>
    ({ ...base(attemptId, at), type: 'focus_lost', detail: null }) satisfies ProcessEvent,
  focusGained: (attemptId: string, at: number, awayMs = 60_000) =>
    ({ ...base(attemptId, at), type: 'focus_gained', detail: { awayMs } }) satisfies ProcessEvent,
};
