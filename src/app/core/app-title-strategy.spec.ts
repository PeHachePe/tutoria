import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AppTitleStrategy } from './app-title-strategy';

@Component({ template: '' })
class Page {}

describe('AppTitleStrategy', () => {
  async function visit(url: string): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'con-titulo', title: 'Acceso', component: Page },
          { path: 'sin-titulo', component: Page },
        ]),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return document.title;
  }

  it('adds the name of the app to the title of the route', async () => {
    expect(await visit('/con-titulo')).toBe('Acceso · TutorIA');
  });

  it('shows the name alone for a route without a title', async () => {
    expect(await visit('/sin-titulo')).toBe('TutorIA');
  });

  it('lets a screen name the tab after what it loaded, with the name of the app', async () => {
    await visit('/con-titulo');

    TestBed.inject(AppTitleStrategy).setScreenTitle('Suma de los elementos de un vector');

    expect(document.title).toBe('Suma de los elementos de un vector · TutorIA');
  });
});
