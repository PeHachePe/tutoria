import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { DEV_TOOLBAR } from '../core/dev-toolbar-token';
import { DevToolbar } from './dev-toolbar/dev-toolbar';

/** Draws the dev toolbar over every page. Only environment.development.ts registers it. */
export function provideDevToolbar(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DEV_TOOLBAR, useValue: DevToolbar }]);
}
