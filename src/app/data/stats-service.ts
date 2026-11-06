/** Aggregates of a group in one session, for the history screen. */
export interface SessionStats {
  readonly session: number;
  /** Mean of the hints each student asked for; a falling trend shows growing autonomy. */
  readonly averageHints: number;
  readonly averageMinutes: number;
  /** Share of the assigned exercises that were passed or submitted, from 0 to 1. */
  readonly passedRate: number;
  /** Students who were stuck at some point of the session. */
  readonly studentsWithSignals: number;
}

/**
 * Statistics of a group. Abstract class without a decorator: it is the injection token (4.2, D-005).
 * Refined in step 4.2.
 */
export abstract class StatsService {
  abstract groupSessionStats(groupId: string): Promise<SessionStats[]>;
}
