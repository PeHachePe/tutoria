import { Routes } from '@angular/router';

/** Development-only routes, registered by environment.development.ts. */
export const devRoutes: Routes = [
  {
    path: 'dev/ui',
    title: 'Muestrario · TutorIA',
    loadComponent: () => import('./showcase/showcase-page').then((m) => m.ShowcasePage),
  },
  {
    path: 'dev/datos',
    title: 'Datos simulados · TutorIA',
    loadComponent: () =>
      import('./data-explorer/data-explorer-page').then((m) => m.DataExplorerPage),
  },
];
