import { Component, computed, inject, input } from '@angular/core';

import { LanguageService } from '../../core/i18n/language-service';
import { DEADLINE_LAST_HOURS, type DeadlineStats } from '../../data/stats-service';
import { DueLabel } from '../../shared/due-label/due-label';

/**
 * The due dates of the chosen block in the history (ficha 09, D-054, D-073), one per date: what
 * arrived on time, how much of it in its last hours, what came after and who is missing, by name and
 * always in sight. Whoever submits at the last moment is not named: it is a fact of the date, not of
 * the person. A date still to come says what has arrived so far, as nobody is late yet.
 */
@Component({
  selector: 'app-block-deadlines',
  imports: [DueLabel],
  template: `
    @for (row of rows(); track row.deadline.dueAt) {
      <div class="flex flex-col gap-1 border-outline-variant py-3 not-first:border-t">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 class="flex flex-wrap gap-x-1 text-title-small" ngPreserveWhitespaces>
            <span i18n="@@history.deadline.heading">Entrega:</span>
            <app-due-label [dueAt]="row.deadline.dueAt" />
          </h3>
          @if (several()) {
            <span
              class="text-body-medium text-on-surface-variant"
              i18n="@@history.block.exercises"
              >{row.deadline.assignments, plural,
                =1 {1 ejercicio}
                other {{{ row.deadline.assignments }} ejercicios}
              }</span
            >
          }
          <p class="flex flex-wrap gap-x-1 text-body-medium sm:ms-auto" ngPreserveWhitespaces>
            @if (row.upcoming) {
              <span i18n="@@history.deadline.submitted"
                >{{ row.deadline.onTime }} de {{ row.expected }} entregadas</span
              >
            } @else {
              <span i18n="@@history.deadline.onTime"
                >{{ row.deadline.onTime }} de {{ row.expected }} a tiempo</span
              >
            }
            @if (row.deadline.lastHours) {
              <span aria-hidden="true">·</span>
              <span i18n="@@history.deadline.lastHours">{row.deadline.lastHours, plural,
                =1 {1 en las últimas {{ lastHours }} horas}
                other {{{ row.deadline.lastHours }} en las últimas {{ lastHours }} horas}
              }</span>
            }
            @if (row.deadline.late) {
              <span aria-hidden="true">·</span>
              <span i18n="@@history.deadline.late">{row.deadline.late, plural,
                =1 {1 después del plazo}
                other {{{ row.deadline.late }} después del plazo}
              }</span>
            }
          </p>
        </div>
        @if (row.nobody) {
          <p class="text-body-medium text-on-surface-variant" i18n="@@history.deadline.nobody">
            Nadie ha entregado todavía
          </p>
        } @else if (row.missing) {
          <p class="text-body-medium text-on-surface-variant" ngPreserveWhitespaces>
            <span
              class="font-medium text-on-surface"
              i18n="@@history.deadline.missing"
              >{row.deadline.missing.length, plural,
                =1 {Falta 1:}
                other {Faltan {{ row.deadline.missing.length }}:}
              }</span
            >
            {{ row.missing }}
          </p>
        } @else {
          <p class="text-body-medium text-on-surface-variant" i18n="@@history.deadline.complete">
            Todo entregado
          </p>
        }
      </div>
    }
  `,
  host: { class: 'flex flex-col' },
})
export class BlockDeadlines {
  private readonly locale = inject(LanguageService).locale;

  /** The due dates of the block, by date. */
  readonly deadlines = input.required<readonly DeadlineStats[]>();
  /** Students enrolled now. */
  readonly students = input.required<number>();

  protected readonly lastHours = DEADLINE_LAST_HOURS;

  /** With more than one date, each says how many exercises it is for. */
  protected readonly several = computed(() => this.deadlines().length > 1);

  protected readonly rows = computed(() => {
    // From the moment it is drawn, as DueLabel
    const now = Date.now();
    const names = new Intl.ListFormat(this.locale, { type: 'conjunction' });
    return this.deadlines().map((deadline) => {
      const total = deadline.assignments;
      return {
        deadline,
        upcoming: Date.parse(deadline.dueAt) >= now,
        expected: this.students() * total,
        /** Nothing arrived: a list of the whole class would say nothing more. */
        nobody: deadline.onTime + deadline.late === 0,
        /**
         * «Ana López, Bruno Gil (falta 1 de 3) y …», by name; empty with nobody missing. Only who
         * submitted part of it says how much is left: for the rest, it is all.
         */
        missing: names.format(
          deadline.missing.map(({ student, pending }) =>
            pending === total
              ? student.name
              : pending === 1
                ? $localize`:@@history.deadline.pendingOne:${student.name}:name: (falta 1 de ${total}:total:)`
                : $localize`:@@history.deadline.pendingMany:${student.name}:name: (faltan ${pending}:pending: de ${total}:total:)`,
          ),
        ),
      };
    });
  });
}
