import { EnvironmentProviders } from '@angular/core';
import { Routes } from '@angular/router';

import { provideSupabaseData } from '../app/data/supabase/provide-supabase-data';
import { devRoutes } from '../app/dev/dev.routes';
import { provideDemoAccounts } from '../app/dev/provide-demo-accounts';

/**
 * `npm run start:local`: the local Supabase of `npm run db:start` (4.4). The publishable key is the
 * one every local Supabase uses, public by design: the RLS protects the data, not the key. The
 * demo accounts of the login work because the seed is the same; the dev toolbar does not, as it
 * acts on the mock data (`npm run db:reset` and Studio take its place).
 */
export const environment = {
  dataProviders: [
    provideSupabaseData({
      url: 'http://127.0.0.1:55321',
      publishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
    }),
  ] as EnvironmentProviders[],
  devProviders: [provideDemoAccounts()] as EnvironmentProviders[],
  devRoutes: devRoutes as Routes,
};
