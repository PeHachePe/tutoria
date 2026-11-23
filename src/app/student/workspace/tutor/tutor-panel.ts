import { DatePipe, formatDate } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { AuthStore } from '../../../auth/auth-store';
import { LanguageService } from '../../../core/i18n/language-service';
import { MAX_HINT_LEVEL, raisesHintLevel } from '../../../data/tutor';
import { Mascot, type MascotMood } from '../../../shared/mascot/mascot';
import { LoadingSkeleton } from '../../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { SettingsStore } from '../../settings/settings-store';
import { StudentVoice } from '../../settings/student-voice';
import { AttemptStore } from '../attempt-store';
import { TutorSpeaker } from '../tutor-speaker';
import { TutorStore, type TutorTurn } from '../tutor-store';
import { type CallNotice, VoiceCall } from '../voice-call';
import { AudioNotice } from './audio-notice';
import { CallBar } from './call-bar';
import { HINT_LEVELS, HintLevelMeter } from './hint-level-meter';
import { TutorComposer } from './tutor-composer';
import { TutorActions } from './tutor-actions';
import { TutorMessage } from '../../../shared/tutor-message/tutor-message';
import { RetryButton } from '../../../shared/retry-button/retry-button';
import { isSessionExpired, SignInAgain } from '../../../shared/sign-in-again/sign-in-again';
import { listenErrorMessage } from './listen-error-message';
import { tutorErrorMessage } from './tutor-error-message';
import { GUIDE_ANCHORS, GuideAnchor } from '../../../core/guide/guide-anchor';

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
    GuideAnchor,
    DatePipe,
    MatButton,
    RetryButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    Mascot,
    LoadingSkeleton,
    Skeleton,
    HintLevelMeter,
    TutorComposer,
    TutorMessage,
    TutorActions,
    SignInAgain,
    AudioNotice,
    CallBar,
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
  protected readonly anchors = GUIDE_ANCHORS;
  /** Phones: a tab of its own, which names it. */
  readonly compact = input(false);
  /**
   * What the dock button offers: to float the tutor over the code, to fix it in its column again,
   * or nothing (phones, and tablets, where the column does not fit).
   */
  readonly dock = input<'none' | 'float' | 'fix'>('none');
  readonly dockChange = output<void>();
  /** Floating, it offers to fold back into the mascot. */
  readonly minimizable = input(false);
  readonly minimize = output<void>();

  protected readonly store = inject(TutorStore);
  /** The tutor's voice; none in the teacher's preview (D-061). */
  protected readonly speaker = inject(TutorSpeaker, { optional: true });
  /** The call with the tutor (6.1c); none in the teacher's preview either. */
  protected readonly call = inject(VoiceCall, { optional: true });
  private readonly voice = inject(StudentVoice);
  private readonly settings = inject(SettingsStore);
  private readonly language = inject(LanguageService).locale;
  private readonly injector = inject(Injector);
  protected readonly isSessionExpired = isSessionExpired;
  private readonly attempt = inject(AttemptStore);
  private readonly user = inject(AuthStore).user;
  private readonly locale = inject(LOCALE_ID);
  /** The code as it is now: a fix of the tutor is shown against it (2.5f). */
  protected readonly code = computed(() => this.attempt.attempt()?.currentCode);

  protected readonly skeletonBubbles = SKELETON_BUBBLES;
  /** Offered too under a refusal to give the solution (D-044). */
  protected readonly statementSuggestion = SUGGESTIONS.statement;
  protected readonly maxHintLevel = MAX_HINT_LEVEL;

  protected readonly dockLabel = computed(() =>
    this.dock() === 'float'
      ? $localize`:@@tutor.float:Hacer flotante el tutor`
      : $localize`:@@tutor.fix:Fijar el tutor a la derecha`,
  );

  /** The student is writing to the tutor: the mascot listens, with its tongue out. */
  protected readonly composing = signal(false);

  private readonly reactionMode = this.settings.reactions;
  /** The mascot moves with the emotion of each new answer (1.8), unless the reactions are off. */
  protected readonly mascotReaction = computed(() =>
    this.reactionMode() === 'off' ? null : this.store.reaction(),
  );

  protected readonly mascotMood = computed<MascotMood>(() => {
    // Speaking wins: an answer read aloud while it still arrives is already being said
    if (this.speaker?.speakingTurnId()) return 'speaking';
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

  /**
   * Each turn with the day over the first of each day, and whether it got more help without a hint
   * being asked, for being stuck again (2.5d).
   */
  protected readonly items = computed(() => {
    let lastDay = '';
    const turns = this.store.turns();
    return turns.map((turn, index) => {
      const day = new Date(turn.createdAt).toDateString();
      const dayLabel = day === lastDay ? null : this.dayLabel(turn.createdAt);
      lastDay = day;
      return { turn, dayLabel, raised: raisesHintLevel(turn, turns.slice(0, index)) };
    });
  });

  protected readonly callLabel = $localize`:@@call.start:Llamar al tutor`;
  protected readonly ongoingLabel = $localize`:@@call.ongoing:En llamada`;
  /** Where the audio goes, said before the first call as before the first dictation (2.11). */
  protected readonly callNoticeOpen = signal(false);

  private readonly composer = viewChild<TutorComposer>('composer');
  private readonly callButton = viewChild('callButton', { read: ElementRef<HTMLElement> });
  private readonly conversation = viewChild.required<ElementRef<HTMLElement>>('conversation');

  /** Ready to write: the question field, or the conversation of a submitted attempt, to read it. */
  focusQuestion(): void {
    const composer = this.composer();
    if (composer) {
      composer.focus();
    } else {
      this.conversation().nativeElement.focus();
    }
  }

  /** «Llamar al tutor»: the first time the audio leaves the device, the notice first. */
  protected startCall(): void {
    // «En llamada» is disabled but reachable, so the click still arrives
    if (this.call?.active()) return;
    if (this.voice.needsAudioNotice()) this.callNoticeOpen.set(true);
    else this.call?.start();
  }

  /** «Entendido»: not again for this student, and the call starts. */
  protected acceptCallNotice(): void {
    this.settings.setAudioNoticeSeen();
    this.callNoticeOpen.set(false);
    this.call?.start();
  }

  /** «Corregir»: what was said goes into the field, with the focus, to correct it and send it. */
  protected correctCall(call: VoiceCall, composer: TutorComposer): void {
    composer.insert(call.correct());
    composer.focus();
  }

  /** «Colgar»: the focus goes back to «Llamar al tutor», as the bar that had it is gone. */
  protected hangUp(): void {
    this.call?.hangUp();
    afterNextRender(() => this.callButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected callNoticeMessage(notice: CallNotice): string {
    return notice === 'unstable'
      ? $localize`:@@call.unstable:La llamada se ha cortado: el micrófono se cierra solo. Puedes volver a llamar o seguir escribiendo.`
      : listenErrorMessage(notice, this.language);
  }

  protected errorMessage(turn: TutorTurn): string {
    return tutorErrorMessage(turn.error);
  }

  protected ask(question: string): void {
    void this.store.ask(question);
  }

  protected requestHint(): void {
    void this.store.requestHint();
  }

  /** «Escuchar» says that answer; «Parar» silences it. */
  protected toggleListen(turnId: string): void {
    if (this.speaker?.speakingTurnId() === turnId) this.speaker.stop();
    else this.speaker?.listen(turnId);
  }

  protected retry(turn: TutorTurn): void {
    void this.store.retry(turn.id);
  }

  /** The student pressed the button of an action of the tutor (2.5e). */
  protected runAction(turn: TutorTurn, index: number): void {
    void this.store.runAction(turn.id, index);
  }

  protected undoAction(turn: TutorTurn, index: number): void {
    void this.store.undoAction(turn.id, index);
  }

  private dayLabel(createdAt: string): string {
    return new Date(createdAt).toDateString() === new Date().toDateString()
      ? $localize`:@@tutor.today:Hoy`
      : formatDate(createdAt, 'longDate', this.locale);
  }
}
