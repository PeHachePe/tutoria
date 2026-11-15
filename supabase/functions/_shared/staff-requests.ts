/** What a teacher asks of the Edge Functions that is neither a run nor the tutor (4.3c, D-059). */
export type StaffRequestKind = 'check' | 'translate';

/** The limit per minute of the requests of the staff, with `claim_staff_request`. */
export interface StaffRequests {
  /**
   * Counts one request of the user if they may make it now and answers 0; otherwise, the seconds to
   * wait. `null` if they are not an active teacher or administrator.
   */
  claim(userId: string, kind: StaffRequestKind, perMinute: number): Promise<number | null>;
}
