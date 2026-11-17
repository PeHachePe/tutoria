import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';

import { DAW_EXAM_BLOCK, DAW_HIDDEN_BLOCK, DAW_RESIT_BLOCK } from '../data/mock/fixtures/exercises';
import { fixtureId } from '../data/mock/fixtures/fixture-id';
import { DAW_GROUP_ID, DAW_STUDENT_IDS, TEACHER_ID } from '../data/mock/fixtures/users';
import { MockDb } from '../data/mock/mock-db';
import { TEACHER_PARAMS } from '../core/app-paths';
import { testEvents } from '../data/process-event-testing';
import { CHAT_STUCK_MESSAGES } from '../teacher/live/live-attention';
import { ClassSimulator, SIMULATION_TICK_MS, type SimulationTarget } from './class-simulator';

describe('ClassSimulator', () => {
  let db: MockDb;
  let simulator: ClassSimulator;
  let target: SimulationTarget;

  beforeEach(() => {
    localStorage.clear();
    db = TestBed.inject(MockDb);
    db.setSession(TEACHER_ID);
    // A class that has not started: every action can be told apart
    db.update('attempts', () => []);
    db.update('events', () => []);
    db.update('interactions', () => []);
    simulator = TestBed.inject(ClassSimulator);
    target = simulator.targetFor(convertToParamMap({})) as SimulationTarget;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** Every random choice returns `value`: the same student and the same action each time. */
  function roll(value: number): void {
    vi.spyOn(Math, 'random').mockReturnValue(value);
  }

  function attempts() {
    return db.tables().attempts;
  }

  function eventTypes(): string[] {
    return db.tables().events.map((event) => event.type);
  }

  describe('targetFor', () => {
    const daw = (params: Record<string, string> = {}) =>
      convertToParamMap({ [TEACHER_PARAMS.group]: DAW_GROUP_ID, ...params });
    /** The blocks of 1.º DAW A the students see, in order. */
    const visible = () =>
      db
        .tables()
        .classBlocks.filter(
          (block) =>
            block.groupId === DAW_GROUP_ID &&
            !block.isHidden &&
            (block.opensAt === null || Date.parse(block.opensAt) <= Date.now()),
        )
        .sort((a, b) => a.position - b.position)
        .map((block) => block.id);

    it('picks one block: the one of the URL, or the latest one', () => {
      const first = visible()[0];

      expect(target.label).toMatch(/^1\.º DAW A · /);
      expect(simulator.targetFor(daw({ [TEACHER_PARAMS.block]: first }))?.blockIds).toEqual([
        first,
      ]);
      // The seed has no attempts left: the latest block is the first one
      expect(simulator.targetFor(daw({ [TEACHER_PARAMS.block]: 'x' }))?.blockIds).toEqual([first]);
    });

    it('picks the latest block of the group when the URL names none', () => {
      db.reset();
      db.setSession(TEACHER_ID);

      expect(simulator.targetFor(daw())?.blockIds).toEqual([fixtureId('block', DAW_RESIT_BLOCK)]);
    });

    it('picks two blocks in a row, back to the first after the last', () => {
      const blocks = visible();

      const two = simulator.targetFor(daw({ [TEACHER_PARAMS.block]: blocks[0] }), 'two_blocks');
      const last = simulator.targetFor(
        daw({ [TEACHER_PARAMS.block]: blocks.at(-1) as string }),
        'two_blocks',
      );

      expect(two).toMatchObject({ blockIds: blocks.slice(0, 2), label: '1.º DAW A · 2 bloques' });
      expect(last?.blockIds).toEqual([blocks.at(-1), blocks[0]]);
    });

    it('scatters the class over every block the students see', () => {
      const scattered = simulator.targetFor(daw(), 'scattered');

      expect(scattered?.blockIds).toEqual(visible());
      expect(scattered?.blockIds).not.toContain(fixtureId('block', DAW_HIDDEN_BLOCK));
      expect(scattered?.blockIds).not.toContain(fixtureId('block', DAW_EXAM_BLOCK));
    });

    it('picks a single block for two when there is no other', () => {
      const [only] = visible();
      db.update('classBlocks', (blocks) =>
        blocks.map((block) => (block.id === only ? block : { ...block, isHidden: true })),
      );

      expect(simulator.targetFor(daw(), 'two_blocks')?.blockIds).toEqual([only]);
    });

    it('has nothing to simulate without blocks the students see with exercises', () => {
      db.update('assignments', () => []);

      expect(simulator.targetFor(daw())).toBeNull();
    });

    it('has no block without a session or for whoever manages no group', () => {
      db.setSession(DAW_STUDENT_IDS[0]);
      expect(simulator.targetFor(convertToParamMap({}))).toBeNull();

      db.setSession(null);
      expect(simulator.targetFor(convertToParamMap({}))).toBeNull();
    });
  });

  it('splits the students between the blocks, in the order of the group', () => {
    const two = simulator.targetFor(
      convertToParamMap({ [TEACHER_PARAMS.group]: target.groupId }),
      'two_blocks',
    ) as SimulationTarget;
    const blockOf = () => {
      const assignmentId = attempts().at(-1)?.assignmentId;
      return db.tables().assignments.find((assignment) => assignment.id === assignmentId)?.blockId;
    };

    roll(0);
    simulator.step(two);
    expect(blockOf()).toBe(two.blockIds[0]);

    roll(0.99);
    simulator.step(two);
    expect(blockOf()).toBe(two.blockIds[1]);
  });

  it('acts on every tick while it runs, and stops', () => {
    vi.useFakeTimers();
    try {
      roll(0.1);
      simulator.start(target);
      expect(simulator.running()).toBe(true);
      expect(simulator.target()).toBe(target);
      expect(attempts()).toHaveLength(1);

      vi.advanceTimersByTime(SIMULATION_TICK_MS);
      expect(eventTypes()).toEqual(['run']);

      simulator.stop();
      vi.advanceTimersByTime(SIMULATION_TICK_MS);
      expect(eventTypes()).toEqual(['run']);
      expect(simulator.running()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens an exercise first, then runs the tests failing some', () => {
    roll(0.1);
    simulator.step(target);
    expect(attempts()[0]).toMatchObject({ status: 'in_progress', number: 1 });

    simulator.step(target);
    expect(eventTypes()).toEqual(['run']);
    expect(attempts()[0].status).toBe('tests_failed');
  });

  it('submits a passed attempt', () => {
    roll(0.4);
    simulator.step(target);
    simulator.step(target);
    expect(attempts()[0].status).toBe('passed');

    simulator.step(target);
    expect(eventTypes()).toEqual(['run', 'submit']);
    expect(attempts()[0].status).toBe('submitted');
    expect(attempts()[0].finishedAt).not.toBeNull();
  });

  it('asks for hints of growing level up to the last one, each with the answer of the tutor', () => {
    roll(0.6);
    for (let step = 0; step < 5; step++) {
      simulator.step(target);
    }

    expect(
      db.tables().events.map((event) => (event.type === 'hint_requested' ? event.detail.level : 0)),
    ).toEqual([1, 2, 3, 3]);
    expect(db.tables().interactions.map(({ trigger, hintLevel }) => [trigger, hintLevel])).toEqual([
      ['hint', 1],
      ['hint', 2],
      ['hint', 3],
      ['hint', 3],
    ]);
  });

  it('asks the tutor a question, answered at the level reached and without an event', () => {
    roll(0.67);
    simulator.step(target);
    simulator.step(target);

    expect(eventTypes()).toEqual([]);
    expect(db.tables().interactions.at(-1)).toMatchObject({
      trigger: 'question',
      hintLevel: 1,
      studentMessage: expect.any(String),
    });
  });

  it('writes one more line of code before each run, up to the whole function', () => {
    roll(0.1);
    simulator.step(target);
    simulator.step(target);
    expect(attempts()[0].currentCode).toBe('function solve(items) {');

    for (let step = 0; step < 10; step++) {
      simulator.step(target);
    }
    expect(attempts()[0].currentCode.split('\n')).toHaveLength(7);
  });

  it('tells the tutor now and then that they cannot go on', () => {
    roll(0.71);
    simulator.step(target);
    simulator.step(target);

    expect(eventTypes()).toEqual([]);
    expect(db.tables().interactions.at(-1)).toMatchObject({
      trigger: 'question',
      studentMessage: 'No sé cómo seguir',
    });
  });

  it('gets a student stuck in the chat', () => {
    roll(0);
    simulator.chatStuckOne(target);

    expect(db.tables().interactions.map((i) => [i.trigger, i.studentMessage])).toEqual(
      Array.from({ length: CHAT_STUCK_MESSAGES }, () => ['question', 'No sé cómo seguir']),
    );
  });

  it('pastes a little', () => {
    roll(0.75);
    simulator.step(target);
    simulator.step(target);

    expect(db.tables().events[0]).toMatchObject({ type: 'paste', detail: { length: 47 } });
  });

  it('leaves the window and comes back, without changing the attempt', () => {
    roll(0.9);
    simulator.step(target);
    const [attempt] = attempts();
    db.update('events', (events) => [...events, testEvents.run(attempt.id, Date.now())]);
    simulator.step(target);
    simulator.step(target);

    expect(eventTypes()).toEqual(['run', 'focus_lost', 'focus_gained']);
    expect(attempts()[0].updatedAt).toBe(attempt.updatedAt);
  });

  it('practises again once every exercise of the block is submitted', () => {
    roll(0);
    const exercises = db
      .tables()
      .assignments.filter((assignment) => assignment.blockId === target.blockIds[0]).length;
    for (let exercise = 0; exercise < exercises; exercise++) {
      simulator.patternOne(target);
    }
    simulator.step(target);
    const practice = attempts().filter((attempt) => attempt.number === 2);

    expect(practice).toHaveLength(1);
  });

  it('gets a student stuck failing the same test', () => {
    roll(0);
    simulator.stuckOne(target);

    const runs = db.tables().events.filter((event) => event.type === 'run');
    expect(runs.length).toBeGreaterThanOrEqual(4);
    expect(
      new Set(runs.map((run) => (run.type === 'run' ? run.detail.failedTestIds[0] : ''))),
    ).toHaveProperty('size', 1);
  });

  it('gives a pattern: away, a large paste on return and a submission', () => {
    roll(0);
    simulator.patternOne(target);

    expect(eventTypes()).toEqual(['focus_lost', 'focus_gained', 'paste', 'run', 'submit']);
  });

  it('does nothing without a block, students or exercises', () => {
    simulator.step();
    simulator.step({ ...target, groupId: 'nobody' });
    simulator.stuckOne({ ...target, groupId: 'nobody' });
    simulator.patternOne({ ...target, groupId: 'nobody' });
    simulator.chatStuckOne({ ...target, groupId: 'nobody' });
    simulator.step({ ...target, blockIds: ['empty'] });

    expect(attempts()).toEqual([]);
  });
});
