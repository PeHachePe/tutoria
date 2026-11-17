import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * «Para explicar a todos» (D-068): several students fail the same test now, so it may be worth
 * stopping the class to explain it. The call, what it expects (a hidden test too: only the
 * teacher sees this screen), how many fail it and «Ver quiénes», which filters the table. With its
 * text and its icon, never its colour alone.
 */
@Component({
  selector: 'app-common-failure',
  imports: [MatButton, MatIcon],
  template: `
    <mat-icon class="shrink-0" aria-hidden="true">campaign</mat-icon>
    <!-- At least 14rem: with less room, «Ver quiénes» goes under it -->
    <div class="flex min-w-56 flex-1 flex-col gap-0.5">
      <p class="text-title-small" i18n="@@live.class.common">Para explicar a todos</p>
      <!-- The spaces between the words and the code, which Angular would remove -->
      <p class="text-body-medium" ngPreserveWhitespaces>
        <ng-container i18n="@@live.class.commonFailing"
          >{{ students() }} alumnos fallan</ng-container
        >
        <code class="rounded bg-surface/60 px-1 font-mono text-body-small break-all">{{
          call()
        }}</code>
        <ng-container i18n="@@live.class.expects">espera</ng-container>
        <code class="rounded bg-surface/60 px-1 font-mono text-body-small break-all">{{
          expected()
        }}</code>
        @if (hidden()) {
          <span> · <ng-container i18n="@@live.class.hiddenTest">prueba oculta</ng-container></span>
        }
      </p>
    </div>
    <button
      matButton="tonal"
      type="button"
      class="ms-auto shrink-0"
      [attr.aria-label]="showLabel()"
      (click)="show.emit()"
      i18n="@@live.class.showWho"
    >
      Ver quiénes
    </button>
  `,
  host: {
    class:
      'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warning-container p-3 text-on-warning-container',
  },
})
export class CommonFailure {
  /** `isStrongPassword("abc12345")`. */
  readonly call = input.required<string>();
  /** What the test expects, already formatted. */
  readonly expected = input.required<string>();
  readonly hidden = input(false);
  /** How many students fail it now. */
  readonly students = input.required<number>();
  readonly show = output<void>();

  protected readonly showLabel = computed(
    () => $localize`:@@live.class.showWhoLabel:Ver quiénes fallan ${this.call()}:call:`,
  );
}
