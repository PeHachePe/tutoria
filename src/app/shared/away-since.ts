import type { ProcessEvent } from '../data/process-event';

/**
 * When the student left the window and has not come back yet, in milliseconds, or null if they are
 * there (2.8). A student away is not stuck: there is nobody in front of the screen (D-054). The
 * browser only records absences of 2 s or more, so a quick look elsewhere never counts. Any event
 * after leaving is a return too: a tab closed and opened again later records none (4.1).
 */
export function awaySince(events: readonly ProcessEvent[]): number | null {
  const last = events
    .map((event) => ({ type: event.type, at: Date.parse(event.timestamp) }))
    .sort((a, b) => a.at - b.at)
    .at(-1);
  return last?.type === 'focus_lost' ? last.at : null;
}
