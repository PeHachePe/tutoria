import { Routes } from '@angular/router';

import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StudentLayout } from './student-layout/student-layout';

/** Student area (2.2), loaded lazily by app.routes.ts once the role guard lets the user in. */
export const studentRoutes: Routes = [
  {
    path: '',
    component: StudentLayout,
    children: [
      {
        path: '',
        title: 'Ejercicios · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Ejercicios', step: '1.2' },
      },
      {
        path: 'ejercicio/:id',
        title: 'Ejercicio · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Ejercicio', step: '1.3' },
      },
      {
        path: 'ajustes',
        title: 'Ajustes · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Ajustes', step: '1.9' },
      },
      {
        path: 'datos',
        title: 'Mis datos · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Datos registrados', step: '1.9' },
      },
    ],
  },
];
