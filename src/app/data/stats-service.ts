/**
 * Aggregates of a group in one block, for the history screen. They count the attempt that counts of
 * each assignment (`countedAttempt()`): practice does not change the data of the class (2.5c).
 */
export interface BlockStats {
  readonly blockId: string;
  /** Mean of the hints each student asked for; a falling trend shows growing autonomy. */
  readonly averageHints: number;
  readonly averageMinutes: number;
  /** Share of the assigned exercises that were passed or submitted, from 0 to 1. */
  readonly passedRate: number;
  /** Students who were stuck at some point of the block. */
  readonly studentsWithSignals: number;
}

/**
 * Statistics of a group. Abstract class without a decorator: it is the injection token (4.2, D-005).
 * Refined in step 4.2.
 */
export abstract class StatsService {
  /** One row per block of the group, in their order. */
  abstract groupBlockStats(groupId: string): Promise<BlockStats[]>;
}
