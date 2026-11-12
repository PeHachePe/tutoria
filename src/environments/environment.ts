import { EnvironmentProviders } from '@angular/core';
import { Routes } from '@angular/router';

import { provideSupabaseData } from '../app/data/supabase/provide-supabase-data';
import { adminDevRoutes } from '../app/dev/dev.routes';

/**
 * Production: the Supabase project in the cloud (step 3.1). Its URL and publishable key are public
 * by design, like the local ones: the RLS protects the data, not the key, so they live here and
 * every build is the same, with nothing to set in Vercel (D-053). It imports nothing from
 * `data/mock/` and, from `dev/`, only the showcase routes, for the administration (D-014, D-053):
 * neither the mock data nor the dev toolbar nor the demo accounts reach its build.
 */
export const environment = {
  dataProviders: [
    provideSupabaseData({
      url: 'https://ymqjqcpzskxqckmtgeow.supabase.co',
      publishableKey: 'sb_publishable_jXA6YqoSpFkvMU8XVNzuTQ_fZFarIs_',
    }),
  ] as EnvironmentProviders[],
  devProviders: [] as EnvironmentProviders[],
  devRoutes: adminDevRoutes as Routes,
};
