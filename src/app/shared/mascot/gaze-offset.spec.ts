import { GAZE_REACH, gazeOffset } from './gaze-offset';

describe('gazeOffset', () => {
  const SIZE = 160;

  it('looks straight ahead when the pointer is on its face', () => {
    expect(gazeOffset(0, 0, SIZE)).toEqual({ x: 0, y: 0 });
  });

  it('looks towards the pointer, further the further away it is', () => {
    const near = gazeOffset(SIZE / 4, 0, SIZE);
    const far = gazeOffset(SIZE / 2, 0, SIZE);

    expect(near.x).toBeGreaterThan(0);
    expect(far.x).toBeGreaterThan(near.x);
    expect(near.y).toBe(0);
  });

  it('never goes beyond the edge of the eye', () => {
    const offset = gazeOffset(-SIZE * 10, SIZE * 10, SIZE);

    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(GAZE_REACH, 1);
    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });

  it('rounds to tenths, so small pointer moves do not redraw the eyes', () => {
    const { x, y } = gazeOffset(13, 7, SIZE);

    expect(x * 10).toBe(Math.round(x * 10));
    expect(y * 10).toBe(Math.round(y * 10));
  });

  it('looks ahead while it has no size yet', () => {
    expect(gazeOffset(50, 50, 0)).toEqual({ x: 0, y: 0 });
  });
});
