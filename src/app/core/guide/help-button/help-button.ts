import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, Injector, untracked } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { GUIDE_ANCHORS, GuideAnchor } from '../guide-anchor';
import { GuideStore } from '../guide-store';
import { HELP_PANEL_TITLE_ID, HelpPanel } from '../help-panel/help-panel';

/** Below this width the panel takes the whole screen (Material's breakpoint of phones). */
const PHONE = '(max-width: 599.98px)';
const PANEL_WIDTH = '26rem';

/**
 * The single entry to the guided help (2.12, ficha 13), in the top bar of both layouts: it opens the
 * help panel and, while first steps are left, shows a dot and says how many are done. It also
 * starts the welcome of the area when it is due.
 */
@Component({
  selector: 'app-help-button',
  imports: [MatIconButton, MatIcon, MatTooltip, GuideAnchor],
  template: `
    <!-- The dot goes on a box of its own: the styles of Material would win over it on the button -->
    <span class="relative inline-flex">
      <button
        matIconButton
        type="button"
        [appGuideAnchor]="anchor"
        [attr.aria-label]="label()"
        matTooltip="Ayuda"
        i18n-matTooltip="@@helpButton.tooltip"
        (click)="open()"
      >
        <mat-icon>help</mat-icon>
      </button>
      @if (pending() > 0) {
        <span
          class="pointer-events-none absolute end-2 top-2 size-2.5 rounded-full border-2 border-primary-container bg-primary"
          aria-hidden="true"
        ></span>
      }
    </span>
  `,
})
export class HelpButton {
  private readonly guide = inject(GuideStore);
  private readonly dialog = inject(MatDialog);
  private readonly breakpoints = inject(BreakpointObserver);
  /** The panel works with the same GuideStore as its button, also one provided below the root. */
  private readonly injector = inject(Injector);

  protected readonly anchor = GUIDE_ANCHORS.help;
  protected readonly pending = this.guide.pendingFirstSteps;
  protected readonly label = computed(() => {
    const { done, total } = this.guide.firstSteps();
    return this.pending() > 0
      ? $localize`:@@helpButton.pending:Ayuda: ${done}:done: de ${total}:total: primeros pasos hechos`
      : $localize`:@@helpButton.label:Ayuda`;
  });

  constructor() {
    // At the edge with driver.js (4.8): the welcome waits for several signals at once (what was
    // saved and the data read, its screen open, the data notice accepted), and starting it is an
    // imperative call. It counts as seen as soon as it starts, so it runs once.
    effect(() => {
      if (this.guide.welcomeDue()) untracked(() => void this.guide.startWelcome());
    });
  }

  protected open(): void {
    const phone = this.breakpoints.isMatched(PHONE);
    this.dialog.open(HelpPanel, {
      panelClass: 'app-side-panel',
      position: { right: '0', top: '0' },
      height: '100dvh',
      width: phone ? '100vw' : PANEL_WIDTH,
      maxWidth: '100vw',
      ariaLabelledBy: HELP_PANEL_TITLE_ID,
      injector: this.injector,
      autoFocus: `#${HELP_PANEL_TITLE_ID}`,
    });
  }
}
