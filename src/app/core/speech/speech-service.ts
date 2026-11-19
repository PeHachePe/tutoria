import type { AppLocale } from '../i18n/locale';

export const SPEECH_RATES = ['slow', 'normal', 'fast'] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];

export interface SpeechVoice {
  /** Its `voiceURI`: what the settings keep. */
  readonly id: string;
  /** As the system names it. */
  readonly name: string;
  /** BCP 47, as the browser gives it (`es-ES`). */
  readonly lang: string;
}

export interface SpeakOptions {
  readonly voiceId: string;
  readonly rate: SpeechRate;
}

export type SpeechErrorCode = 'voice-unavailable' | 'synthesis-failed';

export class SpeechError extends Error {
  override readonly name = 'SpeechError';
  constructor(readonly code: SpeechErrorCode) {
    super(`Speech error: ${code}`);
  }
}

/**
 * What the app asks of the browser's speech (2.11). WebSpeechService is the only class that touches
 * Web Speech; the rest is tested with FakeSpeechService. Step 6.1b adds listening.
 */
export abstract class SpeechService {
  /** Whether this browser has speech synthesis at all. */
  abstract readonly canSpeak: boolean;
  /** The voices of that language, in alphabetical order; none if it cannot speak. */
  abstract voices(language: AppLocale): Promise<readonly SpeechVoice[]>;
  /** Says one sentence; rejects with a SpeechError. */
  abstract speak(sentence: string, options: SpeakOptions): Promise<'ended' | 'cancelled'>;
  abstract stopSpeaking(): void;
}
