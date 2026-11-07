import { Routes } from '@angular/router';

import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';

/** Teacher area (2.2), also open to the admin. Loaded lazily by app.routes.ts. */
export const teacherRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'en-vivo' },
      {
        path: 'en-vivo',
        title: 'Sesión en vivo · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Sesión en vivo', step: '4.1' },
      },
      {
        path: 'en-vivo/:attemptId',
        title: 'Detalle del intento · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Detalle del intento', step: '4.2' },
      },
      {
        path: 'historico',
        title: 'Histórico · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Histórico', step: '4.4' },
      },
      {
        path: 'ejercicios',
        title: 'Ejercicios · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Ejercicios y asignaciones', step: '4.3' },
      },
      {
        path: 'grupos',
        title: 'Grupos · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Grupos y matrícula', step: '5.2' },
      },
    ],
  },
];
