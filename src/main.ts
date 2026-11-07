/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';

import { loadLocale } from './app/core/load-locale';
import { pickLocale, readSavedLocale } from './app/core/locale';

// The translations must be in place before any module that calls $localize when it is evaluated
// (route titles, menu labels…), so the app is imported only after loading them (D-023).
loadLocale(pickLocale(readSavedLocale(), navigator.languages), document)
  .then(() => Promise.all([import('./app/app.config'), import('./app/app')]))
  .then(([{ appConfig }, { App }]) => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
