import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { CanDeactivateFn } from '@angular/router';

import { confirmAction } from '../shared/confirm-dialog/confirm-dialog';

/** A screen that can have changes nobody saved yet, such as the exercise form (4.3). */
export interface WithUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a screen with unsaved changes, so a click on the menu never loses them. The
 * screen also warns when the tab closes (`beforeunload`), which a guard cannot see.
 */
export const unsavedChangesGuard: CanDeactivateFn<WithUnsavedChanges> = (screen) =>
  !screen.hasUnsavedChanges() ||
  confirmAction(inject(MatDialog), {
    title: $localize`:@@unsaved.title:¿Salir sin guardar?`,
    text: $localize`:@@unsaved.text:Los cambios que no has guardado se perderán.`,
    confirm: $localize`:@@unsaved.confirm:Salir sin guardar`,
  });
