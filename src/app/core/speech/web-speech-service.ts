import { DOCUMENT, inject, Service } from '@angular/core';

import type { AppLocale } from '../i18n/locale';
import type {
  RecognitionAvailability,
  RecognitionConstructor,
  RecognitionOptions,
  RecognitionWindow,
} from './speech-recognition-api';
import {
  type Listening,
  type ListeningEnd,
  type RecognitionPlace,
  type SpeakOptions,
  SpeechError,
  type SpeechRate,
  SpeechService,
  type SpeechVoice,
  type Transcript,
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

/** The language the recognition listens for in each language of the interface. */
export const RECOGNITION_LANGS: Readonly<Record<AppLocale, string>> = {
  es: 'es-ES',
  en: 'en-US',
  ca: 'ca-ES',
};

/** Where it transcribes, from what the browser says of recognising on the device. */
const PLACES: Readonly<Record<RecognitionAvailability, RecognitionPlace>> = {
  available: 'device',
  downloadable: 'downloadable',
  downloading: 'downloadable',
  // It cannot on the device: the browser's service still can
  unavailable: 'server',
};

/**
 * How each error of the recognition ends the listening (MDN). `service-not-allowed` is the service
 * refused, not the microphone (it also comes on the device without the pack); `bad-grammar` and
 * any code a browser adds are the service failing. Hearing nothing is silence, not an error.
 */
const ERROR_ENDS: Readonly<Record<string, ListeningEnd>> = {
  'not-allowed': 'not-allowed',
  'audio-capture': 'no-microphone',
  'language-not-supported': 'language-not-supported',
  'no-speech': 'silence',
  aborted: 'stopped',
};

/**
 * The browser's speech synthesis and recognition (2.11), the only class that touches them. Loaded only with the voice
 * on (SpeechLoader), so it is self-provided for `injectAsync`.
 */
@Service()
export class WebSpeechService extends SpeechService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly synthesis = this.window?.speechSynthesis;
  private readonly Utterance = this.window?.SpeechSynthesisUtterance;
  /** Chrome drops an utterance nobody holds before it ends, so the current one is kept here. */
  private current: SpeechSynthesisUtterance | undefined;
  /** Grows with each stop, so a sentence still waiting for the voices is not said after it. */
  private stops = 0;

  private readonly Recognition: RecognitionConstructor | undefined =
    (this.window as RecognitionWindow | null)?.SpeechRecognition ??
    (this.window as RecognitionWindow | null)?.webkitSpeechRecognition;
  /** The languages the last `recognition()` found on the device: they are recognised there. */
  private readonly onDevice = new Set<AppLocale>();

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
    const stops = this.stops;
    const voice = (await this.allVoices()).find((each) => each.voiceURI === options.voiceId);
    // Silenced while it waited for the voices: cancel() found nothing to stop yet
    if (stops !== this.stops) return 'cancelled';
    if (!voice || !this.synthesis || !this.Utterance) throw new SpeechError('voice-unavailable');
    const utterance = new this.Utterance(sentence);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = RATE_VALUES[options.rate];
    this.current = utterance;
    const synthesis = this.synthesis;
    return new Promise<'ended' | 'cancelled'>((resolve, reject) => {
      utterance.onstart = () => options.started?.();
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
    this.stops++;
    this.synthesis?.cancel();
  }

  onVoicesChanged(listener: () => void): () => void {
    const synthesis = this.synthesis;
    if (!synthesis || !this.canSpeak) return () => undefined;
    synthesis.addEventListener('voiceschanged', listener);
    return () => synthesis.removeEventListener('voiceschanged', listener);
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

  async recognition(language: AppLocale): Promise<RecognitionPlace> {
    const Recognition = this.Recognition;
    if (!Recognition) return 'none';
    let place: RecognitionPlace = 'server';
    try {
      if (Recognition.available) place = PLACES[await Recognition.available(onDevice(language))];
    } catch {
      // A browser that cannot answer still has its service
    }
    if (place === 'device') this.onDevice.add(language);
    else this.onDevice.delete(language);
    return place;
  }

  async installRecognition(language: AppLocale): Promise<boolean> {
    try {
      return (await this.Recognition?.install?.(onDevice(language))) ?? false;
    } catch {
      // Refused, as a download nobody clicked for: it stays where it was
      return false;
    }
  }

  listen(language: AppLocale, heard: (transcript: Transcript) => void): Listening {
    let resolveEnd!: (end: ListeningEnd) => void;
    const ended = new Promise<ListeningEnd>((resolve) => (resolveEnd = resolve));
    let done = false;
    // The first end is the one: an error comes before its `end`, and a stop before its `aborted`
    const finish = (end: ListeningEnd) => {
      if (done) return;
      done = true;
      resolveEnd(end);
    };
    const Recognition = this.Recognition;
    if (!Recognition) {
      finish('service-unavailable');
      return { stop: () => undefined, ended };
    }
    const recognition = new Recognition();
    recognition.lang = RECOGNITION_LANGS[language];
    recognition.continuous = true;
    recognition.interimResults = true;
    if (this.onDevice.has(language)) recognition.processLocally = true;
    recognition.onresult = (event) => {
      if (done) return;
      let understanding = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? '';
        if (!result.isFinal) understanding += text;
        else if (text.trim()) heard({ text: text.trim(), final: true });
      }
      if (understanding.trim()) heard({ text: understanding.trim(), final: false });
    };
    recognition.onerror = (event) => finish(ERROR_ENDS[event.error] ?? 'service-unavailable');
    // Without an error, an end nobody asked for is the browser hearing nothing more
    recognition.onend = () => finish('silence');
    try {
      recognition.start();
    } catch {
      finish('service-unavailable');
    }
    return {
      // Aborted, not stopped: what it was still understanding stays as it is, and nothing comes later
      stop: () => {
        finish('stopped');
        recognition.abort();
      },
      ended,
    };
  }
}

/** The options to ask about, or download, the recognition of a language on the device. */
function onDevice(language: AppLocale): RecognitionOptions {
  return { langs: [RECOGNITION_LANGS[language]], processLocally: true };
}
