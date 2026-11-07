import { Routes } from '@angular/router';

import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';

/** Admin area (2.2), loaded lazily by app.routes.ts. */
export const adminRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'usuarios' },
      {
        path: 'usuarios',
        title: 'Usuarios · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Usuarios', step: '5.1' },
      },
      {
        path: 'sistema',
        title: 'Sistema · TutorIA',
        component: PlaceholderPage,
        data: { heading: 'Ajustes del sistema', step: '5.3' },
      },
    ],
  },
];
