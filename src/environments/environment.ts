import { EnvironmentProviders } from '@angular/core';
import { Routes } from '@angular/router';

/**
 * Production. It imports nothing from `data/mock/` or `dev/`, so the mock data, the dev toolbar and
 * /dev/ui never reach its build (D-014).
 */
export const environment = {
  // provideSupabaseData() arrives with the real back end (phase 2).
  dataProviders: [] as EnvironmentProviders[],
  devProviders: [] as EnvironmentProviders[],
  devRoutes: [] as Routes,
};
