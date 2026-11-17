import { otherBlockTitle } from './other-block';
import { GROUP_EXERCISES, GROUPS } from './live-testing';

const BLOCKS = GROUPS[0].blocks;
const [AS1, , AS3] = GROUP_EXERCISES;

describe('otherBlockTitle', () => {
  it('says nothing for an exercise of the chosen block', () => {
    expect(otherBlockTitle(BLOCKS, AS1, 'b1', 'es')).toBeNull();
  });

  it('gives the title of another block', () => {
    expect(otherBlockTitle(BLOCKS, AS3, 'b1', 'es')).toBe('b2');
  });

  it('always gives the block with the whole class', () => {
    expect(otherBlockTitle(BLOCKS, AS1, null, 'es')).toBe('b1');
  });

  it('says nothing without an exercise or when its block is gone', () => {
    expect(otherBlockTitle(BLOCKS, null, null, 'es')).toBeNull();
    expect(otherBlockTitle([], AS3, 'b1', 'es')).toBeNull();
  });
});
