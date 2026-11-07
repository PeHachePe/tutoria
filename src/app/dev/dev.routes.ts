import { Routes } from '@angular/router';

import { provideFormFieldDefaults } from '../core/form-field-defaults';
import { provideLocalizedPaginator } from '../core/localized-paginator-intl';
import { DEV_SEGMENTS } from './dev-paths';

/** Development-only routes, registered by environment.development.ts. */
export const devRoutes: Routes = [
  {
    path: `${DEV_SEGMENTS.area}/${DEV_SEGMENTS.showcase}`,
    title: 'Muestrario',
    providers: [provideFormFieldDefaults(), provideLocalizedPaginator()],
    loadComponent: () => import('./showcase/showcase-page').then((m) => m.ShowcasePage),
  },
  {
    path: `${DEV_SEGMENTS.area}/${DEV_SEGMENTS.data}`,
    title: 'Datos simulados',
    providers: [provideFormFieldDefaults()],
    loadComponent: () =>
      import('./data-explorer/data-explorer-page').then((m) => m.DataExplorerPage),
  },
];
