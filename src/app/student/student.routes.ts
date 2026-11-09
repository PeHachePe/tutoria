import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { MASCOT_ACCESSORIES } from '../shared/mascot/mascot-accessories';
import { CatalogPage } from './catalog/catalog-page';
import { RegisteredDataPage } from './registered-data/registered-data-page';
import { SettingsPage } from './settings/settings-page';
import { SettingsStore } from './settings/settings-store';
import { StudentLayout } from './student-layout/student-layout';

/** Student area (2.2), loaded lazily by app.routes.ts once the role guard lets the user in. */
export const studentRoutes: Routes = [
  {
    path: '',
    component: StudentLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [
      provideFormFieldDefaults(),
      // Every mascot of the area wears what the student chose in the settings (1.9)
      {
        provide: MASCOT_ACCESSORIES,
        useFactory: () => {
          const settings = inject(SettingsStore);
          return {
            headset: settings.mascotHeadset,
            bowTie: settings.mascotBowTie,
            boneCursor: settings.mascotBoneCursor,
          };
        },
      },
    ],
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
        // A chunk of its own, with its stores (workspace.routes.ts)
        loadChildren: () =>
          import('./workspace/workspace.routes').then((module) => module.workspaceRoutes),
      },
      {
        path: SEGMENTS.student.settings,
        title: $localize`:@@route.settings.title:Ajustes`,
        component: SettingsPage,
      },
      {
        path: SEGMENTS.student.data,
        title: $localize`:@@route.myData.title:Mis datos`,
        component: RegisteredDataPage,
      },
    ],
  },
];
