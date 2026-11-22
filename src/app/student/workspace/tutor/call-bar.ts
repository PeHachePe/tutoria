import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { Mascot, type MascotMood } from '../../../shared/mascot/mascot';
import type { CallState } from '../voice-call';

/** What each state shows: the icon and its name, announced once (listening and hearing share it). */
const STATES: Record<CallState, { readonly icon: string; readonly label: string }> = {
  listening: { icon: 'mic', label: $localize`:@@call.listening:Te escucho` },
  hearing: { icon: 'graphic_eq', label: $localize`:@@call.listening:Te escucho` },
  thinking: { icon: 'more_horiz', label: $localize`:@@call.thinking:Pensando…` },
  speaking: { icon: 'volume_up', label: $localize`:@@call.speaking:Hablando…` },
  standby: { icon: 'pause', label: $localize`:@@call.standby:En espera` },
};

/** The mascot is the face of the tutor in the call: in the card, the panel and folded. */
const MOODS: Record<CallState, MascotMood> = {
  listening: 'chat',
  hearing: 'chat',
  thinking: 'thinking',
  speaking: 'speaking',
  standby: 'idle',
};

export function callMood(state: CallState): MascotMood {
  return MOODS[state];
}

/** The icon and the name of the state, also for the line of the folded tutor. */
export function callShown(state: CallState): { readonly icon: string; readonly label: string } {
  return STATES[state];
}

/**
 * The keys of a call (2.11): how the tooltips name them, and `aria-keyshortcuts`. Control alone
 * interrupts; Ctrl + . pauses or resumes.
 */
export const CALL_KEYS = {
  interrupt: { label: 'Ctrl', aria: 'Control' },
  hold: { label: 'Ctrl + .', aria: 'Control+.' },
} as const;

/** The name of a button with its key, for its tooltip (ficha 04). */
function withKey(action: string, key: string): string {
  return `${action} (${key})`;
}

/**
 * The card of a call with the tutor (2.11, ficha 04): the mascot as the tutor's face, with a ring
 * while the microphone is open; where the call is; what the browser is understanding or, as a
 * subtitle, the sentence the tutor says; and the buttons of the state, with «Colgar» always. No
 * services, so the showcase shows it in every state. A change of state never moves the focus.
 */
@Component({
  selector: 'app-call-bar',
  imports: [Mascot, MatButton, MatIcon, MatTooltip],
  templateUrl: './call-bar.html',
  host: { class: 'block' },
})
export class CallBar {
  readonly state = input.required<CallState>();
  /** What the browser has understood of the turn of the student. */
  readonly heard = input('');
  /** The sentence the tutor says now. */
  readonly saying = input<string | null>(null);
  readonly microphoneOpen = input(false);

  /** «Pausar»: on hold. */
  readonly hold = output<void>();
  readonly correct = output<void>();
  readonly interrupt = output<void>();
  /** «Seguir hablando». */
  readonly keepTalking = output<void>();
  readonly hangUp = output<void>();

  protected readonly shown = computed(() => callShown(this.state()));
  protected readonly mood = computed(() => callMood(this.state()));

  /** Under the state: what is said, or what the student needs to know of the microphone. */
  protected readonly detail = computed(() => {
    switch (this.state()) {
      case 'listening':
        return { text: $localize`:@@call.hint.listening:Habla cuando quieras.`, muted: true };
      case 'hearing':
        return { text: this.heard(), muted: false };
      case 'speaking':
        return { text: this.saying() ?? '', muted: false };
      default:
        return { text: $localize`:@@call.hint.closed:Micrófono cerrado.`, muted: true };
    }
  });

  protected readonly keys = CALL_KEYS;
  protected readonly pauseTooltip = withKey($localize`:@@call.pause:Pausar`, CALL_KEYS.hold.label);
  protected readonly interruptTooltip = withKey(
    $localize`:@@call.interrupt:Interrumpir`,
    CALL_KEYS.interrupt.label,
  );
  protected readonly resumeTooltip = withKey(
    $localize`:@@call.resume:Seguir hablando`,
    CALL_KEYS.hold.label,
  );
}
