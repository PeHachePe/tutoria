import { formatDate } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { LanguageService } from '../../core/i18n/language-service';
import type { AttemptRuns, EvolutionItem } from './attempt-runs';

const TIME_FORMAT = 'HH:mm';

/**
 * The evolution of an attempt (ficha 07): a column per run, as tall as the tests it passed, and a
 * mark per hint and per paste between them, in the order they happened. Not to scale: an attempt
 * opened on Monday and taken up on Thursday would squash its columns; the time is in each name.
 * Each column and mark is a button that goes to its entry of the timeline. The chart does not make
 * the page grow: it scrolls in its own zone, which stays at the latest.
 */
@Component({
  selector: 'app-attempt-evolution',
  imports: [MatIcon, MatTooltip],
  template: `
    <h2 [id]="headingId" class="text-title-medium" i18n="@@detail.evolution.heading">Evolución</h2>
    <p class="sr-only">{{ text() }}</p>
    <div data-zone class="overflow-x-auto scroll-shadows pb-1">
      <ol
        class="flex w-max items-end gap-1"
        aria-label="Ejecuciones, pistas y pegados, en orden"
        i18n-aria-label="@@detail.evolution.list"
      >
        @for (item of items(); track item.id) {
          <li class="flex">
            <button
              type="button"
              class="flex flex-col items-center gap-1 rounded-md py-1 outline-offset-2 hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
              [class]="item.kind === 'run' ? 'w-9' : 'w-6'"
              [attr.aria-label]="item.label"
              [matTooltip]="item.label"
              (click)="chosen.emit(item.id)"
            >
              @switch (item.kind) {
                @case ('run') {
                  <span class="flex h-5 items-center text-chart-pass" aria-hidden="true">
                    @if (item.allPassed) {
                      <mat-icon class="size-5! text-[1.25rem]!">check</mat-icon>
                    }
                  </span>
                  <span
                    class="flex h-24 w-5 items-end overflow-hidden rounded-sm bg-surface-container-high"
                    aria-hidden="true"
                  >
                    <span
                      data-testid="run-bar"
                      class="min-h-0.5 w-full rounded-sm"
                      [class]="item.barClass"
                      [style.height.%]="item.percent"
                    ></span>
                  </span>
                  <span class="text-label-small tabular-nums" aria-hidden="true"
                    >{{ item.passed }}/{{ item.total }}</span
                  >
                }
                @case ('hint') {
                  <mat-icon class="text-tertiary" aria-hidden="true">lightbulb</mat-icon>
                  <span class="text-label-small tabular-nums" aria-hidden="true">{{
                    item.level
                  }}</span>
                }
                @default {
                  <!-- paste -->
                  <mat-icon class="text-on-surface-variant" aria-hidden="true"
                    >content_paste</mat-icon
                  >
                  <span class="h-4" aria-hidden="true"></span>
                }
              }
            </button>
          </li>
        }
      </ol>
    </div>
    <p
      class="flex flex-wrap gap-x-4 gap-y-1 text-label-medium text-on-surface-variant"
      aria-hidden="true"
    >
      <span class="flex items-center gap-1.5">
        <span class="size-3 rounded-xs bg-primary"></span>
        <ng-container i18n="@@detail.evolution.legend.passed"
          >Pruebas superadas, de {{ total() }}</ng-container
        >
      </span>
      @if (somePassedAll()) {
        <span class="flex items-center gap-1.5">
          <span class="size-3 rounded-xs bg-chart-pass"></span>
          <ng-container i18n="@@detail.evolution.legend.allPassed">Todas superadas</ng-container>
        </span>
      }
      @if (runs().hints > 0) {
        <span class="flex items-center gap-1">
          <mat-icon class="size-4! text-[1rem]! text-tertiary">lightbulb</mat-icon>
          <ng-container i18n="@@detail.evolution.legend.hint">Pista, con su nivel</ng-container>
        </span>
      }
      @if (runs().pastes > 0) {
        <span class="flex items-center gap-1">
          <mat-icon class="size-4! text-[1rem]!">content_paste</mat-icon>
          <ng-container i18n="@@detail.evolution.legend.paste">Pegado</ng-container>
        </span>
      }
    </p>
  `,
  host: {
    role: 'region',
    '[attr.aria-labelledby]': 'headingId',
    class: 'flex flex-col gap-3 rounded-2xl bg-panel p-4',
  },
})
export class AttemptEvolution {
  private readonly locale = inject(LanguageService).locale;

  readonly runs = input.required<AttemptRuns>();
  /** When the attempt was loaded: a run after it arrived live and grows. */
  readonly liveSince = input(Number.POSITIVE_INFINITY);
  /** The id of the event of the column or mark chosen. */
  readonly chosen = output<string>();

  protected readonly headingId = 'detail-evolution-title';

  protected readonly items = computed(() =>
    this.runs().items.map((item) => {
      const time = formatDate(item.at, TIME_FORMAT, this.locale);
      if (item.kind !== 'run') return { ...item, label: this.markLabel(item, time) };
      return {
        ...item,
        allPassed: item.passed === item.total,
        // An exercise without tests draws an empty column
        percent: (item.passed / Math.max(item.total, 1)) * 100,
        barClass: [
          item.passed === item.total ? 'bg-chart-pass' : 'bg-primary',
          // A run that arrived live grows from the axis
          ...(item.at > this.liveSince()
            ? ['origin-bottom', 'animate-column-in', 'motion-reduce:animate-none']
            : []),
        ].join(' '),
        label: $localize`:@@detail.evolution.run:Ejecución de las ${time}:hora:: ${item.passed}:n:/${item.total}:total: superadas. Ir a la línea temporal`,
      };
    }),
  );

  /** The tests of the latest run: the scale of the columns. */
  protected readonly total = computed(
    () =>
      this.runs()
        .items.flatMap((item) => (item.kind === 'run' ? [item.total] : []))
        .at(-1) ?? 0,
  );

  /** Some run passed every test: the legend explains its tone. */
  protected readonly somePassedAll = computed(() =>
    this.runs().items.some((item) => item.kind === 'run' && item.passed === item.total),
  );

  /** «Ejecuciones: 3 de 6, 5 de 6 y 6 de 6; 2 pistas y 1 pegado», for the screen reader. */
  protected readonly text = computed(() => {
    const { items, hints, pastes } = this.runs();
    const list = (parts: string[]) =>
      new Intl.ListFormat(this.locale, { style: 'long', type: 'conjunction' }).format(parts);
    const counts = items.flatMap((item) =>
      item.kind === 'run'
        ? [$localize`:@@detail.evolution.count:${item.passed}:n: de ${item.total}:total:`]
        : [],
    );
    const runs = $localize`:@@detail.evolution.text:Ejecuciones: ${list(counts)}:lista:`;
    const marks = [
      ...(hints === 0
        ? []
        : [
            hints === 1
              ? $localize`:@@detail.evolution.hints.one:1 pista`
              : $localize`:@@detail.evolution.hints.other:${hints}:n: pistas`,
          ]),
      ...(pastes === 0
        ? []
        : [
            pastes === 1
              ? $localize`:@@detail.evolution.pastes.one:1 pegado`
              : $localize`:@@detail.evolution.pastes.other:${pastes}:n: pegados`,
          ]),
    ];
    return marks.length === 0 ? runs : `${runs}; ${list(marks)}`;
  });

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    // afterRenderEffect(): the boundary with the DOM, which scrolls the zone to the latest when the
    // chart is created and each time a column or a mark arrives
    afterRenderEffect(() => {
      if (this.runs().items.length === 0) return;
      // The zone is always in the template
      const zone = host.querySelector('[data-zone]') as HTMLElement;
      zone.scrollLeft = zone.scrollWidth;
    });
  }

  private markLabel(item: Exclude<EvolutionItem, { kind: 'run' }>, time: string): string {
    return item.kind === 'hint'
      ? $localize`:@@detail.evolution.hint:Pista de nivel ${item.level}:n: a las ${time}:hora:. Ir a la línea temporal`
      : $localize`:@@detail.evolution.paste:Pegó ${item.length}:n: caracteres a las ${time}:hora:. Ir a la línea temporal`;
  }
}
