import { LIVE_WINDOW_MINUTES } from '../../data/live-service';

/** Minutes without doing anything after which a student of the session is stopped. */
export const ACTIVE_MINUTES = 5;

const MINUTE_MS = 60_000;

/**
 * Whether a student works now (D-068): `working` did something in the last `ACTIVE_MINUTES` and is
 * in the browser window; `stopped` was in the session and no longer is; `absent` did nothing in it.
 */
export type WorkState = 'working' | 'stopped' | 'absent';

/** `lastActivity` in ms or null; `away`, out of the browser window. */
export function workState(lastActivity: number | null, away: boolean, now: number): WorkState {
  if (lastActivity === null || lastActivity < now - LIVE_WINDOW_MINUTES * MINUTE_MS) {
    return 'absent';
  }
  return !away && now - lastActivity <= ACTIVE_MINUTES * MINUTE_MS ? 'working' : 'stopped';
}
