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
  /** False for a voice of the network, which usually sounds more natural. */
  readonly local?: boolean;
}

export interface SpeakOptions {
  readonly voiceId: string;
  readonly rate: SpeechRate;
  /** The sound starts: the browser may take a moment after `speak()`. */
  readonly started?: () => void;
}

/**
 * Where this browser would transcribe the voice: on the device (the audio does not leave it), on the
 * device once the language pack is downloaded, in the browser's service, or nowhere.
 */
export type RecognitionPlace = 'device' | 'downloadable' | 'server' | 'none';

/** Why the microphone could not listen; hearing nothing is not one of them (2.11). */
export type ListenError =
  'not-allowed' | 'no-microphone' | 'service-unavailable' | 'language-not-supported';

/** Why a listening ended: asked to, nothing more was heard, or an error. */
export type ListeningEnd = 'stopped' | 'silence' | ListenError;

export type SpeechErrorCode = 'voice-unavailable' | 'synthesis-failed' | ListenError;

export interface Transcript {
  readonly text: string;
  /** A final one stays; one that is not is replaced by the next. */
  readonly final: boolean;
}

export interface Listening {
  /** Closes the microphone: `ended` resolves with `stopped`. */
  stop(): void;
  /** Why it ended; it never rejects. */
  readonly ended: Promise<ListeningEnd>;
}

export class SpeechError extends Error {
  override readonly name = 'SpeechError';
  constructor(readonly code: SpeechErrorCode) {
    super(`Speech error: ${code}`);
  }
}

/**
 * What the app asks of the browser's speech (2.11). WebSpeechService is the only class that touches
 * Web Speech; the rest is tested with FakeSpeechService.
 */
export abstract class SpeechService {
  /** Whether this browser has speech synthesis at all. */
  abstract readonly canSpeak: boolean;
  /** The voices of that language, the most natural first; none if it cannot speak. */
  abstract voices(language: AppLocale): Promise<readonly SpeechVoice[]>;
  /**
   * Calls the listener when the browser's voices change (one downloaded with the page open, or the
   * network ones arriving late); gives back what stops listening.
   */
  abstract onVoicesChanged(listener: () => void): () => void;
  /** Says one sentence; rejects with a SpeechError. */
  abstract speak(sentence: string, options: SpeakOptions): Promise<'ended' | 'cancelled'>;
  abstract stopSpeaking(): void;
  /** Where the audio would be transcribed in this browser, or that it cannot be. */
  abstract recognition(language: AppLocale): Promise<RecognitionPlace>;
  /**
   * Downloads the language pack to recognise on the device; whether it is there now. Needs the
   * student's click: the browser refuses a download nobody asked for.
   */
  abstract installRecognition(language: AppLocale): Promise<boolean>;
  /** Opens the microphone: every result replaces the last one until one is final. */
  abstract listen(language: AppLocale, heard: (transcript: Transcript) => void): Listening;
}
