import { inject, linkedSignal, Service, type WritableSignal } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { REACTION_MODES, type ReactionMode } from '../../shared/reactions/reaction';

/** Name of each setting in localStorage, before the user id. */
const STORAGE_KEYS = {
  reactions: 'tutoria.reactions',
  reactionEmojis: 'tutoria.reaction-emojis',
  proactive: 'tutoria.proactive',
  mascotHeadset: 'tutoria.mascot-headset',
  mascotBowTie: 'tutoria.mascot-bow-tie',
  mascotBoneCursor: 'tutoria.mascot-bone-cursor',
} as const;

export type SettingName = keyof typeof STORAGE_KEYS;

/** Where a user's setting is kept: each user of the browser has their own. */
export function settingKey(setting: SettingName, userId: string): string {
  return `${STORAGE_KEYS[setting]}.${userId}`;
}

/**
 * The student's settings (4.5, ficha 05), remembered per user in this browser: how the tutor's
 * reactions show (1.8), whether the tutor may speak first (it does from step 6.2) and the mascot's
 * accessories. The colour mode is for the whole browser, because the login uses it too:
 * ThemeService keeps it. Whether the data notice was seen is part of the user (AuthStore, RF-07).
 */
@Service()
export class SettingsStore {
  private readonly userId = inject(AuthStore).userId;

  private readonly reactionsState = this.setting<ReactionMode>('reactions', (saved) =>
    toReactionMode(saved),
  );
  /** The animated emoji of the reactions; without them, the same ones still, a few KB (D-043). */
  private readonly reactionEmojisState = this.flag('reactionEmojis', true);
  private readonly proactiveState = this.flag('proactive', true);
  private readonly mascotHeadsetState = this.flag('mascotHeadset', true);
  private readonly mascotBowTieState = this.flag('mascotBowTie', true);
  private readonly mascotBoneCursorState = this.flag('mascotBoneCursor', true);

  readonly reactions = this.reactionsState.asReadonly();
  readonly reactionEmojis = this.reactionEmojisState.asReadonly();
  readonly proactive = this.proactiveState.asReadonly();
  readonly mascotHeadset = this.mascotHeadsetState.asReadonly();
  readonly mascotBowTie = this.mascotBowTieState.asReadonly();
  readonly mascotBoneCursor = this.mascotBoneCursorState.asReadonly();

  setReactions(mode: ReactionMode): void {
    this.update('reactions', this.reactionsState, mode);
  }

  setReactionEmojis(on: boolean): void {
    this.update('reactionEmojis', this.reactionEmojisState, on);
  }

  setProactive(on: boolean): void {
    this.update('proactive', this.proactiveState, on);
  }

  setMascotHeadset(on: boolean): void {
    this.update('mascotHeadset', this.mascotHeadsetState, on);
  }

  setMascotBowTie(on: boolean): void {
    this.update('mascotBowTie', this.mascotBowTieState, on);
  }

  setMascotBoneCursor(on: boolean): void {
    this.update('mascotBoneCursor', this.mascotBoneCursorState, on);
  }

  /** Read again for each user who signs in; a choice without a user lasts until the page closes. */
  private setting<T>(name: SettingName, parse: (saved: string | null) => T): WritableSignal<T> {
    return linkedSignal(() => parse(read(this.userId(), name)));
  }

  private flag(name: SettingName, byDefault: boolean): WritableSignal<boolean> {
    return this.setting(name, (saved) => (saved === null ? byDefault : saved === 'true'));
  }

  private update<T extends string | boolean>(
    name: SettingName,
    state: WritableSignal<T>,
    value: T,
  ): void {
    state.set(value);
    const userId = this.userId();
    if (!userId) return;
    try {
      localStorage.setItem(settingKey(name, userId), String(value));
    } catch {
      // Storage unavailable: the choice lasts until the page is closed
    }
  }
}

function toReactionMode(saved: string | null): ReactionMode {
  return REACTION_MODES.find((mode) => mode === saved) ?? 'full';
}

/** What the user saved, or null without a user, a value or storage. */
function read(userId: string | undefined, name: SettingName): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(settingKey(name, userId));
  } catch {
    return null;
  }
}
