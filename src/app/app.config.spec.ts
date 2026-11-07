import { ApplicationInitStatus, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen } from '@testing-library/angular';

import { environment } from '../environments/environment';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { AuthStore } from './auth/auth-store';
import { DAW_STUDENT_IDS } from './data/mock/fixtures/users';
import { MOCK_SESSION_STORAGE_KEY } from './data/mock/mock-db';
import { MOCK_NETWORK_STORAGE_KEY } from './data/mock/mock-network';

describe('appConfig', () => {
  beforeEach(() => {
    // A student signed in with the simulated data of the development environment, without waiting
    localStorage.setItem(MOCK_SESSION_STORAGE_KEY, DAW_STUDENT_IDS[0]);
    localStorage.setItem(MOCK_NETWORK_STORAGE_KEY, JSON.stringify({ min: 0, max: 0 }));
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  afterEach(() => localStorage.clear());

  it('registers the app routes in the router', () => {
    expect(TestBed.inject(Router).config).toEqual(routes);
  });

  it('registers the data services and dev tools of the environment', () => {
    expect(appConfig.providers).toEqual(
      expect.arrayContaining([...environment.dataProviders, ...environment.devProviders]),
    );
  });

  it('restores the session on start-up, before the first navigation', async () => {
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(AuthStore).userId()).toBe(DAW_STUDENT_IDS[0]);
  });

  it('passes the route data to the screens as inputs', async () => {
    await TestBed.inject(ApplicationInitStatus).donePromise;

    await RouterTestingHarness.create('/alumno/ajustes');

    expect(screen.getByText('Esta pantalla se construye en el paso 1.9.')).toBeTruthy();
  });

  it('applies the colour mode on start-up', async () => {
    document.documentElement.style.colorScheme = '';

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(DOCUMENT).documentElement.style.colorScheme).toBe('light dark');
  });

  it('uses the self-hosted Material Symbols font for icons', () => {
    expect(TestBed.inject(MAT_ICON_DEFAULT_OPTIONS).fontSet).toBe('material-symbols-outlined');
  });
});
