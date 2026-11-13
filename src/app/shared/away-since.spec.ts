import { testEvents } from '../data/process-event-testing';
import { awaySince } from './away-since';

const T = Date.parse('2026-11-13T10:00:00.000Z');
const MINUTE = 60_000;

describe('awaySince', () => {
  it('is null without focus events', () => {
    expect(awaySince([testEvents.run('a', T)])).toBeNull();
  });

  it('is the time the student left when they have not come back', () => {
    const events = [testEvents.run('a', T), testEvents.focusLost('a', T + MINUTE)];

    expect(awaySince(events)).toBe(T + MINUTE);
  });

  it('is null once the student came back', () => {
    const events = [testEvents.focusLost('a', T), testEvents.focusGained('a', T + MINUTE)];

    expect(awaySince(events)).toBeNull();
  });

  it('is null once the student did something after leaving, without the event of coming back', () => {
    // A tab closed and opened again later records no return
    const events = [testEvents.focusLost('a', T), testEvents.hint('a', T + 90 * MINUTE)];

    expect(awaySince(events)).toBeNull();
  });

  it('sorts the events by time before reading them', () => {
    const events = [testEvents.focusLost('a', T + 2 * MINUTE), testEvents.focusGained('a', T)];

    expect(awaySince(events)).toBe(T + 2 * MINUTE);
  });
});
