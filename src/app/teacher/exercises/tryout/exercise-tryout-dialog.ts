import { Component, signal } from '@angular/core';
import type { MatDialog, MatDialogRef } from '@angular/material/dialog';

import type { TryoutExercise } from './tryout-exercise';
import { TRYOUT_HEADING_ID, TryoutWorkspace } from './tryout-workspace';

/**
 * «Probar como alumno» (4.3e, D-061): the workspace of the student over the whole screen, on top of
 * the form, so the teacher tries the exercise as it is and goes back to the form as they left it.
 * «Empezar de nuevo» creates the try again, with its stores and its memory.
 */
@Component({
  selector: 'app-exercise-tryout-dialog',
  imports: [TryoutWorkspace],
  template: `
    @for (run of [run()]; track run) {
      <app-tryout-workspace (startAgain)="startAgain()" />
    }
  `,
})
export class ExerciseTryoutDialog {
  protected readonly run = signal(0);

  protected startAgain(): void {
    this.run.update((run) => run + 1);
  }
}

/**
 * Opens the try over the whole screen. Esc does not close it: the workspace uses it to fold the
 * tutor and inside the editor, and losing the try by accident would be worse than the button.
 */
export function openTryout(
  dialog: MatDialog,
  exercise: TryoutExercise,
): MatDialogRef<ExerciseTryoutDialog> {
  return dialog.open<ExerciseTryoutDialog, TryoutExercise>(ExerciseTryoutDialog, {
    data: exercise,
    width: '100vw',
    height: '100dvh',
    maxWidth: '100vw',
    maxHeight: '100dvh',
    panelClass: 'app-fullscreen-dialog',
    ariaLabelledBy: TRYOUT_HEADING_ID,
    autoFocus: false,
    disableClose: true,
  });
}
