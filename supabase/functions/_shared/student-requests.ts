/** What a student asks of the Edge Functions: running their code and a turn of the tutor. */
export type StudentRequestKind = 'run' | 'tutor';

/**
 * The limits of the requests of a student, with `claim_student_request`: counted before they
 * happen, one at a time, so requests at once never pass together and what fails counts too (D-063).
 */
export interface StudentRequests {
  /**
   * Counts one request of the user if they may make it now and answers 0; otherwise, the seconds to
   * wait. `perDay` limits those of the last 24 hours too.
   */
  claim(
    userId: string,
    kind: StudentRequestKind,
    perMinute: number,
    perDay?: number,
  ): Promise<number>;
}
