import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import type { ToolRequest } from '../../data/tutor';
import { TutorMessage } from '../../shared/tutor-message/tutor-message';
import type { TimelineEntry } from './attempt-timeline';
import { formatDuration } from './format-duration';

/** What the tutor did with each of its tools, as the teacher reads it (2.5e, 2.5f). */
const TOOL_LABELS: Record<string, string> = {
  getMyProgress: $localize`:@@detail.tool.progress:consultó su progreso`,
  searchExercises: $localize`:@@detail.tool.exercises:buscó ejercicios`,
  getExerciseStats: $localize`:@@detail.tool.stats:consultó sus intentos`,
  getSettings: $localize`:@@detail.tool.settings:consultó sus ajustes`,
  openExercise: $localize`:@@detail.tool.open:ofreció abrir otro ejercicio`,
  navigate: $localize`:@@detail.tool.navigate:ofreció ir a otra pantalla`,
  highlightLines: $localize`:@@detail.tool.highlight:resaltó líneas del código`,
  pointAt: $localize`:@@detail.tool.point:señaló algo en la pantalla`,
  setLayout: $localize`:@@detail.tool.layout:cambió la disposición`,
  updateSettings: $localize`:@@detail.tool.updateSettings:cambió sus ajustes`,
  insertSkeleton: $localize`:@@detail.tool.skeleton:ofreció el esqueleto de la función`,
  formatCode: $localize`:@@detail.tool.format:ofreció formatear el código`,
  runTests: $localize`:@@detail.tool.run:ofreció ejecutar las pruebas`,
  submitAttempt: $localize`:@@detail.tool.submit:ofreció entregar`,
  proposeFix: $localize`:@@detail.tool.fix:propuso corregir un error de escritura`,
};

const MINUTE_MS = 60_000;

/** Material Symbols of each kind of entry, so none says it only with its colour. */
const ICONS = {
  start: 'flag',
  run: 'science',
  passed: 'task_alt',
  question: 'chat',
  hint: 'lightbulb',
  proactive: 'campaign',
  silent: 'notifications_off',
  paste: 'content_paste',
  away: 'visibility_off',
  submit: 'send',
} as const;

function iconOf(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'run':
      return entry.passed === entry.total ? ICONS.passed : ICONS.run;
    case 'tutor':
      return ICONS[entry.interaction.trigger];
    case 'proactive':
      return entry.silent ? ICONS.silent : ICONS.proactive;
    default:
      return ICONS[entry.kind];
  }
}

/** «ofreció ejecutar las pruebas, resaltó líneas del código»: what the tutor did with its tools. */
function toolsText(actions: readonly ToolRequest[]): string {
  return actions.map((action) => TOOL_LABELS[action.name] ?? action.name).join(', ');
}

/**
 * The timeline of an attempt (RF-12), oldest first: each entry with its time (and its day when it
 * changes), what happened and, before it, the long silence that preceded it.
 */
@Component({
  selector: 'app-attempt-timeline-list',
  imports: [DatePipe, MatIcon, TutorMessage],
  template: `
    <ol class="flex flex-col" [attr.aria-label]="label()">
      @for (item of items(); track item.entry.id) {
        @let entry = item.entry;
        <li class="flex flex-col">
          @if (item.gap !== null) {
            <p
              class="my-1 ms-12 flex items-center gap-2 text-label-medium text-on-surface-variant"
              i18n="@@detail.gap"
            >
              {{ duration(item.gap) }} sin actividad
            </p>
          }
          <div
            class="flex gap-3 py-2"
            [class]="item.arrived ? 'animate-live-in motion-reduce:animate-none' : ''"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
              aria-hidden="true"
            >
              <span class="material-symbols-outlined text-[1.25rem]">{{ item.icon }}</span>
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p class="flex flex-wrap items-baseline gap-x-2">
                <time
                  class="text-label-large text-on-surface-variant tabular-nums"
                  [attr.datetime]="item.iso"
                >
                  @if (item.newDay) {
                    {{ entry.at | date: 'd MMM' }},
                  }
                  {{ entry.at | date: 'HH:mm' }}</time
                >
                <span class="text-body-large">
                  @switch (entry.kind) {
                    @case ('start') {
                      <ng-container i18n="@@detail.entry.start">Abrió el ejercicio</ng-container>
                    }
                    @case ('run') {
                      @if (entry.passed === entry.total) {
                        <ng-container i18n="@@detail.entry.runPassed"
                          >Ejecutó las pruebas: superó las {{ entry.total }}</ng-container
                        >
                      } @else {
                        <ng-container i18n="@@detail.entry.run"
                          >Ejecutó las pruebas: {{ entry.passed }} de
                          {{ entry.total }} superadas</ng-container
                        >
                      }
                    }
                    @case ('tutor') {
                      @switch (entry.interaction.trigger) {
                        @case ('question') {
                          <ng-container i18n="@@detail.entry.question"
                            >Preguntó al tutor</ng-container
                          >
                        }
                        @case ('hint') {
                          <ng-container i18n="@@detail.entry.hint"
                            >Pidió una pista · nivel {{ entry.interaction.hintLevel }}</ng-container
                          >
                        }
                        @default {
                          <!-- proactive -->
                          <ng-container i18n="@@detail.entry.proactive"
                            >El tutor intervino por su cuenta</ng-container
                          >
                        }
                      }
                    }
                    @case ('hint') {
                      <ng-container i18n="@@detail.entry.hintOnly"
                        >Pidió una pista · nivel {{ entry.level }}</ng-container
                      >
                    }
                    @case ('proactive') {
                      @if (entry.silent) {
                        <ng-container i18n="@@detail.entry.silent"
                          >El tutor prefirió no intervenir</ng-container
                        >
                      } @else {
                        <ng-container i18n="@@detail.entry.proactiveOnly"
                          >El tutor intervino por su cuenta</ng-container
                        >
                      }
                    }
                    @case ('paste') {
                      <ng-container i18n="@@detail.entry.paste">{entry.length, plural,
                        =1 {Pegó 1 carácter}
                        other {Pegó {{ entry.length }} caracteres}
                      }</ng-container>
                    }
                    @case ('away') {
                      @if (entry.ms === null) {
                        <ng-container i18n="@@detail.entry.awayOpen"
                          >Salió de la ventana</ng-container
                        >
                      } @else {
                        <ng-container i18n="@@detail.entry.away"
                          >Salió de la ventana · {{ duration(entry.ms) }}</ng-container
                        >
                      }
                    }
                    @default {
                      <!-- submit -->
                      <ng-container i18n="@@detail.entry.submit">Entregó el ejercicio</ng-container>
                    }
                  }
                </span>
              </p>
              @if (entry.kind === 'run' && entry.failing.length > 0) {
                <ul
                  class="flex flex-wrap gap-1.5"
                  aria-label="Pruebas que fallan"
                  i18n-aria-label="@@detail.failing"
                >
                  @for (test of entry.failing; track test.id) {
                    <li
                      class="rounded-md bg-error-container px-2 py-0.5 font-mono text-body-small text-on-error-container"
                    >
                      {{ test.call }}
                      @if (test.hidden) {
                        <span class="font-sans" i18n="@@detail.hiddenTest">(prueba oculta)</span>
                      }
                    </li>
                  }
                </ul>
              }
              @if (entry.kind === 'tutor') {
                @let interaction = entry.interaction;
                @let actions = interaction.actions ?? [];
                @if (interaction.studentMessage) {
                  <p
                    class="self-start rounded-2xl rounded-ss-sm bg-secondary-container px-3 py-2 text-body-medium whitespace-pre-line text-on-secondary-container"
                  >
                    <span class="sr-only" i18n="@@detail.studentSaid">Escribió: </span
                    >{{ interaction.studentMessage }}
                  </p>
                }
                <div
                  class="rounded-2xl rounded-ss-sm bg-surface-container-high px-3 py-2 text-body-medium"
                >
                  <span class="sr-only" i18n="@@detail.tutorSaid">Respuesta del tutor: </span>
                  <app-tutor-message [text]="interaction.transcript" />
                </div>
                @if (interaction.elusion || actions.length > 0) {
                  <p
                    class="flex flex-wrap gap-x-3 gap-y-1 text-label-medium text-on-surface-variant"
                  >
                    @if (interaction.elusion) {
                      <span class="flex items-center gap-1">
                        <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">key</mat-icon>
                        <ng-container i18n="@@detail.elusion">Pidió la solución</ng-container>
                      </span>
                    }
                    @if (actions.length > 0) {
                      <span class="flex items-center gap-1">
                        <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">build</mat-icon>
                        <ng-container i18n="@@detail.tools"
                          >El tutor {{ tools(actions) }}</ng-container
                        >
                      </span>
                    }
                  </p>
                }
              }
            </div>
          </div>
        </li>
      }
    </ol>
  `,
})
export class AttemptTimelineList {
  readonly entries = input.required<readonly TimelineEntry[]>();
  /** The accessible name of the list. */
  readonly label = input.required<string>();
  /** Shows the long silences: only with every entry, where they mean nothing happened. */
  readonly showGaps = input(true);
  /** When the timeline was loaded: what happened later arrived live and slides in. */
  readonly liveSince = input(Number.POSITIVE_INFINITY);

  protected readonly items = computed(() =>
    this.entries().map((entry, index, all) => {
      const previous = all[index - 1];
      return {
        entry,
        icon: iconOf(entry),
        iso: new Date(entry.at).toISOString(),
        newDay:
          !previous || new Date(previous.at).toDateString() !== new Date(entry.at).toDateString(),
        /** The silence before it, in milliseconds, or null to show none. */
        gap: this.showGaps() && entry.gapMinutes !== null ? entry.gapMinutes * MINUTE_MS : null,
        arrived: entry.at > this.liveSince(),
      };
    }),
  );

  protected duration(ms: number): string {
    return formatDuration(ms);
  }

  protected tools(actions: readonly ToolRequest[]): string {
    return toolsText(actions);
  }
}
