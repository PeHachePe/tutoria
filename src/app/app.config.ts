import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { SpanishPaginatorIntl } from './core/spanish-paginator-intl';
import { ThemeService } from './core/theme-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Each environment picks the version of the data services and the dev tools (4.4)
    ...environment.dataProviders,
    ...environment.devProviders,
    // Apply the saved light/dark mode before the first screen renders
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Self-hosted Material Symbols (material-symbols package), not the Google Fonts icon font
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl },
    // Outlined fields: closer to the prototypes and lighter on white panels than filled ones
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
  ],
};
