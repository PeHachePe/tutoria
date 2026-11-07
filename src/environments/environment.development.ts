import { EnvironmentProviders } from '@angular/core';
import { Routes } from '@angular/router';

import { provideMockData } from '../app/data/mock/provide-mock-data';
import { devRoutes } from '../app/dev/dev.routes';
import { provideDevToolbar } from '../app/dev/provide-dev-toolbar';

/** `npm start`: everything simulated, with the dev toolbar and the /dev/ui showcase (4.4, D-014). */
export const environment = {
  dataProviders: [provideMockData()] as EnvironmentProviders[],
  devProviders: [provideDevToolbar()] as EnvironmentProviders[],
  devRoutes: devRoutes as Routes,
};
