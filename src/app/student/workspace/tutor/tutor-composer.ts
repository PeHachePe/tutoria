import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, submit } from '@angular/forms/signals';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';

import { TutorStore } from '../tutor-store';

/** Longest question, which keeps the requests to the tutor short (2.6). */
export const MAX_QUESTION_LENGTH = 500;

/** From this length on, the field counts the characters, so the limit never comes as a surprise. */
const COUNTER_FROM = 400;

/**
 * The field to ask the tutor in writing (RF-05). Intro sends and Mayús + Intro starts a new line, as
 * in other chats. The field empties on sending, so the next question can be written while the tutor
 * answers; if the answer fails, the question stays in the conversation, ready to retry.
 */
@Component({
  selector: 'app-tutor-composer',
  imports: [
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
  template: `
    <form [formRoot]="questionForm">
      <mat-form-field class="w-full">
        <mat-label i18n="@@tutor.question">Pregunta al tutor</mat-label>
        <textarea
          matInput
          cdkTextareaAutosize
          cdkAutosizeMinRows="1"
          cdkAutosizeMaxRows="4"
          [formField]="questionForm.message"
          (keydown.enter)="sendOnEnter($event)"
        ></textarea>
        <button
          matIconButton
          matSuffix
          type="submit"
          aria-label="Enviar la pregunta"
          i18n-aria-label="@@tutor.send"
          matTooltip="Enviar"
          i18n-matTooltip="@@tutor.sendTooltip"
          disabledInteractive
          [disabled]="!canSend()"
        >
          <mat-icon>send</mat-icon>
        </button>
        <mat-hint i18n="@@tutor.enterHint">Intro para enviar; Mayús + Intro, nueva línea</mat-hint>
        <!-- The field gets maxlength from the schema, so the count is all the student needs -->
        @if (length() >= counterFrom) {
          <mat-hint align="end">{{ length() }}/{{ maxLength }}</mat-hint>
        }
      </mat-form-field>
    </form>
  `,
})
export class TutorComposer {
  private readonly store = inject(TutorStore);

  protected readonly maxLength = MAX_QUESTION_LENGTH;
  protected readonly counterFrom = COUNTER_FROM;

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
}
