import { inject, linkedSignal, Service, type WritableSignal } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { SPEECH_RATES, type SpeechRate } from '../../core/speech/speech-service';
import { REACTION_MODES, type ReactionMode } from '../../shared/reactions/reaction';

/** Name of each setting in localStorage, before the user id. */
const STORAGE_KEYS = {
  reactions: 'tutoria.reactions',
  reactionEmojis: 'tutoria.reaction-emojis',
  proactive: 'tutoria.proactive',
  mascotHeadset: 'tutoria.mascot-headset',
  mascotBowTie: 'tutoria.mascot-bow-tie',
  mascotBoneCursor: 'tutoria.mascot-bone-cursor',
  voice: 'tutoria.voice',
  tutorVoice: 'tutoria.tutor-voice',
  speechRate: 'tutoria.speech-rate',
  readAloud: 'tutoria.read-aloud',
  audioNoticeSeen: 'tutoria.audio-notice-seen',
} as const;

export type SettingName = keyof typeof STORAGE_KEYS;

/** Where a user's setting is kept: each user of the browser has their own. */
export function settingKey(setting: SettingName, userId: string): string {
  return `${STORAGE_KEYS[setting]}.${userId}`;
}

/**
 * The student's settings (4.5, ficha 05), remembered per user in this browser: how the tutor's
 * reactions show (1.8), whether the tutor may speak first (it does from step 6.2) and the mascot's
 * accessories, and the voice (2.11): whether it is on, the tutor's voice (none until the student
 * chooses one), its speed, whether new answers are read aloud and whether the student was told where
 * the audio of the dictation goes. The colour mode is for the whole browser, because the login uses it too:
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
  private readonly voiceState = this.flag('voice', false);
  /** Its `voiceURI`, one for every language; no default: the app does not choose for the student. */
  private readonly tutorVoiceState = this.setting<string | null>(
    'tutorVoice',
    (saved) => saved || null,
  );
  private readonly speechRateState = this.setting<SpeechRate>('speechRate', (saved) =>
    toSpeechRate(saved),
  );
  private readonly readAloudState = this.flag('readAloud', false);
  /** The student was told where the audio goes before dictating for the first time (2.11). */
  private readonly audioNoticeSeenState = this.flag('audioNoticeSeen', false);

  readonly reactions = this.reactionsState.asReadonly();
  readonly reactionEmojis = this.reactionEmojisState.asReadonly();
  readonly proactive = this.proactiveState.asReadonly();
  readonly mascotHeadset = this.mascotHeadsetState.asReadonly();
  readonly mascotBowTie = this.mascotBowTieState.asReadonly();
  readonly mascotBoneCursor = this.mascotBoneCursorState.asReadonly();
  readonly voice = this.voiceState.asReadonly();
  readonly tutorVoice = this.tutorVoiceState.asReadonly();
  readonly speechRate = this.speechRateState.asReadonly();
  readonly readAloud = this.readAloudState.asReadonly();
  readonly audioNoticeSeen = this.audioNoticeSeenState.asReadonly();

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

  setVoice(on: boolean): void {
    this.update('voice', this.voiceState, on);
  }

  setTutorVoice(id: string): void {
    this.update('tutorVoice', this.tutorVoiceState, id);
  }

  setSpeechRate(rate: SpeechRate): void {
    this.update('speechRate', this.speechRateState, rate);
  }

  setReadAloud(on: boolean): void {
    this.update('readAloud', this.readAloudState, on);
  }

  /** «Entendido» on the notice of where the audio goes: it does not show again for this user. */
  setAudioNoticeSeen(): void {
    this.update('audioNoticeSeen', this.audioNoticeSeenState, true);
  }

  /** Read again for each user who signs in; a choice without a user lasts until the page closes. */
  private setting<T>(name: SettingName, parse: (saved: string | null) => T): WritableSignal<T> {
    return linkedSignal(() => parse(read(this.userId(), name)));
  }

  private flag(name: SettingName, byDefault: boolean): WritableSignal<boolean> {
    return this.setting(name, (saved) => (saved === null ? byDefault : saved === 'true'));
  }

  private update<T extends string | boolean | null>(
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

function toSpeechRate(saved: string | null): SpeechRate {
  return SPEECH_RATES.find((rate) => rate === saved) ?? 'normal';
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
