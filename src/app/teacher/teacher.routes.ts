import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideSpanishPaginator } from '../core/spanish-paginator-intl';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';

/** Teacher area (2.2), also open to the admin. Loaded lazily by app.routes.ts. */
export const teacherRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [provideFormFieldDefaults(), provideSpanishPaginator()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTS.teacher.live },
      {
        path: SEGMENTS.teacher.live,
        title: 'Sesión en vivo',
        component: PlaceholderPage,
        data: { heading: 'Sesión en vivo', step: '4.1' },
      },
      {
        path: `${SEGMENTS.teacher.live}/:attemptId`,
        title: 'Detalle del intento',
        component: PlaceholderPage,
        data: { heading: 'Detalle del intento', step: '4.2' },
      },
      {
        path: SEGMENTS.teacher.history,
        title: 'Histórico',
        component: PlaceholderPage,
        data: { heading: 'Histórico', step: '4.4' },
      },
      {
        path: SEGMENTS.teacher.exercises,
        title: 'Ejercicios',
        component: PlaceholderPage,
        data: { heading: 'Ejercicios y asignaciones', step: '4.3' },
      },
      {
        path: SEGMENTS.teacher.groups,
        title: 'Grupos',
        component: PlaceholderPage,
        data: { heading: 'Grupos y matrícula', step: '5.2' },
      },
    ],
  },
];
