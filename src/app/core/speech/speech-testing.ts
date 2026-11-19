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

/** A speech that only remembers what it was asked: each sentence waits for `finish()` or `fail()`. */
export class FakeSpeechService extends SpeechService {
  canSpeak = true;
  voiceList: SpeechVoice[] = [];
  readonly spoken: { sentence: string; options: SpeakOptions }[] = [];
  stops = 0;
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
