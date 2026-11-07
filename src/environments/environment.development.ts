import { EnvironmentProviders } from '@angular/core';
import { Routes } from '@angular/router';

import { provideMockData } from '../app/data/mock/provide-mock-data';
import { devRoutes } from '../app/dev/dev.routes';
import { provideDemoAccounts } from '../app/dev/provide-demo-accounts';
import { provideDevToolbar } from '../app/dev/provide-dev-toolbar';

/**
 * `npm start`: everything simulated, with the dev toolbar, the demo accounts of the login and the
 * /dev/ui showcase (4.4, D-014, D-021).
 */
export const environment = {
  dataProviders: [provideMockData()] as EnvironmentProviders[],
  devProviders: [provideDevToolbar(), provideDemoAccounts()] as EnvironmentProviders[],
  devRoutes: devRoutes as Routes,
};
