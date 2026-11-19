/**
 * What a teacher asks of the Edge Functions that is not a student's (4.3c, D-059): checking a solution,
 * translating, the tutor in preview mode (4.3e, D-061) and the check of the AI provider (5.3a).
 */
export type StaffRequestKind = 'check' | 'translate' | 'tutor' | 'ai_check';

/** The limits of the requests of the staff, with `claim_staff_request`. */
export interface StaffRequests {
  /**
   * Counts one request of the user if they may make it now and answers 0; otherwise, the seconds to
   * wait. `null` if they are not an active teacher or administrator. `perDay` limits those of the
   * last 24 hours too: the ones that call the model (D-063).
   */
  claim(
    userId: string,
    kind: StaffRequestKind,
    perMinute: number,
    perDay?: number,
  ): Promise<number | null>;
}
