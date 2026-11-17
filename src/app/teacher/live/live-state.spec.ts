import { testEvents } from '../../data/process-event-testing';
import { exercisePosition, applyLiveUpdate, liveState } from './live-state';
import { GROUP_EXERCISES, NOW, testAttempt, testInteraction, testSnapshot } from './live-testing';

describe('liveState', () => {
  it('gives every student their attempts and the events of those attempts', () => {
    const attempt = testAttempt('a1', 'ana');
    const run = testEvents.run('a1', NOW);
    const state = liveState(
      testSnapshot({ attempts: [attempt], events: [run, testEvents.paste('unknown', NOW)] }),
    );

    expect(state.students.get('ana')).toEqual({
      student: { id: 'ana', name: 'Ana' },
      attempts: [attempt],
      events: [run],
      interactions: [],
    });
    expect(state.students.get('bea')?.attempts).toEqual([]);
    expect([...state.students.keys()]).toEqual(['ana', 'bea', 'cai']);
  });

  it('gives every student the tutor interactions of their attempts', () => {
    const interaction = testInteraction('a1', NOW);
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana')],
        interactions: [interaction, testInteraction('unknown', NOW)],
      }),
    );

    expect(state.students.get('ana')?.interactions).toEqual([interaction]);
    expect(state.students.get('bea')?.interactions).toEqual([]);
  });
});

describe('exercisePosition', () => {
  it('counts the position inside the block of the exercise', () => {
    expect(exercisePosition(GROUP_EXERCISES, 'as2')).toBe(2);
    expect(exercisePosition(GROUP_EXERCISES, 'as3')).toBe(1);
  });

  it('is null for an assignment that is not in the group', () => {
    expect(exercisePosition(GROUP_EXERCISES, 'gone')).toBeNull();
  });
});

describe('applyLiveUpdate', () => {
  const start = liveState(testSnapshot({ attempts: [testAttempt('a1', 'ana')] }));

  it('adds an attempt opened at an assignment of another block of the group', () => {
    const group = liveState(testSnapshot({ exercises: GROUP_EXERCISES }));
    const attempt = testAttempt('a2', 'bea', { assignmentId: 'as3' });

    expect(
      applyLiveUpdate(group, { type: 'attempt', attempt }).students.get('bea')?.attempts,
    ).toEqual([attempt]);
  });

  it('adds an attempt opened at an assignment of the block', () => {
    const attempt = testAttempt('a2', 'bea', { assignmentId: 'as2' });

    const state = applyLiveUpdate(start, { type: 'attempt', attempt });

    expect(state.students.get('bea')?.attempts).toEqual([attempt]);
    expect(state.students.get('ana')).toBe(start.students.get('ana'));
  });

  it('replaces an attempt that changed, without mutating the previous state', () => {
    const changed = testAttempt('a1', 'ana', { status: 'passed' });

    const state = applyLiveUpdate(start, { type: 'attempt', attempt: changed });

    expect(state.students.get('ana')?.attempts).toEqual([changed]);
    expect(start.students.get('ana')?.attempts[0].status).toBe('in_progress');
  });

  it.each([
    ['another group', testAttempt('a3', 'bea', { assignmentId: 'elsewhere' })],
    ['a student of another group', testAttempt('a3', 'zoe')],
    ['no assignment', testAttempt('a3', 'bea', { assignmentId: null })],
  ])('ignores an attempt of %s', (_, attempt) => {
    expect(applyLiveUpdate(start, { type: 'attempt', attempt })).toBe(start);
  });

  it('adds a new event to the student of its attempt', () => {
    const event = testEvents.run('a1', NOW);

    const state = applyLiveUpdate(start, { type: 'event', event });

    expect(state.students.get('ana')?.events).toEqual([event]);
  });

  it('ignores an event of an unknown attempt and an event it already has', () => {
    const event = testEvents.run('a1', NOW);
    const withEvent = applyLiveUpdate(start, { type: 'event', event });

    expect(applyLiveUpdate(start, { type: 'event', event: testEvents.run('x', NOW) })).toBe(start);
    expect(applyLiveUpdate(withEvent, { type: 'event', event })).toBe(withEvent);
  });
});

describe('applyLiveUpdate with tutor interactions', () => {
  const start = liveState(testSnapshot({ attempts: [testAttempt('a1', 'ana')] }));

  it('adds a new interaction to the student of its attempt', () => {
    const interaction = testInteraction('a1', NOW);

    const state = applyLiveUpdate(start, { type: 'interaction', interaction });

    expect(state.students.get('ana')?.interactions).toEqual([interaction]);
    expect(state.students.get('bea')).toBe(start.students.get('bea'));
  });

  it('ignores an interaction of an unknown attempt and one it already has', () => {
    const interaction = testInteraction('a1', NOW);
    const withOne = applyLiveUpdate(start, { type: 'interaction', interaction });

    expect(
      applyLiveUpdate(start, { type: 'interaction', interaction: testInteraction('x', NOW) }),
    ).toBe(start);
    expect(applyLiveUpdate(withOne, { type: 'interaction', interaction })).toBe(withOne);
  });
});
