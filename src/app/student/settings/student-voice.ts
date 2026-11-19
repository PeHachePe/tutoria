import { computed, inject, resource, Service, type Signal } from '@angular/core';

import { LanguageService } from '../../core/i18n/language-service';
import { SpeechLoader } from '../../core/speech/speech-loader';
import type { SpeechService, SpeechVoice } from '../../core/speech/speech-service';
import { SettingsStore } from './settings-store';

/** What «Probar» says with each voice. */
const SAMPLE = $localize`:@@settings.voice.sample:Hola, soy tu tutor. ¿Seguimos con el ejercicio?`;

/**
 * The student's voice settings joined with what the browser can do (2.11, D-071): it loads the
 * speech only with the voice on, gives the voices of the interface's language and the chosen one
 * while it still exists. Not a store: it keeps no state of its own. The settings, the chat and,
 * later, the dictation and the call use it.
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
  /** The voices of the language of the interface; none until they load. */
  readonly voices: Signal<readonly SpeechVoice[]> = this.voicesResource.value;
  readonly voicesLoading = computed(
    () => this.speechResource.isLoading() || this.voicesResource.isLoading(),
  );
  /** The voice is on and the browser has voices of the language: «Escuchar» is offered. */
  readonly canSpeak = computed(() => this.settings.voice() && this.voices().length > 0);
  /** The voice the student chose, if the browser still has it in this language. */
  readonly tutorVoice = computed(() =>
    this.voices().find((voice) => voice.id === this.settings.tutorVoice()),
  );

  /** Says a sentence with the chosen voice and rate; `cancelled` without one. Rejects with a SpeechError. */
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
    try {
      await speech.speak(SAMPLE, { voiceId, rate: this.settings.speechRate() });
    } catch {
      // A sample that fails is only silence: the list is still there to try another voice
    }
  }

  stop(): void {
    this.speech()?.stopSpeaking();
  }
}
