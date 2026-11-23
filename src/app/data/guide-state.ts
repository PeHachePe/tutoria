/**
 * Table `user_guide_state` (2.12, D-080): what a user saw and did of the guided help, so it is not
 * repeated, also on another device. Only its owner reads it. Unknown task ids are ignored, so new or
 * renamed tasks need no migration.
 */
export interface GuideState {
  /** Version of the welcome of their area they saw or skipped; none before. */
  readonly welcome?: number;
  /** The guided tasks they finished, by stable id, with when (ISO 8601). */
  readonly done?: Readonly<Record<string, string>>;
  /** They hid the first steps with «Ya sé usarla». */
  readonly firstStepsHidden?: boolean;
}
