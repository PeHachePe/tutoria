import { testEvents } from '../data/process-event-testing';
import { lastBreakthrough } from './last-breakthrough';

const T = Date.parse('2026-11-13T10:00:00.000Z');
const MINUTE = 60_000;
const run = (minute: number, failing: string[]) =>
  testEvents.run('a', T + minute * MINUTE, failing);

describe('lastBreakthrough', () => {
  it('is null without runs', () => {
    expect(lastBreakthrough([], 3)).toBeNull();
  });

  it('is the run that passed a test after it failed as many runs in a row as the threshold', () => {
    const events = [run(1, ['t1']), run(2, ['t1', 't2']), run(3, ['t1']), run(4, ['t2'])];

    expect(lastBreakthrough(events, 3)).toEqual({ at: T + 4 * MINUTE, failures: 3 });
  });

  it('is null when the test passes below the threshold', () => {
    const events = [run(1, ['t1']), run(2, ['t1']), run(3, [])];

    expect(lastBreakthrough(events, 3)).toBeNull();
  });

  it('is null while the test keeps failing', () => {
    const events = [run(1, ['t1']), run(2, ['t1']), run(3, ['t1'])];

    expect(lastBreakthrough(events, 3)).toBeNull();
  });

  it('keeps the latest of several breakthroughs, with its own failures', () => {
    const events = [
      run(1, ['t1']),
      run(2, ['t1']),
      run(3, ['t1']),
      run(4, ['t2']),
      run(5, ['t2']),
      run(6, ['t2']),
      run(7, ['t2']),
      run(8, []),
    ];

    expect(lastBreakthrough(events, 3)).toEqual({ at: T + 8 * MINUTE, failures: 4 });
  });

  it('sorts the runs by time and ignores other events', () => {
    const events = [run(3, []), testEvents.paste('a', T), run(2, ['t1']), run(1, ['t1'])];

    expect(lastBreakthrough(events, 2)).toEqual({ at: T + 3 * MINUTE, failures: 2 });
  });
});
