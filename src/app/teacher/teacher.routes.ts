import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideLocalizedPaginator } from '../core/i18n/localized-paginator-intl';
import { PlaceholderPage } from '../shared/placeholder-page/placeholder-page';
import { StaffLayout } from '../shared/staff-layout/staff-layout';
import { AttemptDetailPage } from './attempt-detail/attempt-detail-page';
import { LivePage } from './live/live-page';
import { LiveStore } from './live/live-store';

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
        // Shared by the panel and the attempt detail (4.5): the detail hears the block live
        providers: [LiveStore],
        children: [
          {
            path: '',
            title: $localize`:@@route.live.title:Sesión en vivo`,
            component: LivePage,
          },
          {
            path: ':attemptId',
            title: $localize`:@@route.attempt.title:Detalle del intento`,
            component: AttemptDetailPage,
          },
        ],
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
