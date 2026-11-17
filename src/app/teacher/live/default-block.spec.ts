import type { Attempt } from '../../data/attempt';
import { defaultBlock } from './default-block';
import {
  ago,
  GROUP_EXERCISES,
  GROUPS,
  STUDENTS,
  testAttempt,
  testRows,
  testSnapshot,
} from './live-testing';

const [GROUP] = GROUPS;

/** Ana, Bea and Cai at the assignments given, in the session unless `updatedAt` says otherwise. */
function rows(assignments: readonly (string | null)[], updatedAt = ago(2)) {
  const attempts = assignments.flatMap((assignmentId, index): Attempt[] =>
    assignmentId === null
      ? []
      : [testAttempt(`x${index}`, STUDENTS[index].id, { assignmentId, updatedAt })],
  );
  return testRows(testSnapshot({ exercises: GROUP_EXERCISES, attempts }));
}

describe('defaultBlock', () => {
  it('opens the block of the whole class', () => {
    expect(defaultBlock(rows(['as1', 'as2', 'as1']), GROUP)).toBe('b1');
  });

  it('opens the block of two thirds of the session', () => {
    expect(defaultBlock(rows(['as3', 'as1', 'as3']), GROUP)).toBe('b2');
  });

  it('opens the whole class when half the session is in each block', () => {
    expect(defaultBlock(rows(['as1', 'as3', null]), GROUP)).toBeNull();
  });

  it('opens the whole class when each student is in a different block', () => {
    const group = { ...GROUP, blocks: [...GROUP.blocks, { ...GROUP.blocks[1], id: 'b3' }] };
    const exercises = [
      ...GROUP_EXERCISES,
      { ...GROUP_EXERCISES[2], assignmentId: 'as4', blockId: 'b3' },
    ];
    const attempts = ['as1', 'as3', 'as4'].map((assignmentId, index) =>
      testAttempt(`x${index}`, STUDENTS[index].id, { assignmentId, updatedAt: ago(1) }),
    );

    expect(defaultBlock(testRows(testSnapshot({ exercises, attempts })), group)).toBeNull();
  });

  it('counts a student whose exercise left the group, in no block', () => {
    expect(defaultBlock(rows(['as1', 'gone', 'as1']), GROUP)).toBe('b1');
    expect(defaultBlock(rows(['as1', 'gone', 'as3']), GROUP)).toBeNull();
  });

  describe('out of class', () => {
    const quiet = rows(['as1', null, null], ago(3000));

    it('opens the block that moved last', () => {
      expect(defaultBlock(quiet, GROUP)).toBe('b2');
    });

    it('opens the first block when the latest one is gone or unknown', () => {
      expect(defaultBlock(quiet, { ...GROUP, latestBlockId: 'gone' })).toBe('b1');
      expect(defaultBlock(quiet, { ...GROUP, latestBlockId: null })).toBe('b1');
    });

    it('opens nothing in a group without blocks', () => {
      expect(defaultBlock(quiet, GROUPS[1])).toBeNull();
    });
  });
});
