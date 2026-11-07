import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StudentLayout } from './student-layout/student-layout';

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
        title: 'Ejercicios',
        component: PlaceholderPage,
        data: { heading: 'Ejercicios', step: '1.2' },
      },
      {
        path: `${SEGMENTS.student.exercise}/:id`,
        title: 'Ejercicio',
        component: PlaceholderPage,
        data: { heading: 'Ejercicio', step: '1.3' },
      },
      {
        path: SEGMENTS.student.settings,
        title: 'Ajustes',
        component: PlaceholderPage,
        data: { heading: 'Ajustes', step: '1.9' },
      },
      {
        path: SEGMENTS.student.data,
        title: 'Mis datos',
        component: PlaceholderPage,
        data: { heading: 'Datos registrados', step: '1.9' },
      },
    ],
  },
];
