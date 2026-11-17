import { Component, computed, input } from '@angular/core';

import type { AttentionReason } from './live-attention';
import type { LivePattern } from './live-patterns';

/**
 * What a chip of «Alumnado» says (D-068): the reason of the queue or something worth knowing, only
 * when it exists.
 */
export type LiveReason =
  | AttentionReason
  | LivePattern
  | { readonly kind: 'away' }
  | { readonly kind: 'repeated'; readonly count: number }
  | { readonly kind: 'breakthrough'; readonly failures: number };

export type LiveReasonKind = LiveReason['kind'];

/**
 * Tone of each chip: help in warning, review in info, perseverance in success, and being out of
 * the window, neutral: it describes, it does not call for anything.
 */
export type LiveTone = 'help' | 'review' | 'perseverance' | 'neutral';

export const REASON_TONES: Record<LiveReasonKind, LiveTone> = {
  hints_exhausted: 'help',
  stuck_failures: 'help',
  chat_stuck: 'help',
  hint_rush: 'help',
  away: 'neutral',
  paste_submit: 'review',
  paste_on_return: 'review',
  submit_burst: 'review',
  repeated: 'perseverance',
  breakthrough: 'perseverance',
};

/** Material Symbols of each chip, so it never says it only with its colour. */
export const REASON_ICONS: Record<LiveReasonKind, string> = {
  hints_exhausted: 'front_hand',
  stuck_failures: 'replay',
  chat_stuck: 'forum',
  hint_rush: 'fast_forward',
  away: 'visibility_off',
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
  neutral: 'bg-surface-container-high text-on-surface-variant',
};

/**
 * Why a student is in the queue, as a fact (D-054): «Falla 4 veces seguidas la misma prueba», never
 * a verdict. The queue and the strip of the attempt detail say it.
 */
@Component({
  selector: 'app-live-reason',
  template: `
    @let r = reason();
    @switch (r.kind) {
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
      @case ('chat_stuck') {
        <ng-container i18n="@@live.reason.chatStuck"
          >Le ha dicho al tutor {{ r.messages }} veces que no sabe seguir</ng-container
        >
      }
      @default {
        <!-- hint_rush, the last one: a default leaves no case without words -->
        <ng-container i18n="@@live.reason.hintRush"
          >Ha pedido {{ r.hints }} pistas seguidas sin ejecutar las pruebas</ng-container
        >
      }
    }
  `,
})
export class LiveReasonText {
  readonly reason = input.required<AttentionReason>();
}

/** Something worth knowing of a student as a small pill, with its icon and its short label. */
@Component({
  selector: 'app-live-chip',
  template: `
    <span class="material-symbols-outlined text-[1rem]! leading-none!" aria-hidden="true">
      {{ icon() }}
    </span>
    @let r = reason();
    @switch (r.kind) {
      @case ('hints_exhausted') {
        <ng-container i18n="@@live.chip.hintsExhausted">Sin más pistas</ng-container>
      }
      @case ('stuck_failures') {
        <ng-container i18n="@@live.chip.stuckFailures">Atascado</ng-container>
      }
      @case ('chat_stuck') {
        <ng-container i18n="@@live.chip.chatStuck">No sabe seguir</ng-container>
      }
      @case ('hint_rush') {
        <ng-container i18n="@@live.chip.hintRush">Pistas seguidas</ng-container>
      }
      @case ('away') {
        <ng-container i18n="@@live.chip.away">Fuera de la ventana</ng-container>
      }
      @case ('paste_submit') {
        <ng-container i18n="@@live.chip.pasteSubmit"
          >Entregó tras pegar {{ r.chars }} caracteres</ng-container
        >
      }
      @case ('paste_on_return') {
        <ng-container i18n="@@live.chip.pasteOnReturn">Pegó al volver a la ventana</ng-container>
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
