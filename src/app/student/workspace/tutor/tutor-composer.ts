import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { Component, computed, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, submit } from '@angular/forms/signals';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';

import { LanguageService } from '../../../core/i18n/language-service';
import type {
  Listening,
  ListeningEnd,
  ListenError,
  Transcript,
} from '../../../core/speech/speech-service';
import { createDebouncer } from '../../../shared/create-debouncer';
import { SettingsStore } from '../../settings/settings-store';
import { StudentVoice } from '../../settings/student-voice';
import { TutorSpeaker } from '../tutor-speaker';
import { TutorStore } from '../tutor-store';
import { appendDictation } from './append-dictation';
import { AudioNotice } from './audio-notice';
import { listenErrorMessage } from './listen-error-message';

/** Longest question, which keeps the requests to the tutor short (2.6). */
export const MAX_QUESTION_LENGTH = 500;

/** Silence that ends the dictation: the student has finished saying the question (2.11). */
export const DICTATION_SILENCE_MS = 8000;

/** From this length on, the field counts the characters, so the limit never comes as a surprise. */
const COUNTER_FROM = 400;

/**
 * The field to ask the tutor (RF-05), in writing or dictated (RF-08, 2.11). Intro sends and Mayús +
 * Intro starts a new line, as in other chats. The field empties on sending, so the next question can
 * be written while the tutor answers; if the answer fails, the question stays in the conversation,
 * ready to retry. What is dictated goes after what is written and is never sent alone: the student
 * reviews it and sends it. «Dictar» is offered only where the tutor has a voice (not in the
 * teacher's preview) and the browser can recognise speech.
 */
@Component({
  selector: 'app-tutor-composer',
  imports: [
    AudioNotice,
    CdkTextareaAutosize,
    FormRoot,
    FormField,
    MatFormField,
    MatLabel,
    MatHint,
    MatSuffix,
    MatInput,
    MatIconButton,
    MatIcon,
    MatTooltip,
  ],
  templateUrl: './tutor-composer.html',
  host: { '(document:visibilitychange)': 'stopIfHidden()' },
})
export class TutorComposer {
  private readonly store = inject(TutorStore);
  /** Only on the student's screen: its presence is what offers the voice. */
  private readonly speaker = inject(TutorSpeaker, { optional: true });
  private readonly voice = inject(StudentVoice);
  private readonly settings = inject(SettingsStore);
  private readonly locale = inject(LanguageService).locale;
  private readonly document = inject(DOCUMENT);

  protected readonly maxLength = MAX_QUESTION_LENGTH;
  protected readonly counterFrom = COUNTER_FROM;
  protected readonly dictateTooltip = $localize`:@@tutor.dictate:Dictar`;
  protected readonly stopDictatingTooltip = $localize`:@@tutor.dictate.stop:Dejar de dictar`;

  protected readonly model = signal({ message: '' });
  protected readonly questionForm = form(
    this.model,
    (path) => {
      maxLength(path.message, MAX_QUESTION_LENGTH);
    },
    {
      submission: {
        action: async (field) => {
          const { message } = field().value();
          if (!this.canSend()) return undefined;
          this.stopDictation();
          // As the Angular guide does after a submission: empty, and untouched again
          field().reset({ message: '' });
          // Not awaited: the field is free for the next question while the tutor answers
          void this.store.ask(message);
          return undefined;
        },
      },
    },
  );

  protected readonly length = computed(() => this.model().message.length);
  protected readonly canSend = computed(
    () => this.store.canAsk() && this.model().message.trim() !== '' && this.questionForm().valid(),
  );

  protected readonly canDictate = computed(() => this.speaker !== null && this.voice.canDictate());
  protected readonly dictating = signal(false);
  protected readonly dictationError = signal<ListenError | null>(null);
  protected readonly noticeOpen = signal(false);
  /** The dictation ended in silence without the browser giving any text: said gently, not an error. */
  protected readonly nothingHeard = signal(false);
  /** Whether the browser gave any text in this dictation. */
  private heardAny = false;
  /** The open microphone; null in silence. */
  private listening: Listening | null = null;
  /** What the field holds before what is still being understood: written, or dictated and final. */
  private written = '';
  private readonly silence = createDebouncer(DICTATION_SILENCE_MS);
  private readonly stopOnSilence = () => {
    this.stopDictation();
    this.sayIfNothingHeard();
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopDictation());
  }

  focus(): void {
    this.questionForm.message().focusBoundControl();
  }

  /** Intro sends; with Mayús, or while an input method composes a character, it is a new line. */
  protected sendOnEnter(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    event.preventDefault();
    void submit(this.questionForm);
  }

  /** «Dictar»: starts, or stops; the first time the audio leaves the device, the notice first. */
  protected toggleDictation(): void {
    if (this.dictating()) this.stopDictation();
    else if (this.voice.needsAudioNotice()) this.noticeOpen.set(true);
    else this.startDictation();
    this.focus();
  }

  /** «Entendido»: not again for this student, and the dictation starts. */
  protected acceptNotice(): void {
    this.settings.setAudioNoticeSeen();
    this.noticeOpen.set(false);
    this.startDictation();
    this.focus();
  }

  /** Only the keyboard fires `input`: typing takes over from the dictation. */
  protected typed(): void {
    this.stopDictation();
    this.dictationError.set(null);
    this.nothingHeard.set(false);
  }

  /** Esc stops the dictation, and only that: the floating tutor stays open. */
  protected escape(event: Event): void {
    if (!this.dictating()) return;
    event.stopPropagation();
    this.stopDictation();
  }

  /** A hidden tab closes the microphone: it is never open out of the student's sight. */
  protected stopIfHidden(): void {
    if (this.document.visibilityState === 'hidden') this.stopDictation();
  }

  protected errorMessage(error: ListenError): string {
    return listenErrorMessage(error, this.locale);
  }

  private startDictation(): void {
    // The microphone would take down what the tutor says
    this.speaker?.stop();
    this.dictationError.set(null);
    this.nothingHeard.set(false);
    this.heardAny = false;
    this.written = this.model().message;
    const listening = this.voice.listen((transcript) => this.hear(transcript));
    if (!listening) return;
    this.listening = listening;
    this.dictating.set(true);
    this.silence.schedule(this.stopOnSilence);
    void listening.ended.then((end) => this.ended(listening, end));
  }

  private hear({ text, final }: Transcript): void {
    this.heardAny = true;
    const message = appendDictation(this.written, text, MAX_QUESTION_LENGTH);
    this.model.update((value) => ({ ...value, message }));
    if (final) this.written = message;
    this.silence.schedule(this.stopOnSilence);
  }

  /** The browser ended it: what it was understanding stays in the field, and an error is said. */
  private ended(listening: Listening, end: ListeningEnd): void {
    if (this.listening !== listening) return;
    this.close();
    if (end === 'silence') this.sayIfNothingHeard();
    else if (end !== 'stopped') this.dictationError.set(end);
  }

  /**
   * A browser may hear the voice and give no text (seen in Chrome 157): without a word, it would
   * look as if dictating did nothing. Stopping by hand is the student's choice, so it says nothing.
   */
  private sayIfNothingHeard(): void {
    if (!this.heardAny) this.nothingHeard.set(true);
  }

  private stopDictation(): void {
    const listening = this.listening;
    if (!listening) return;
    this.close();
    listening.stop();
  }

  private close(): void {
    this.listening = null;
    this.dictating.set(false);
    this.silence.cancel();
  }
}
