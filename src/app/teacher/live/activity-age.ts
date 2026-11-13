const MINUTE_MS = 60_000;

/** Minutes under which «hace N min» still reads well; older activity shows its date and time. */
export const RECENT_ACTIVITY_MINUTES = 60;

/** How long ago something happened, as the panel says it. */
export type ActivityAge =
  | { readonly kind: 'none' }
  | { readonly kind: 'now' }
  | { readonly kind: 'minutes'; readonly minutes: number }
  | { readonly kind: 'date'; readonly at: number };

/** «Ahora mismo», «hace 5 min» or, after an hour, the date and time; `none` without activity. */
export function activityAge(lastActivity: number | null, now: number): ActivityAge {
  if (lastActivity === null) return { kind: 'none' };
  const minutes = Math.floor(Math.max(0, now - lastActivity) / MINUTE_MS);
  if (minutes === 0) return { kind: 'now' };
  return minutes < RECENT_ACTIVITY_MINUTES
    ? { kind: 'minutes', minutes }
    : { kind: 'date', at: lastActivity };
}
