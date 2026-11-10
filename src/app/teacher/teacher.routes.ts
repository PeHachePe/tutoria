import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideLocalizedPaginator } from '../core/i18n/localized-paginator-intl';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';

/** Teacher area (2.2), also open to the admin. Loaded lazily by app.routes.ts. */
export const teacherRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [provideFormFieldDefaults(), provideLocalizedPaginator()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTS.teacher.live },
      {
        path: SEGMENTS.teacher.live,
        title: $localize`:@@route.live.title:Sesión en vivo`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.live.heading:Sesión en vivo`, step: '4.1' },
      },
      {
        path: `${SEGMENTS.teacher.live}/:attemptId`,
        title: $localize`:@@route.attempt.title:Detalle del intento`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.attempt.heading:Detalle del intento`, step: '4.2' },
      },
      {
        path: SEGMENTS.teacher.history,
        title: $localize`:@@route.history.title:Histórico`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.history.heading:Histórico`, step: '4.4' },
      },
      {
        path: SEGMENTS.teacher.exercises,
        title: $localize`:@@route.exercises.title:Ejercicios`,
        component: PlaceholderPage,
        data: {
          heading: $localize`:@@route.exercises.heading:Ejercicios y asignaciones`,
          step: '4.3',
        },
      },
      {
        path: SEGMENTS.teacher.groups,
        title: $localize`:@@route.groups.title:Grupos`,
        component: PlaceholderPage,
        data: { heading: $localize`:@@route.groups.heading:Grupos y matrícula`, step: '5.2' },
      },
    ],
  },
];
