import { Provider } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

/**
 * Outlined Material fields: closer to the prototypes and lighter on white panels than filled ones.
 *
 * Each lazy area (and each dev-only component with fields) provides it, never app.config.ts: a
 * static import of the form-field module from the main bundle would drag it, and Signal Forms with
 * it, into the initial JavaScript of every user (D-021).
 */
export function provideFormFieldDefaults(): Provider {
  return { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } };
}
