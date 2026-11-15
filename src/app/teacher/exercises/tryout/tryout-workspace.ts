import { afterNextRender, Component, ElementRef, inject, output } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { EventLogger } from '../../../core/event-logger';
import { LanguageService } from '../../../core/i18n/language-service';
import { declareAppTool } from '../../../core/tools/app-tool';
import { AttemptService } from '../../../data/attempt-service';
import { CodeRunnerService } from '../../../data/code-runner-service';
import { EventService } from '../../../data/event-service';
import { type ContentLocale, exerciseText } from '../../../data/localized-text';
import { TutorService } from '../../../data/tutor-service';
import { DifficultyChip } from '../../../shared/difficulty-chip/difficulty-chip';
import { StatusChip } from '../../../shared/status-chip/status-chip';
import { AttemptStore } from '../../../student/workspace/attempt-store';
import { BrowserSignals } from '../../../student/workspace/browser-signals';
import { EditingTab } from '../../../student/workspace/editing-tab';
import { TutorStore } from '../../../student/workspace/tutor-store';
import { WorkspaceLayout } from '../../../student/workspace/workspace-layout';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TryoutCodeRunner } from './tryout-code-runner';
import { TryoutEventService } from './tryout-event-service';
import { TRYOUT_ASSIGNMENT_ID, TRYOUT_EXERCISE, type TryoutExercise } from './tryout-exercise';
import { tryoutTools } from './tryout-tools';
import { TryoutTutorService } from './tryout-tutor-service';

/** The heading of the try, which names the dialog. */
export const TRYOUT_HEADING_ID = 'tryout-heading';

/**
 * A teacher's try of an exercise as a student (4.3e, D-061): the workspace itself, with its zones
 * and stores, over services that keep the try in memory instead of the server. The code runs on the
 * server against the tests of the form, and the tutor answers in preview mode; nothing is kept.
 * Everything is provided here, so starting again is creating it again.
 */
@Component({
  selector: 'app-tryout-workspace',
  imports: [
    MatButton,
    MatIconButton,
    MatDialogClose,
    MatIcon,
    MatTooltip,
    DifficultyChip,
    StatusChip,
    WorkspaceLayout,
  ],
  providers: [
    { provide: TRYOUT_EXERCISE, useExisting: MAT_DIALOG_DATA },
    TryoutAttemptService,
    { provide: AttemptService, useExisting: TryoutAttemptService },
    { provide: CodeRunnerService, useClass: TryoutCodeRunner },
    { provide: TutorService, useClass: TryoutTutorService },
    { provide: EventService, useClass: TryoutEventService },
    // Its own logger, so the pastes and absences of the try go to the service of the try
    EventLogger,
    AttemptStore,
    EditingTab,
    TutorStore,
    BrowserSignals,
  ],
  template: `
    <!-- Out of <main>, a <header> would be a banner of the whole page: the section scopes them -->
    <section class="flex min-h-0 flex-1 flex-col gap-4" [attr.aria-labelledby]="headingId">
      <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          matIconButton
          type="button"
          mat-dialog-close
          aria-label="Cerrar la vista previa"
          i18n-aria-label="@@tryout.close"
          matTooltip="Cerrar la vista previa"
          i18n-matTooltip="@@tryout.closeTooltip"
        >
          <mat-icon>close</mat-icon>
        </button>
        <div class="flex min-w-0 flex-1 flex-col">
          <p class="text-label-large text-on-surface-variant" i18n="@@tryout.eyebrow">
            Probar como alumno
          </p>
          <h2
            [id]="headingId"
            tabindex="-1"
            class="line-clamp-2 text-title-medium outline-none sm:text-headline-small"
            [attr.lang]="heading.lang"
          >
            {{ heading.title }}
          </h2>
        </div>
        <div class="flex w-full flex-wrap items-center gap-2 ps-12 sm:w-auto sm:ps-0">
          <app-difficulty-chip [difficulty]="exercise.content.exercise.difficulty" />
          @if (store.attempt()) {
            <app-status-chip [status]="store.status()" [testCount]="store.testCount()" />
          }
          <button matButton type="button" (click)="startAgain.emit()">
            <mat-icon>restart_alt</mat-icon>
            <span i18n="@@tryout.startAgain">Empezar de nuevo</span>
          </button>
        </div>
      </header>
      <p
        class="flex items-center gap-2 rounded-lg bg-info-container px-3 py-2 text-body-medium text-on-info-container"
      >
        <mat-icon class="shrink-0" aria-hidden="true">science</mat-icon>
        <!-- On phones only the essential, so the zones keep the screen -->
        <span class="hidden sm:inline" i18n="@@tryout.note"
          >Vista previa del ejercicio tal como está en el formulario: escribe, ejecuta y pide pistas
          como un alumno. No se guarda nada.</span
        >
        <span class="sm:hidden" i18n="@@tryout.noteShort">Vista previa: no se guarda nada.</span>
      </p>
      <app-workspace-layout
        [detail]="exercise.content"
        [exercise]="exercise.content.exercise"
        [preview]="true"
      />
    </section>
  `,
  // Material shows the host of the dialog's component as `display: contents`: the layout goes here
  host: { class: 'flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6' },
})
export class TryoutWorkspace {
  /** «Empezar de nuevo»: the dialog creates the try again, empty. */
  readonly startAgain = output<void>();

  protected readonly exercise = inject(TRYOUT_EXERCISE);
  protected readonly store = inject(AttemptStore);
  protected readonly headingId = TRYOUT_HEADING_ID;
  private readonly locale = inject(LanguageService).locale;
  /** The title in the language of the interface, or in the source one with its `lang` (D-045). */
  protected readonly heading = titleIn(this.exercise, this.locale);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    // The tools of the workspace, for the tutor of the try, while it is open (2.5e)
    for (const tool of tryoutTools()) declareAppTool(tool);
    // In memory: it opens at once and never fails
    void this.store.open(TRYOUT_ASSIGNMENT_ID);
    // On opening and after starting again, the focus goes to the heading, as on a new screen (5.4)
    afterNextRender(() => this.host.querySelector<HTMLElement>(`#${this.headingId}`)?.focus());
  }
}

function titleIn(
  { content }: TryoutExercise,
  locale: ContentLocale,
): { readonly title: string; readonly lang: ContentLocale | null } {
  const text = exerciseText(content.exercise, locale);
  return { title: text.title, lang: text.locale === locale ? null : text.locale };
}
