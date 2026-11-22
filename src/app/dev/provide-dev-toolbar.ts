import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';

import { DEV_TOOLBAR } from '../core/dev-toolbar-token';
import { PROACTIVE_TIMING } from '../core/proactive-timing';
import { DevProactivity } from './dev-proactivity';
import { DevToolbar } from './dev-toolbar/dev-toolbar';

/**
 * Draws the dev toolbar over every page, and lets it make the proactive tutor fast. Only
 * environment.development.ts registers it.
 */
export function provideDevToolbar(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DEV_TOOLBAR, useValue: DevToolbar },
    { provide: PROACTIVE_TIMING, useFactory: () => inject(DevProactivity).timing },
  ]);
}
