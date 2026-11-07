import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import {
  provideRouter,
  TitleStrategy,
  withAutoCleanupInjectors,
  withComponentInputBinding,
} from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthStore } from './auth/auth-store';
import { AppTitleStrategy } from './core/app-title-strategy';
import { HeadingFocus } from './core/heading-focus';
import { ThemeService } from './core/theme-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route params and data as component inputs; route-provided stores destroyed on leaving (4.5)
    provideRouter(routes, withComponentInputBinding(), withAutoCleanupInjectors()),
    // Every tab title ends with the name of the app, without repeating it in each route
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    // Each environment picks the version of the data services and the dev tools (4.4)
    ...environment.dataProviders,
    ...environment.devProviders,
    // Apply the saved light/dark mode before the first screen renders, and move the focus to the
    // main heading after each navigation
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(HeadingFocus);
    }),
    // Restore the session before the first navigation, so the role guards decide synchronously
    provideAppInitializer(() => inject(AuthStore).restore()),
    // Self-hosted Material Symbols (material-symbols package), not the Google Fonts icon font
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
