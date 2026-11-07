import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideSpanishPaginator } from '../core/spanish-paginator-intl';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';

/** Admin area (2.2), loaded lazily by app.routes.ts. */
export const adminRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [provideFormFieldDefaults(), provideSpanishPaginator()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTS.admin.users },
      {
        path: SEGMENTS.admin.users,
        title: 'Usuarios',
        component: PlaceholderPage,
        data: { heading: 'Usuarios', step: '5.1' },
      },
      {
        path: SEGMENTS.admin.system,
        title: 'Sistema',
        component: PlaceholderPage,
        data: { heading: 'Ajustes del sistema', step: '5.3' },
      },
    ],
  },
];
