import { Provider } from '@angular/core';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';

/** How long a notice stays: enough to read two lines and reach «Deshacer» with the keyboard. */
export const SNACK_BAR_DURATION_MS = 6000;

/**
 * The notices of the staff screens (4.3): what an action did when nothing else on the screen shows
 * it, such as a deleted exercise. Provided by each area, like the form fields (D-021).
 */
export function provideSnackBarDefaults(): Provider {
  return {
    provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
    useValue: { duration: SNACK_BAR_DURATION_MS },
  };
}
