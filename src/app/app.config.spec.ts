import { ApplicationInitStatus, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Router } from '@angular/router';

import { environment } from '../environments/environment';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { SpanishPaginatorIntl } from './core/spanish-paginator-intl';

describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  it('registers the app routes in the router', () => {
    expect(TestBed.inject(Router).config).toEqual(routes);
  });

  it('registers the data services and dev tools of the environment', () => {
    expect(appConfig.providers).toEqual(
      expect.arrayContaining([...environment.dataProviders, ...environment.devProviders]),
    );
  });

  it('applies the colour mode on start-up', async () => {
    document.documentElement.style.colorScheme = '';

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(DOCUMENT).documentElement.style.colorScheme).toBe('light dark');
  });

  it('uses the self-hosted Material Symbols font for icons', () => {
    expect(TestBed.inject(MAT_ICON_DEFAULT_OPTIONS).fontSet).toBe('material-symbols-outlined');
  });

  it('shows Material paginators in Spanish', () => {
    expect(TestBed.inject(MatPaginatorIntl)).toBeInstanceOf(SpanishPaginatorIntl);
  });

  it('draws form fields with the outline appearance', () => {
    expect(TestBed.inject(MAT_FORM_FIELD_DEFAULT_OPTIONS).appearance).toBe('outline');
  });
});
