import { inject, linkedSignal, Service } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { REACTION_MODES, type ReactionMode } from '../../shared/reactions/reaction';

const REACTIONS_KEY = 'tutoria.reactions';

export function reactionsKey(userId: string): string {
  return `${REACTIONS_KEY}.${userId}`;
}

/**
 * The student's settings (4.5), remembered per user in this browser. For now only how the tutor's
 * reactions show (1.8); the settings screen (1.9) adds the animations, the proactivity and the voice.
 */
@Service()
export class SettingsStore {
  private readonly userId = inject(AuthStore).userId;

  /** Read again for each user who signs in; a choice without a user lasts until the page closes. */
  private readonly reactionsState = linkedSignal<ReactionMode>(() => readReactions(this.userId()));

  readonly reactions = this.reactionsState.asReadonly();

  setReactions(mode: ReactionMode): void {
    this.reactionsState.set(mode);
    const userId = this.userId();
    if (!userId) return;
    try {
      localStorage.setItem(reactionsKey(userId), mode);
    } catch {
      // Storage unavailable: the choice lasts until the page is closed
    }
  }
}

function readReactions(userId: string | undefined): ReactionMode {
  if (!userId) return 'full';
  try {
    const saved = localStorage.getItem(reactionsKey(userId));
    return REACTION_MODES.find((mode) => mode === saved) ?? 'full';
  } catch {
    return 'full';
  }
}
