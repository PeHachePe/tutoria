const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;

/** A duration as the detail says it, rounded: «45 s», «3 min», «1 h 20 min», «3 d». */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / SECOND_MS);
  if (seconds < MINUTE_SECONDS) {
    return $localize`:@@duration.seconds:${seconds}:seconds: s`;
  }
  const minutes = Math.round(seconds / MINUTE_SECONDS);
  if (minutes < HOUR_MINUTES) {
    return $localize`:@@duration.minutes:${minutes}:minutes: min`;
  }
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours >= DAY_HOURS) {
    const days = Math.round(hours / DAY_HOURS);
    return $localize`:@@duration.days:${days}:days: d`;
  }
  const rest = minutes % HOUR_MINUTES;
  return rest === 0
    ? $localize`:@@duration.hours:${hours}:hours: h`
    : $localize`:@@duration.hoursMinutes:${hours}:hours: h ${rest}:minutes: min`;
}
