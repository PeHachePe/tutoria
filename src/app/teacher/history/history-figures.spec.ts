import {
  averageHints,
  formatAverage,
  formatPercent,
  isRepresentative,
  isStarted,
  pickBlock,
  solvedPercent,
} from './history-figures';
import { blockStats } from './history-testing';

describe('history figures', () => {
  it('says whether somebody opened an exercise of the block', () => {
    expect(isStarted(blockStats('b1'))).toBe(true);
    expect(isStarted(blockStats('b1', { attempts: 0 }))).toBe(false);
  });

  it('gives the hints per attempt that counts, 0 without attempts', () => {
    expect(averageHints(blockStats('b1', { hints: 27, attempts: 48 }))).toBeCloseTo(0.5625);
    expect(averageHints(blockStats('b1', { hints: 0, attempts: 0 }))).toBe(0);
  });

  it('gives the share of the exercises solved, rounded, 0 without any to solve', () => {
    expect(solvedPercent(blockStats('b1', { solved: 41, assignments: 3 }), 24)).toBe(57);
    expect(solvedPercent(blockStats('b1', { assignments: 0 }), 24)).toBe(0);
    expect(solvedPercent(blockStats('b1'), 0)).toBe(0);
  });

  it('reads the trend from the blocks worked on by at least half the class', () => {
    expect(isRepresentative(blockStats('b1', { activeStudents: 12 }), 24)).toBe(true);
    expect(isRepresentative(blockStats('b1', { activeStudents: 11 }), 24)).toBe(false);
    expect(isRepresentative(blockStats('b1', { activeStudents: 0 }), 0)).toBe(false);
  });

  it('writes a mean with one decimal, as the language does', () => {
    expect(formatAverage(1.125, 'es')).toBe('1,1');
    expect(formatAverage(0, 'es')).toBe('0,0');
    expect(formatAverage(0.56, 'en')).toBe('0.6');
  });

  it('writes a share as the language does', () => {
    expect(formatPercent(57, 'es')).toBe('57\u00a0%');
    expect(formatPercent(100, 'en')).toBe('100%');
  });

  describe('pickBlock', () => {
    const first = blockStats('b1');
    const few = blockStats('b2', { activeStudents: 2 });
    const empty = blockStats('b3', { attempts: 0, activeStudents: 0 });

    it('picks the block of the URL', () => {
      expect(pickBlock([first, few], 24, 'b2')).toBe(few);
    });

    it('picks the latest representative one without a started block in the URL', () => {
      expect(pickBlock([first, few, empty], 24, 'b3')).toBe(first);
      expect(pickBlock([first, few], 24, 'other')).toBe(first);
      expect(pickBlock([first, few], 24, undefined)).toBe(first);
    });

    it('picks the latest started one without representative blocks, null without any', () => {
      expect(
        pickBlock([few, blockStats('b4', { activeStudents: 1 }), empty], 24, undefined),
      ).toEqual(blockStats('b4', { activeStudents: 1 }));
      expect(pickBlock([empty], 24, undefined)).toBeNull();
    });
  });
});
