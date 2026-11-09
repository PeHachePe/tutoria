import { inject, linkedSignal, Service } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { REACTION_MODES, type ReactionMode } from '../../shared/reactions/reaction';

const REACTIONS_KEY = 'tutoria.reactions';
const REACTION_EMOJIS_KEY = 'tutoria.reaction-emojis';

export function reactionsKey(userId: string): string {
  return `${REACTIONS_KEY}.${userId}`;
}

export function reactionEmojisKey(userId: string): string {
  return `${REACTION_EMOJIS_KEY}.${userId}`;
}

/**
 * The student's settings (4.5), remembered per user in this browser. For now how the tutor's
 * reactions show and whether with the animated 3D emoji or the flat ones (1.8, D-036); the settings screen (1.9)
 * adds the proactivity and the voice.
 */
@Service()
export class SettingsStore {
  private readonly userId = inject(AuthStore).userId;

  /** Read again for each user who signs in; a choice without a user lasts until the page closes. */
  private readonly reactionsState = linkedSignal<ReactionMode>(() => readReactions(this.userId()));

  readonly reactions = this.reactionsState.asReadonly();

  /** The animated 3D emoji of the reactions; without them, the light flat 2D ones. */
  private readonly reactionEmojisState = linkedSignal<boolean>(
    () => read(this.userId(), reactionEmojisKey) !== 'false',
  );

  readonly reactionEmojis = this.reactionEmojisState.asReadonly();

  setReactions(mode: ReactionMode): void {
    this.reactionsState.set(mode);
    this.save(reactionsKey, mode);
  }

  setReactionEmojis(on: boolean): void {
    this.reactionEmojisState.set(on);
    this.save(reactionEmojisKey, String(on));
  }

  private save(key: (userId: string) => string, value: string): void {
    const userId = this.userId();
    if (!userId) return;
    try {
      localStorage.setItem(key(userId), value);
    } catch {
      // Storage unavailable: the choice lasts until the page is closed
    }
  }
}

function readReactions(userId: string | undefined): ReactionMode {
  const saved = read(userId, reactionsKey);
  return REACTION_MODES.find((mode) => mode === saved) ?? 'full';
}

/** What the user saved, or null without a user, a value or storage. */
function read(userId: string | undefined, key: (userId: string) => string): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}
