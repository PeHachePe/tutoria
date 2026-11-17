import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AppTitleStrategy } from './app-title-strategy';

@Component({ template: '' })
class Page {}

describe('AppTitleStrategy', () => {
  let harness: RouterTestingHarness;

  async function visit(url: string): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'con-titulo', title: 'Acceso', component: Page },
          { path: 'sin-titulo', component: Page },
          { path: 'otro', title: 'Otro', component: Page },
        ]),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
      ],
    });
    harness = await RouterTestingHarness.create();
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

  it('keeps the title of the screen when only the query or the fragment change', async () => {
    await visit('/con-titulo');
    TestBed.inject(AppTitleStrategy).setScreenTitle('1.º DAW A · En vivo');

    await harness.navigateByUrl('/con-titulo?bloque=b2');
    await harness.navigateByUrl('/con-titulo?bloque=b2#alumnado');

    expect(document.title).toBe('1.º DAW A · En vivo · TutorIA');
  });

  it('sets the title of the route again on another screen', async () => {
    await visit('/con-titulo');
    TestBed.inject(AppTitleStrategy).setScreenTitle('1.º DAW A · En vivo');

    await harness.navigateByUrl('/otro?bloque=b2');

    expect(document.title).toBe('Otro · TutorIA');
  });
});
