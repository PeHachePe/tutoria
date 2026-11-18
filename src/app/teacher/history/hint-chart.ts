import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { blockTitle } from '../../data/localized-text';
import type { BlockStats } from '../../data/stats-service';
import { averageHints, formatAverage, isRepresentative } from './history-figures';

const PERCENT = 100;

/**
 * The chart of the history (ficha 09, Figura 19): a bar per started block with its hints per
 * exercise, as tall as its share of the highest one. HTML with Tailwind, not SVG: each bar is a real
 * link that picks its block, with its focus, its name and its size (WCAG 2.5.8). The blocks fewer than
 * half the class worked on go in grey, and say so in text. The table of the page says the same.
 */
@Component({
  selector: 'app-hint-chart',
  imports: [RouterLink],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <!-- What the colours and the highlighted column mean: nothing in the chart goes unexplained -->
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-label-medium text-on-surface-variant">
      <li class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm bg-primary" aria-hidden="true"></span>
        <span i18n="@@history.legend.trend">Cuenta para la tendencia</span>
      </li>
      @if (hasFew()) {
        <li class="flex items-center gap-1.5">
          <span class="size-3 rounded-sm bg-outline-variant" aria-hidden="true"></span>
          <span i18n="@@history.legend.few">Menos de media clase: no cuenta</span>
        </li>
      }
      <li class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm bg-secondary-container" aria-hidden="true"></span>
        <span i18n="@@history.legend.selected">Bloque elegido: su detalle, abajo</span>
      </li>
    </ul>
    <ol class="flex justify-center-safe gap-3 overflow-x-auto p-1" [attr.aria-label]="label">
      @for (bar of bars(); track bar.id) {
        <li
          class="flex min-w-16 max-w-40 flex-1 flex-col items-center gap-0.5 rounded-lg pb-1"
          [class.bg-secondary-container]="bar.selected"
        >
          <!-- The title goes first, as the name says it (WCAG 2.5.3), though it is drawn under the bar -->
          <a
            class="flex w-full flex-col items-center gap-1 rounded-lg p-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            [class]="bar.selected ? '' : 'hover:bg-surface-container'"
            [routerLink]="[]"
            [queryParams]="bar.queryParams"
            queryParamsHandling="merge"
            [attr.aria-current]="bar.selected ? 'true' : null"
            [attr.aria-label]="bar.label"
          >
            <span
              class="order-last line-clamp-2 text-center text-label-medium"
              [class.font-bold]="bar.selected"
              [attr.lang]="bar.lang"
            >
              {{ bar.title }}
            </span>
            <!-- The value rides on its bar; the padding keeps room for it over the highest one -->
            <span class="flex h-46 w-full items-end pt-6">
              <span
                data-testid="hint-bar"
                class="relative min-h-0.5 w-full rounded-t-md"
                [class]="bar.tone"
                [style.height.%]="bar.height"
              >
                <span
                  class="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-label-large text-on-surface"
                  >{{ bar.value }}</span
                >
              </span>
            </span>
          </a>
          @if (!bar.representative) {
            <span
              class="text-label-small text-on-surface-variant"
              i18n="@@history.chart.few"
              >{bar.students, plural, =1 {1 alumno} other {{{ bar.students }} alumnos}}</span
            >
          }
        </li>
      }
    </ol>
    <p class="text-body-small text-on-surface-variant" i18n="@@history.chart.pick">
      Pulsa una barra para ver su detalle.
    </p>
  `,
})
export class HintChart {
  private readonly locale = inject(LanguageService).locale;

  /** The started blocks, in order. */
  readonly blocks = input.required<readonly BlockStats[]>();
  /** Students enrolled now. */
  readonly students = input.required<number>();
  readonly selectedId = input<string>();

  protected readonly label = $localize`:@@history.chart.heading:Pistas por ejercicio, bloque a bloque`;

  /** Some block fewer than half the class worked on, in grey: the legend explains it. */
  protected readonly hasFew = computed(() => this.bars().some((bar) => !bar.representative));

  protected readonly bars = computed(() => {
    const blocks = this.blocks();
    const students = this.students();
    const highest = Math.max(0, ...blocks.map(averageHints));
    return blocks.map((stats) => {
      const average = averageHints(stats);
      const title = blockTitle(stats.block, this.locale);
      const value = formatAverage(average, this.locale);
      const representative = isRepresentative(stats, students);
      const selected = stats.block.id === this.selectedId();
      return {
        id: stats.block.id,
        title: title.title,
        lang: title.locale === this.locale ? null : title.locale,
        value,
        height: highest ? (average / highest) * PERCENT : 0,
        representative,
        students: stats.activeStudents,
        selected,
        tone: representative ? 'bg-primary' : 'bg-outline-variant',
        queryParams: { [TEACHER_PARAMS.block]: stats.block.id },
        label: $localize`:@@history.chart.bar:${title.title}:bloque:: ${value}:valor: pistas por ejercicio. Ver sus cifras`,
      };
    });
  });
}
