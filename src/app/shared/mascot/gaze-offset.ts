/** How far the irises can move inside the eyes, in units of the drawing (viewBox 0 0 200 200). */
export const GAZE_REACH = 3.5;

/**
 * Where the irises look so the mascot follows the pointer: towards it, and further the further
 * away it is, up to the edge of the eye once the pointer is one mascot width away.
 *
 * @param dx horizontal distance from the eyes to the pointer, in CSS pixels
 * @param dy vertical distance from the eyes to the pointer, in CSS pixels
 * @param size width of the mascot on screen, in CSS pixels
 */
export function gazeOffset(dx: number, dy: number, size: number): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || size === 0) return { x: 0, y: 0 };
  const reach = Math.min(distance / size, 1) * GAZE_REACH;
  const round = (value: number) => Math.round(value * 10) / 10 + 0;
  return { x: round((dx / distance) * reach), y: round((dy / distance) * reach) };
}
