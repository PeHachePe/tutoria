import { testEvents as e } from '../../data/process-event-testing';
import { ago } from '../live/live-testing';
import { attemptRuns } from './attempt-runs';

describe('attemptRuns', () => {
  it('gives the runs, hints and pastes in the order they happened', () => {
    const second = e.run('a1', ago(10), ['e1-t1'], 6);
    const hint = e.hint('a1', ago(15), 2);
    const paste = e.paste('a1', ago(12), 310);
    const first = e.run('a1', ago(20), ['e1-t1', 'e1-t2'], 6);

    expect(attemptRuns([second, hint, paste, first])).toEqual({
      items: [
        { kind: 'run', id: first.id, at: ago(20), passed: 4, total: 6 },
        { kind: 'hint', id: hint.id, at: ago(15), level: 2 },
        { kind: 'paste', id: paste.id, at: ago(12), length: 310 },
        { kind: 'run', id: second.id, at: ago(10), passed: 5, total: 6 },
      ],
      runs: 2,
      hints: 1,
      pastes: 1,
    });
  });

  it('keeps the order of what happened at the same time', () => {
    const run = e.run('a1', ago(10));
    const hint = e.hint('a1', ago(10));

    expect(attemptRuns([run, hint]).items.map((item) => item.kind)).toEqual(['run', 'hint']);
  });

  it('is empty without runs, even with hints and pastes', () => {
    expect(attemptRuns([e.hint('a1', ago(10)), e.paste('a1', ago(5))])).toEqual({
      items: [],
      runs: 0,
      hints: 0,
      pastes: 0,
    });
  });

  it('leaves out the rest of the events', () => {
    const events = [
      e.run('a1', ago(20)),
      e.proactive('a1', ago(18)),
      e.focusLost('a1', ago(16)),
      e.focusGained('a1', ago(15)),
      e.submit('a1', ago(10)),
    ];

    expect(attemptRuns(events).items.map((item) => item.kind)).toEqual(['run']);
  });
});
