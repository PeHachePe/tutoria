import { EnvironmentProviders, Provider } from '@angular/core';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

/**
 * Providers of every unit test (`providersFile` in angular.json); a test can still override them.
 *
 * Material without animations: jsdom never plays them, so Material waited for each one with a
 * timer, and a dialog took the focus, or a menu said it was closed, only once it ran out. Every
 * dialog and menu of a test waited so, longer under load.
 */
export default [
  { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
] satisfies (Provider | EnvironmentProviders)[];
