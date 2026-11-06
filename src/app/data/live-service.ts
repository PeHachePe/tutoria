import type { Attempt } from './attempt';
import type { ProcessEvent } from './process-event';
import type { TutorInteraction } from './tutor';

/** A change in a group while the teacher watches it. */
export type LiveUpdate =
  | { readonly type: 'attempt'; readonly attempt: Attempt }
  | { readonly type: 'event'; readonly event: ProcessEvent }
  | { readonly type: 'interaction'; readonly interaction: TutorInteraction };

/**
 * Live activity of a group. Abstract class without a decorator: it is the injection token (4.2, D-005).
 * Refined in step 4.1.
 */
export abstract class LiveService {
  /** Calls `onUpdate` with each change in the group; returns the function that stops watching. */
  abstract watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void;
}
