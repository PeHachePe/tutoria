import { DOCUMENT, inject, Service } from '@angular/core';

import type { AppLocale } from '../i18n/locale';
import {
  type SpeakOptions,
  SpeechError,
  type SpeechRate,
  SpeechService,
  type SpeechVoice,
} from './speech-service';
import { byQuality } from './voice-quality';

/** How long to wait for the voices, which some browsers load after the first call. */
export const VOICES_TIMEOUT_MS = 2000;

/** The `rate` of the utterance for each speed. */
export const RATE_VALUES: Readonly<Record<SpeechRate, number>> = {
  slow: 0.85,
  normal: 1,
  fast: 1.2,
};

/** The error codes of an utterance that was silenced, not one that failed. */
const CANCEL_CODES: readonly string[] = ['canceled', 'interrupted'];

/**
 * The browser's speech synthesis (2.11), the only class that touches it. Loaded only with the voice
 * on (SpeechLoader), so it is self-provided for `injectAsync`.
 */
@Service()
export class WebSpeechService extends SpeechService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly synthesis = this.window?.speechSynthesis;
  private readonly Utterance = this.window?.SpeechSynthesisUtterance;
  /** Chrome drops an utterance nobody holds before it ends, so the current one is kept here. */
  private current: SpeechSynthesisUtterance | undefined;

  readonly canSpeak = Boolean(this.synthesis && this.Utterance);

  async voices(language: AppLocale): Promise<readonly SpeechVoice[]> {
    const all = await this.allVoices();
    const unique = new Map<string, SpeechVoice>();
    for (const voice of all) {
      const lang = voice.lang.replace('_', '-');
      const tag = lang.toLowerCase();
      if ((tag === language || tag.startsWith(`${language}-`)) && !unique.has(voice.voiceURI)) {
        unique.set(voice.voiceURI, {
          id: voice.voiceURI,
          name: voice.name,
          lang,
          local: voice.localService,
        });
      }
    }
    return [...unique.values()].sort(byQuality(language));
  }

  async speak(sentence: string, options: SpeakOptions): Promise<'ended' | 'cancelled'> {
    const voice = (await this.allVoices()).find((each) => each.voiceURI === options.voiceId);
    if (!voice || !this.synthesis || !this.Utterance) throw new SpeechError('voice-unavailable');
    const utterance = new this.Utterance(sentence);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = RATE_VALUES[options.rate];
    this.current = utterance;
    const synthesis = this.synthesis;
    return new Promise<'ended' | 'cancelled'>((resolve, reject) => {
      utterance.onend = () => resolve('ended');
      utterance.onerror = (event) =>
        CANCEL_CODES.includes(event.error)
          ? resolve('cancelled')
          : reject(new SpeechError('synthesis-failed'));
      synthesis.speak(utterance);
    }).finally(() => {
      if (this.current === utterance) this.current = undefined;
    });
  }

  stopSpeaking(): void {
    this.synthesis?.cancel();
  }

  /** Every voice: some browsers give none until `voiceschanged`, and some never fire it. */
  private allVoices(): Promise<SpeechSynthesisVoice[]> {
    const synthesis = this.synthesis;
    if (!synthesis || !this.canSpeak) return Promise.resolve([]);
    const now = synthesis.getVoices();
    if (now.length) return Promise.resolve(now);
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        synthesis.removeEventListener('voiceschanged', done);
        resolve(synthesis.getVoices());
      };
      const timer = setTimeout(done, VOICES_TIMEOUT_MS);
      synthesis.addEventListener('voiceschanged', done);
    });
  }
}
