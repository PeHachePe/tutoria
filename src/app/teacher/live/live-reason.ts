import { booleanAttribute, Component, computed, input } from '@angular/core';

import type { LivePattern } from './live-patterns';
import type { LiveRow, LiveSignal } from './live-row';

/** Why a student appears in a card or carries a chip: a signal, a pattern or perseverance. */
export type LiveReason =
  | LiveSignal
  | LivePattern
  | { readonly kind: 'repeated'; readonly count: number }
  | { readonly kind: 'breakthrough'; readonly failures: number };

export type LiveReasonKind = LiveReason['kind'];

/** Tone of each reason: help in warning, review in info, perseverance in success. */
export type LiveTone = 'help' | 'review' | 'perseverance';

export const REASON_TONES: Record<LiveReasonKind, LiveTone> = {
  away: 'help',
  hints_exhausted: 'help',
  stuck_failures: 'help',
  hint_rush: 'help',
  stuck_idle: 'help',
  not_started: 'review',
  inactive: 'review',
  paste_submit: 'review',
  paste_on_return: 'review',
  submit_burst: 'review',
  repeated: 'perseverance',
  breakthrough: 'perseverance',
};

/** Material Symbols of each reason, so a chip never says it only with its colour. */
export const REASON_ICONS: Record<LiveReasonKind, string> = {
  away: 'visibility_off',
  hints_exhausted: 'front_hand',
  stuck_failures: 'replay',
  hint_rush: 'fast_forward',
  stuck_idle: 'hourglass_empty',
  not_started: 'radio_button_unchecked',
  inactive: 'bedtime',
  paste_submit: 'content_paste',
  paste_on_return: 'content_paste_go',
  submit_burst: 'bolt',
  repeated: 'replay',
  breakthrough: 'emoji_events',
};

/** Colour tokens of each tone. */
export const TONE_CLASSES: Record<LiveTone, string> = {
  help: 'bg-warning-container text-on-warning-container',
  review: 'bg-info-container text-on-info-container',
  perseverance: 'bg-success-container text-on-success-container',
};

/** The perseverance of a row, the latest first: a breakthrough of the session, then the repetitions. */
export function perseveranceOf(row: LiveRow): LiveReason[] {
  return [
    ...(row.breakthrough
      ? [{ kind: 'breakthrough', failures: row.breakthrough.failures } as const]
      : []),
    ...(row.repeated > 0 ? [{ kind: 'repeated', count: row.repeated } as const] : []),
  ];
}

/** Every reason of a row, in the order of the cards: help, review and perseverance. */
export function reasonsOf(row: LiveRow): LiveReason[] {
  return [...(row.signal ? [row.signal] : []), ...row.patterns, ...perseveranceOf(row)];
}

/**
 * What a reason says, as a fact (D-054): «Falla 4 veces seguidas la misma prueba», never «copia».
 * `short` gives the label of a chip.
 */
@Component({
  selector: 'app-live-reason',
  template: `
    @let r = reason();
    @if (short()) {
      @switch (r.kind) {
        @case ('away') {
          <ng-container i18n="@@live.chip.away">Fuera</ng-container>
        }
        @case ('hints_exhausted') {
          <ng-container i18n="@@live.chip.hintsExhausted">Sin más pistas</ng-container>
        }
        @case ('stuck_failures') {
          <ng-container i18n="@@live.chip.stuckFailures">Atascado</ng-container>
        }
        @case ('hint_rush') {
          <ng-container i18n="@@live.chip.hintRush">Pistas seguidas</ng-container>
        }
        @case ('stuck_idle') {
          <ng-container i18n="@@live.chip.stuckIdle">Sin avanzar</ng-container>
        }
        @case ('not_started') {
          <ng-container i18n="@@live.chip.notStarted">Sin empezar</ng-container>
        }
        @case ('inactive') {
          <ng-container i18n="@@live.chip.inactive">Sin actividad</ng-container>
        }
        @case ('paste_submit') {
          <ng-container i18n="@@live.chip.pasteSubmit">Entrega con pegado</ng-container>
        }
        @case ('paste_on_return') {
          <ng-container i18n="@@live.chip.pasteOnReturn">Pegado al volver</ng-container>
        }
        @case ('submit_burst') {
          <ng-container i18n="@@live.chip.submitBurst">Ráfaga de entregas</ng-container>
        }
        @case ('repeated') {
          <ng-container i18n="@@live.chip.repeated">Repite ejercicios</ng-container>
        }
        @case ('breakthrough') {
          <ng-container i18n="@@live.chip.breakthrough">Superó tras insistir</ng-container>
        }
      }
    } @else {
      @switch (r.kind) {
        @case ('away') {
          <ng-container i18n="@@live.reason.away">Ha salido de la ventana</ng-container>
        }
        @case ('hints_exhausted') {
          <ng-container i18n="@@live.reason.hintsExhausted"
            >Ya tuvo la pista de nivel 3 y sigue fallando</ng-container
          >
        }
        @case ('stuck_failures') {
          @if (r.askedForHints) {
            <ng-container i18n="@@live.reason.stuckFailures"
              >Falla {{ r.failures }} veces seguidas la misma prueba</ng-container
            >
          } @else {
            <ng-container i18n="@@live.reason.stuckFailuresNoHelp"
              >Falla {{ r.failures }} veces seguidas la misma prueba y no ha pedido ninguna
              pista</ng-container
            >
          }
        }
        @case ('hint_rush') {
          <ng-container i18n="@@live.reason.hintRush"
            >Ha pedido {{ r.hints }} pistas seguidas sin ejecutar las pruebas</ng-container
          >
        }
        @case ('stuck_idle') {
          <ng-container i18n="@@live.reason.stuckIdle"
            >No escribe ni ejecuta desde hace un rato</ng-container
          >
        }
        @case ('not_started') {
          <ng-container i18n="@@live.reason.notStarted"
            >No ha abierto ningún ejercicio del bloque</ng-container
          >
        }
        @case ('inactive') {
          <ng-container i18n="@@live.reason.inactive"
            >Sin actividad en la última hora mientras la clase trabaja</ng-container
          >
        }
        @case ('paste_submit') {
          <ng-container i18n="@@live.reason.pasteSubmit">{r.runs, plural,
            =0 {Entregó tras pegar {{ r.chars }} caracteres, sin ejecutar las pruebas}
            =1 {Entregó tras pegar {{ r.chars }} caracteres, con 1 ejecución}
            other {Entregó tras pegar {{ r.chars }} caracteres, con {{ r.runs }} ejecuciones}
          }</ng-container>
        }
        @case ('paste_on_return') {
          <ng-container i18n="@@live.reason.pasteOnReturn"
            >Pegó {{ r.chars }} caracteres al poco de volver a la ventana</ng-container
          >
        }
        @case ('submit_burst') {
          <ng-container i18n="@@live.reason.submitBurst"
            >{{ r.count }} entregas en menos de {{ r.minutes }} min</ng-container
          >
        }
        @case ('repeated') {
          <ng-container i18n="@@live.reason.repeated">{r.count, plural,
            =1 {Practica de nuevo 1 ejercicio ya entregado}
            other {Practica de nuevo {{ r.count }} ejercicios ya entregados}
          }</ng-container>
        }
        @case ('breakthrough') {
          <ng-container i18n="@@live.reason.breakthrough"
            >Superó una prueba que había fallado {{ r.failures }} veces seguidas</ng-container
          >
        }
      }
    }
  `,
})
export class LiveReasonText {
  readonly reason = input.required<LiveReason>();
  /** The label of a chip instead of the whole sentence. */
  readonly short = input(false, { transform: booleanAttribute });
}

/** A reason as a small coloured pill with its icon and its short label. */
@Component({
  selector: 'app-live-chip',
  imports: [LiveReasonText],
  template: `
    <span class="material-symbols-outlined text-[1rem]! leading-none!" aria-hidden="true">
      {{ icon() }}
    </span>
    <app-live-reason [reason]="reason()" short />
  `,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full py-0.5 ps-1.5 pe-2.5 text-label-medium',
    '[class]': 'classes()',
  },
})
export class LiveChip {
  readonly reason = input.required<LiveReason>();

  protected readonly icon = computed(() => REASON_ICONS[this.reason().kind]);
  protected readonly classes = computed(() => TONE_CLASSES[REASON_TONES[this.reason().kind]]);
}
