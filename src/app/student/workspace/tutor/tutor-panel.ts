import { DatePipe, formatDate } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { AuthStore } from '../../../auth/auth-store';
import { MAX_HINT_LEVEL } from '../../../data/tutor';
import { Mascot, type MascotMood } from '../../../shared/mascot/mascot';
import { LoadingSkeleton } from '../../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { splitInlineCode } from '../../../shared/split-inline-code';
import { AttemptStore } from '../attempt-store';
import { TutorStore, type TutorTurn } from '../tutor-store';
import { HINT_LEVELS, HintLevelMeter } from './hint-level-meter';
import { TutorComposer } from './tutor-composer';
import { tutorErrorMessage } from './tutor-error-message';

/** Questions the empty chat suggests, so nobody has to think how to start. */
const SUGGESTIONS = {
  start: $localize`:@@tutor.suggestion.start:¿Por dónde empiezo?`,
  failing: $localize`:@@tutor.suggestion.failing:¿Por qué falla una de las pruebas?`,
  improve: $localize`:@@tutor.suggestion.improve:¿Se puede mejorar mi código?`,
  statement: $localize`:@@tutor.suggestion.statement:No entiendo el enunciado`,
};

/** Bubbles drawn while the conversation loads. */
const SKELETON_BUBBLES = ['w-3/4 self-start', 'w-1/2 self-end', 'w-2/3 self-start'];

/**
 * The tutor zone of the workspace (ficha 04): the chat with the tutor (RF-05, CU-02). The student asks
 * in writing or asks for a hint, which gets more concrete with each level (2.6); the answers appear
 * as they arrive and are read aloud once complete. The mascot listens while the student writes and
 * tilts its head while the tutor thinks. A submitted attempt keeps its conversation to read.
 */
@Component({
  selector: 'app-tutor-panel',
  imports: [
    DatePipe,
    MatButton,
    MatIcon,
    MatTooltip,
    Mascot,
    LoadingSkeleton,
    Skeleton,
    HintLevelMeter,
    TutorComposer,
  ],
  templateUrl: './tutor-panel.html',
  host: {
    role: 'region',
    'aria-labelledby': 'tutor-heading',
    class: 'flex min-h-0 flex-col gap-3 rounded-xl bg-panel p-4',
    '[class.h-full]': 'compact()',
  },
})
export class TutorPanel {
  /** Phones: a tab of its own, which names it. */
  readonly compact = input(false);

  protected readonly store = inject(TutorStore);
  private readonly attempt = inject(AttemptStore);
  private readonly user = inject(AuthStore).user;
  private readonly locale = inject(LOCALE_ID);

  protected readonly skeletonBubbles = SKELETON_BUBBLES;
  protected readonly maxHintLevel = MAX_HINT_LEVEL;

  /** The student is writing to the tutor: the mascot listens, with its tongue out. */
  protected readonly composing = signal(false);

  protected readonly mascotMood = computed<MascotMood>(() => {
    if (this.store.answering()) return 'thinking';
    return this.composing() ? 'chat' : 'idle';
  });

  protected readonly greeting = computed(() => {
    const firstName = this.user()?.name.split(' ')[0];
    return firstName
      ? $localize`:@@tutor.greeting:¡Hola, ${firstName}:name:!`
      : $localize`:@@tutor.greetingNoName:¡Hola!`;
  });

  /** What «Pedir pista» will give, said before asking. */
  protected readonly hintTooltip = computed(() => {
    const next = this.store.nextHintLevel();
    return this.store.hintLevel() === MAX_HINT_LEVEL
      ? $localize`:@@tutor.hintTooltip.max:Ya estás en el nivel más concreto: ${HINT_LEVELS[next].promise}:promise:`
      : $localize`:@@tutor.hintTooltip:Nivel ${next}:level:: ${HINT_LEVELS[next].promise}:promise:`;
  });

  /** A suggestion that fits the moment, and one about the statement. */
  protected readonly suggestions = computed(() => {
    switch (this.attempt.status()) {
      case 'passed':
        return [SUGGESTIONS.improve, SUGGESTIONS.statement];
      case 'tests_failed':
        return [SUGGESTIONS.failing, SUGGESTIONS.statement];
      default:
        return [SUGGESTIONS.start, SUGGESTIONS.statement];
    }
  });

  /** Each turn with its answer split around `inline code`, and the day over the first of each day. */
  protected readonly items = computed(() => {
    let lastDay = '';
    return this.store.turns().map((turn) => {
      const day = new Date(turn.createdAt).toDateString();
      const dayLabel = day === lastDay ? null : this.dayLabel(turn.createdAt);
      lastDay = day;
      return { turn, dayLabel, parts: splitInlineCode(turn.answer) };
    });
  });

  protected errorMessage(turn: TutorTurn): string {
    return tutorErrorMessage(turn.error);
  }

  protected ask(question: string): void {
    void this.store.ask(question);
  }

  protected requestHint(): void {
    void this.store.requestHint();
  }

  protected retry(turn: TutorTurn): void {
    void this.store.retry(turn.id);
  }

  private dayLabel(createdAt: string): string {
    return new Date(createdAt).toDateString() === new Date().toDateString()
      ? $localize`:@@tutor.today:Hoy`
      : formatDate(createdAt, 'longDate', this.locale);
  }
}
