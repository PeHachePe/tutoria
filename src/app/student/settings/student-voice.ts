import { computed, effect, inject, resource, Service, type Signal, signal } from '@angular/core';

import { LanguageService } from '../../core/i18n/language-service';
import { SpeechLoader } from '../../core/speech/speech-loader';
import type { SpeechService, SpeechVoice } from '../../core/speech/speech-service';
import { SettingsStore } from './settings-store';

/** What «Probar» says with each voice. */
const SAMPLE = $localize`:@@settings.voice.sample:Hola, soy tu tutor. ¿Seguimos con el ejercicio?`;

/**
 * The student's voice settings joined with what the browser can do (2.11, D-071): it loads the
 * speech only with the voice on, gives the voices of the interface's language, the most natural
 * first, and the tutor's: the chosen one while it still exists, or else the most natural (D-078).
 * Not a store: it keeps no state but what is being tried. The settings, the chat and, later, the
 * dictation and the call use it.
 */
@Service()
export class StudentVoice {
  private readonly settings = inject(SettingsStore);
  private readonly loader = inject(SpeechLoader);
  private readonly locale = inject(LanguageService).locale;

  private readonly speechResource = resource({
    params: () => (this.settings.voice() ? true : undefined),
    // Without the code (offline, a stale chunk), the voice stays silent: everything is written
    loader: () => this.loader.load().catch(() => undefined),
  });
  private readonly voicesResource = resource({
    params: () => this.speechResource.value(),
    loader: ({ params }) => params.voices(this.locale).catch(() => []),
    defaultValue: [],
  });

  /** The speech of the browser, loaded only with the voice on; undefined until then. */
  readonly speech: Signal<SpeechService | undefined> = this.speechResource.value;
  /** The voices of the language of the interface, the most natural first; none until they load. */
  readonly voices: Signal<readonly SpeechVoice[]> = this.voicesResource.value;
  /** Looking for the voices the first time; a change of them reloads the list in the background. */
  readonly voicesLoading = computed(
    () => this.speechResource.isLoading() || this.voicesResource.status() === 'loading',
  );
  /** The voice is on and the browser has voices of the language: «Escuchar» is offered. */
  readonly canSpeak = computed(() => this.settings.voice() && this.voices().length > 0);
  /** The voice the student chose, if the browser still has it in this language. */
  private readonly chosenVoice = computed(() =>
    this.voices().find((voice) => voice.id === this.settings.tutorVoice()),
  );
  /** The student chose the voice; if not, the tutor speaks with the most natural one (D-078). */
  readonly chosen = computed(() => this.chosenVoice() !== undefined);
  /** The voice of the tutor: the chosen one, or the most natural of the language. */
  readonly tutorVoice = computed(() => this.chosenVoice() ?? this.voices()[0]);

  private readonly samplingState = signal<string | null>(null);
  /** The voice being tried with «Probar», to offer stopping it; null in silence. */
  readonly sampling = this.samplingState.asReadonly();
  /** Grows with each «Probar», so only the latest one ends the trying. */
  private samples = 0;

  constructor() {
    // Boundary with Web Speech (4.8): the browser tells when its voices change (one downloaded with
    // the page open, as the settings suggest), and the list follows without reloading the page
    effect((onCleanup) => {
      const speech = this.speech();
      if (speech) onCleanup(speech.onVoicesChanged(() => this.voicesResource.reload()));
    });
  }

  /**
   * Says a sentence with the tutor's voice and rate; `cancelled` without one. Rejects with a
   * SpeechError.
   */
  async say(sentence: string): Promise<'ended' | 'cancelled'> {
    const speech = this.speech();
    const voice = this.tutorVoice();
    if (!speech || !voice) return 'cancelled';
    return speech.speak(sentence, { voiceId: voice.id, rate: this.settings.speechRate() });
  }

  /** «Probar»: stops what sounds and says the sample with that voice; never rejects. */
  async sample(voiceId: string): Promise<void> {
    const speech = this.speech();
    if (!speech) return;
    speech.stopSpeaking();
    const run = ++this.samples;
    this.samplingState.set(voiceId);
    try {
      await speech.speak(SAMPLE, { voiceId, rate: this.settings.speechRate() });
    } catch {
      // A sample that fails is only silence: the list is still there to try another voice
    }
    // Another sample may have started meanwhile, even of the same voice: that one is still sounding
    if (run === this.samples) this.samplingState.set(null);
  }

  stop(): void {
    this.samplingState.set(null);
    this.speech()?.stopSpeaking();
  }
}
