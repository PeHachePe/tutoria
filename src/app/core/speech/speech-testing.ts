import type { Provider } from '@angular/core';

import type { AppLocale } from '../i18n/locale';
import { SpeechLoader } from './speech-loader';
import {
  type Listening,
  type ListeningEnd,
  type RecognitionPlace,
  type SpeakOptions,
  SpeechError,
  type SpeechErrorCode,
  SpeechService,
  type SpeechVoice,
  type Transcript,
} from './speech-service';

/**
 * A speech that only remembers what it was asked: each sentence waits for `finish()` or `fail()`,
 * and `changeVoices()` replaces the voices as the browser would. Its microphone hears what `hear()`
 * says until `endListening()` or a `stop()`.
 */
export class FakeSpeechService extends SpeechService {
  canSpeak = true;
  voiceList: SpeechVoice[] = [];
  readonly spoken: { sentence: string; options: SpeakOptions }[] = [];
  stops = 0;
  /** Where it transcribes. */
  place: RecognitionPlace = 'server';
  /** What `installRecognition()` gives: the place is `device` after one that works. */
  installWorks = true;
  /** The languages whose pack was downloaded. */
  readonly installs: AppLocale[] = [];
  /** The languages it was asked to listen in, one each time. */
  readonly listens: AppLocale[] = [];
  private heard: ((transcript: Transcript) => void) | undefined;
  private endListen: ((end: ListeningEnd) => void) | undefined;
  private readonly voicesListeners = new Set<() => void>();
  private settle: ((outcome: 'ended' | 'cancelled' | SpeechError) => void) | undefined;

  voices(language: AppLocale): Promise<readonly SpeechVoice[]> {
    return Promise.resolve(
      this.canSpeak ? this.voiceList.filter((voice) => voice.lang.startsWith(language)) : [],
    );
  }

  speak(sentence: string, options: SpeakOptions): Promise<'ended' | 'cancelled'> {
    this.spoken.push({ sentence, options });
    return new Promise((resolve, reject) => {
      this.settle = (outcome) =>
        outcome instanceof SpeechError ? reject(outcome) : resolve(outcome);
    });
  }

  stopSpeaking(): void {
    this.stops++;
    this.end('cancelled');
  }

  recognition(): Promise<RecognitionPlace> {
    return Promise.resolve(this.place);
  }

  installRecognition(language: AppLocale): Promise<boolean> {
    this.installs.push(language);
    if (this.installWorks) this.place = 'device';
    return Promise.resolve(this.installWorks);
  }

  listen(language: AppLocale, heard: (transcript: Transcript) => void): Listening {
    this.listens.push(language);
    this.heard = heard;
    const ended = new Promise<ListeningEnd>((resolve) => (this.endListen = resolve));
    return { stop: () => this.endListening('stopped'), ended };
  }

  /** Whether the microphone is open. */
  get listening(): boolean {
    return this.endListen !== undefined;
  }

  /** The microphone hears: what is being understood, or a final sentence. */
  hear(text: string, final = true): void {
    this.heard?.({ text, final });
  }

  /** The listening ends, as the browser or the student would end it. */
  endListening(end: ListeningEnd = 'silence'): void {
    const resolve = this.endListen;
    this.endListen = undefined;
    this.heard = undefined;
    resolve?.(end);
  }

  onVoicesChanged(listener: () => void): () => void {
    this.voicesListeners.add(listener);
    return () => this.voicesListeners.delete(listener);
  }

  /** The browser's voices change: those who listen hear it. */
  changeVoices(voices: SpeechVoice[]): void {
    this.voiceList = voices;
    for (const listener of this.voicesListeners) listener();
  }

  /** How many listen to the changes of the voices. */
  get voicesWatchers(): number {
    return this.voicesListeners.size;
  }

  /** The sentence that sounds ends. */
  finish(): void {
    this.end('ended');
  }

  fail(code: SpeechErrorCode = 'synthesis-failed'): void {
    this.end(new SpeechError(code));
  }

  /** The sentences said so far. */
  get sentences(): string[] {
    return this.spoken.map((each) => each.sentence);
  }

  private end(outcome: 'ended' | 'cancelled' | SpeechError): void {
    const settle = this.settle;
    this.settle = undefined;
    settle?.(outcome);
  }
}

export function provideFakeSpeech(fake: FakeSpeechService): Provider {
  return { provide: SpeechLoader, useValue: { load: () => Promise.resolve(fake) } };
}
