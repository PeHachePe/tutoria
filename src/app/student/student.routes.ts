import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { CatalogPage } from './catalog/catalog-page';
import { StudentLayout } from './student-layout/student-layout';
import { AttemptStore } from './workspace/attempt-store';
import { BrowserSignals } from './workspace/browser-signals';
import { WorkspacePage } from './workspace/workspace-page';

/** Student area (2.2), loaded lazily by app.routes.ts once the role guard lets the user in. */
export const studentRoutes: Routes = [
  {
    path: '',
    component: StudentLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [provideFormFieldDefaults()],
    children: [
      {
        path: '',
        title: $localize`:@@route.catalog.title:Ejercicios`,
        component: CatalogPage,
      },
      {
        path: `${SEGMENTS.student.exercise}/:id`,
        // Generic until the exercise loads: then the page names the tab after it
        title: $localize`:@@route.exercise.title:Ejercicio`,
        component: WorkspacePage,
        // The attempt of the exercise, shared by its zones, and its browser signals (2.8), both
        // destroyed on leaving (4.5)
        providers: [AttemptStore, BrowserSignals],
      },
      {
        path: SEGMENTS.student.settings,
        title: $localize`:@@route.settings.title:Ajustes`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.settings.heading:Ajustes`, step: '1.9' },
      },
      {
        path: SEGMENTS.student.data,
        title: $localize`:@@route.myData.title:Mis datos`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.myData.heading:Datos registrados`, step: '1.9' },
      },
    ],
  },
];
