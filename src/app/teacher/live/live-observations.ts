import type { LiveReason } from './live-reason';
import type { LiveRow } from './live-row';

/**
 * The chips of a row of «Alumnado» (D-068): only what exists, as facts. First the reason of the
 * queue, then whether the student left the window, the patterns worth a look, and the
 * perseverance. A stopped student has no chip: «Última actividad» already says since when, and
 * «Parados y sin entrar» finds them (D-070). Whoever has not come in has nothing to say either:
 * their state already says it.
 */
export function liveObservations(row: LiveRow): LiveReason[] {
  if (row.work === 'absent') return [];
  return [
    ...(row.reason ? [row.reason] : []),
    ...(row.away !== null ? [{ kind: 'away' } as const] : []),
    ...row.patterns,
    ...(row.breakthrough
      ? [{ kind: 'breakthrough', failures: row.breakthrough.failures } as const]
      : []),
    ...(row.repeated > 0 ? [{ kind: 'repeated', count: row.repeated } as const] : []),
  ];
}
