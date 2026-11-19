import type { Provider } from '@angular/core';

import type { AppLocale } from '../i18n/locale';
import { SpeechLoader } from './speech-loader';
import {
  type SpeakOptions,
  SpeechError,
  type SpeechErrorCode,
  SpeechService,
  type SpeechVoice,
} from './speech-service';

/**
 * A speech that only remembers what it was asked: each sentence waits for `finish()` or `fail()`,
 * and `changeVoices()` replaces the voices as the browser would.
 */
export class FakeSpeechService extends SpeechService {
  canSpeak = true;
  voiceList: SpeechVoice[] = [];
  readonly spoken: { sentence: string; options: SpeakOptions }[] = [];
  stops = 0;
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
