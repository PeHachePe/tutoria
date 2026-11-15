import { moveItem } from './block-order';

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'] as const;

  it('moves an item down and up, keeping the others in order', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps the list when nothing moves', () => {
    expect(moveItem(items, 1, 1)).toEqual(items);
  });

  it('stops at both ends', () => {
    expect(moveItem(items, 0, -1)).toEqual(items);
    expect(moveItem(items, 3, 9)).toEqual(items);
    expect(moveItem(items, 1, 9)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('never changes the list it gets', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});
