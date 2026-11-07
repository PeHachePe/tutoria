import { InjectionToken, Type } from '@angular/core';

/**
 * Component of the dev toolbar, which the app draws over every page. Only environment.development.ts
 * provides it, so production neither has it nor imports its code (D-014).
 */
export const DEV_TOOLBAR = new InjectionToken<Type<unknown>>('DEV_TOOLBAR');
