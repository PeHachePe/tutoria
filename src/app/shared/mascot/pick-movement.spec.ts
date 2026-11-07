import { MASCOT_MOVEMENTS, pickMovement } from './pick-movement';

describe('pickMovement', () => {
  it('spreads the random number over every movement when there is no previous one', () => {
    const picked = MASCOT_MOVEMENTS.map((_, index) =>
      pickMovement(null, index / MASCOT_MOVEMENTS.length),
    );

    expect(picked).toEqual(MASCOT_MOVEMENTS);
  });

  it('never repeats the previous movement', () => {
    for (const previous of MASCOT_MOVEMENTS) {
      for (const random of [0, 0.25, 0.5, 0.75, 0.999_999]) {
        expect(pickMovement(previous, random)).not.toBe(previous);
      }
    }
  });

  it('chooses among the other movements in order', () => {
    const [first, second, third] = MASCOT_MOVEMENTS;

    expect(pickMovement(first, 0)).toBe(second);
    expect(pickMovement(first, 0.6)).toBe(third);
    expect(pickMovement(second, 0)).toBe(first);
  });

  it('stays inside the list at the top of the random range', () => {
    expect(MASCOT_MOVEMENTS).toContain(pickMovement(null, 0.999_999));
  });
});
