import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { dueDistance } from '../due-date';

/**
 * A due date (4.3b, D-054) and how far it is: «vie 20 nov, 23:59 · en 5 días». It describes, never
 * judges: the same words for whoever submitted and whoever did not.
 */
@Component({
  selector: 'app-due-label',
  imports: [DatePipe],
  template: `
    <!-- The colour is that of the text around it: it goes on cards of several colours -->
    <span class="inline-flex flex-wrap items-baseline gap-x-1">
      <span>{{ dueAt() | date: 'EEE d MMM, HH:mm' }}</span>
      <span aria-hidden="true">·</span>
      @let distance = this.distance();
      @if (distance.kind === 'today') {
        <span i18n="@@due.today">hoy</span>
      } @else if (distance.kind === 'upcoming') {
        <span i18n="@@due.upcoming">{distance.days, plural,
          =1 {mañana}
          other {en {{ distance.days }} días}
        }</span>
      } @else {
        <span i18n="@@due.past">{distance.days, plural,
          =1 {ayer}
          other {hace {{ distance.days }} días}
        }</span>
      }
    </span>
  `,
})
export class DueLabel {
  /** An ISO date. */
  readonly dueAt = input.required<string>();

  /** From the moment it is drawn: a screen open for days is reloaded long before it matters. */
  protected readonly distance = computed(() => dueDistance(this.dueAt(), Date.now()));
}
