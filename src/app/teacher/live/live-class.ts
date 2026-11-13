import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { LanguageService } from '../../core/i18n/language-service';
import type { AttemptStatus } from '../../data/attempt';
import { exerciseText } from '../../data/localized-text';
import { formatCall } from '../../shared/format-value';
import { COMMON_FAILURE_STUDENTS, type ExerciseOverview } from './live-overview';

/** The segments of each bar, in the order of the work, with their colour token and name. */
const SEGMENTS: readonly {
  readonly status: AttemptStatus;
  readonly tone: string;
  readonly label: string;
}[] = [
  {
    status: 'not_started',
    tone: 'bg-surface-container-highest',
    label: $localize`:@@status.notStarted:Sin empezar`,
  },
  { status: 'in_progress', tone: 'bg-info', label: $localize`:@@status.inProgress:En curso` },
  {
    status: 'tests_failed',
    tone: 'bg-warning',
    label: $localize`:@@status.testsFailed:Con fallos`,
  },
  { status: 'passed', tone: 'bg-success/45', label: $localize`:@@status.passed:Superado` },
  { status: 'submitted', tone: 'bg-success', label: $localize`:@@status.submitted:Entregado` },
];

/**
 * «La clase en el bloque» (D-054): a bar per exercise with where every student is, and the test
 * most of them fail now, to decide whether to explain it to everybody. The bars grow and shrink
 * as the class works; the numbers are also in text, for screen readers.
 */
@Component({
  selector: 'app-live-class',
  imports: [MatIcon],
  template: `
    <div class="flex flex-col gap-1.5 border-b border-outline-variant px-4 py-3">
      <h2 id="live-class-title" class="text-title-medium" i18n="@@live.class.heading">
        La clase en el bloque
      </h2>
      <ul class="flex flex-wrap gap-x-2.5 gap-y-1" aria-hidden="true">
        @for (segment of segments; track segment.status) {
          <li class="flex items-center gap-1 text-body-small text-on-surface-variant">
            <span
              class="size-2.5 rounded-xs border border-outline-variant"
              [class]="segment.tone"
            ></span>
            {{ segment.label }}
          </li>
        }
      </ul>
    </div>
    <ol class="flex flex-col gap-4 p-4">
      @for (item of items(); track item.id) {
        <li class="flex flex-col gap-1.5">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 class="text-title-small" [attr.lang]="item.lang">{{ item.title }}</h3>
            <p class="sr-only">{{ item.summary }}</p>
          </div>
          <div
            class="flex h-3 overflow-hidden rounded-full bg-surface-container-high"
            aria-hidden="true"
          >
            @for (segment of item.segments; track segment.status) {
              <span
                class="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                [class]="segment.tone"
                [style.width.%]="segment.percent"
              ></span>
            }
          </div>
          @if (item.failure; as failure) {
            <div class="flex flex-col items-start gap-1 text-body-medium">
              @if (failure.common) {
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-warning-container px-2 text-label-medium text-on-warning-container"
                  ><mat-icon class="text-[1rem]! size-4!" aria-hidden="true">campaign</mat-icon
                  ><span i18n="@@live.class.common">Para explicar a todos</span></span
                >
              }
              <span class="text-on-surface-variant" i18n="@@live.class.topFailure"
                >Más falla ahora:</span
              >
              <p class="flex flex-wrap items-center gap-x-2">
                <code class="rounded bg-surface-container-high px-1.5 font-mono text-body-small">{{
                  failure.call
                }}</code>
                @if (failure.hidden) {
                  <span class="text-on-surface-variant" i18n="@@live.class.hiddenTest"
                    >(prueba oculta)</span
                  >
                }
                <span
                  class="text-on-surface-variant"
                  i18n="@@live.class.failing"
                  >{failure.students, plural,
                    =1 {· 1 alumno}
                    other {· {{ failure.students }} alumnos}
                  }</span
                >
              </p>
            </div>
          }
        </li>
      }
    </ol>
  `,
  host: {
    role: 'region',
    'aria-labelledby': 'live-class-title',
    class: 'flex flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveClass {
  private readonly locale = inject(LanguageService).locale;

  readonly overview = input.required<readonly ExerciseOverview[]>();

  protected readonly segments = SEGMENTS;

  protected readonly items = computed(() =>
    this.overview().map(({ exercise, counts, students, topFailure }, index) => {
      const text = exerciseText(exercise.exercise, this.locale);
      return {
        id: exercise.assignmentId,
        title: `${index + 1}. ${text.title}`,
        lang: text.locale === this.locale ? null : text.locale,
        segments: SEGMENTS.map(({ status, tone }) => ({
          status,
          tone,
          percent: students === 0 ? 0 : (counts[status] / students) * 100,
        })),
        summary: SEGMENTS.filter(({ status }) => counts[status] > 0)
          .map(({ status, label }) => `${label}: ${counts[status]}`)
          .join(', '),
        failure: topFailure && {
          call: formatCall(exercise.exercise.functionName, topFailure.test.input),
          hidden: topFailure.test.isHidden,
          students: topFailure.students,
          common: topFailure.students >= COMMON_FAILURE_STUDENTS,
        },
      };
    }),
  );
}
