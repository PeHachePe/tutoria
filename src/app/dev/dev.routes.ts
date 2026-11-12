import { Routes } from '@angular/router';

import { roleGuard } from '../auth/role-guard';
import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideLocalizedPaginator } from '../core/i18n/localized-paginator-intl';
import { DEV_SEGMENTS } from './dev-paths';

/** Development routes, open to anyone: environment.development.ts and environment.local.ts. */
export const devRoutes: Routes = [
  {
    path: `${DEV_SEGMENTS.area}/${DEV_SEGMENTS.showcase}`,
    title: 'Muestrario',
    providers: [provideFormFieldDefaults(), provideLocalizedPaginator()],
    loadComponent: () => import('./showcase/showcase-page').then((m) => m.ShowcasePage),
  },
];

/**
 * The same routes in production, for the administration only (D-053): the showcase depends on no
 * mock data, and for any other role it does not exist, so its code is never downloaded.
 */
export const adminDevRoutes: Routes = devRoutes.map((route) => ({
  ...route,
  canMatch: [roleGuard('admin')],
}));
