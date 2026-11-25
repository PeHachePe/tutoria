import { Routes } from '@angular/router';

import { SEGMENTS } from '../core/app-paths';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { STAFF_GUIDE } from '../core/guide/staff-guide-token';
import { provideLocalizedPaginator } from '../core/i18n/localized-paginator-intl';
import { provideSnackBarDefaults } from '../core/snack-bar-defaults';
import { StaffLayout } from '../shared/staff-layout/staff-layout';
import { staffGuide } from './admin-guide/staff-guide';
import { SystemPage } from './system/system-page';
import { UsersPage } from './users/users-page';

/** Admin area (2.2), loaded lazily by app.routes.ts. */
export const adminRoutes: Routes = [
  {
    path: '',
    component: StaffLayout,
    // Material defaults of the area, not in app.config.ts (D-021)
    providers: [
      provideFormFieldDefaults(),
      provideLocalizedPaginator(),
      provideSnackBarDefaults(),
      // The guided help of the staff, by role (2.12, D-093)
      { provide: STAFF_GUIDE, useValue: staffGuide },
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: SEGMENTS.admin.users },
      {
        path: SEGMENTS.admin.users,
        title: $localize`:@@route.users.title:Usuarios`,
        component: UsersPage,
      },
      {
        path: SEGMENTS.admin.system,
        title: $localize`:@@route.system.title:Sistema`,
        component: SystemPage,
      },
    ],
  },
];
