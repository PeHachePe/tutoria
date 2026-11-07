import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { HeadingFocus } from './heading-focus';

@Component({ template: '<main><h1>Primera</h1></main>' })
class FirstPage {}

@Component({ template: '<main><h1 tabindex="0">Segunda</h1></main>' })
class SecondPage {}

@Component({ template: '<main><p>Sin encabezado</p></main>' })
class NoHeadingPage {}

describe('HeadingFocus', () => {
  async function start(): Promise<RouterTestingHarness> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'primera', component: FirstPage },
          { path: 'segunda', component: SecondPage },
          { path: 'vacia', component: NoHeadingPage },
        ]),
      ],
    });
    TestBed.inject(HeadingFocus);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/primera');
    return harness;
  }

  function heading(name: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>('main h1')].find(
      (element) => element.textContent === name,
    );
  }

  it('leaves the focus alone on the first page load', async () => {
    await start();

    expect(document.activeElement).not.toBe(heading('Primera'));
  });

  it('moves the focus to the main heading after a navigation, making it focusable only from code', async () => {
    const harness = await start();

    await harness.navigateByUrl('/segunda');
    await harness.navigateByUrl('/primera');
    await harness.fixture.whenStable();

    expect(document.activeElement).toBe(heading('Primera'));
    expect(heading('Primera')?.tabIndex).toBe(-1);
  });

  it('keeps the tabindex of a heading that already has one', async () => {
    const harness = await start();

    await harness.navigateByUrl('/segunda');
    await harness.fixture.whenStable();

    expect(document.activeElement).toBe(heading('Segunda'));
    expect(heading('Segunda')?.tabIndex).toBe(0);
  });

  it('does nothing when the page has no main heading', async () => {
    const harness = await start();
    const focused = document.activeElement;

    await harness.navigateByUrl('/vacia');
    await harness.fixture.whenStable();

    expect(document.activeElement).toBe(focused);
  });
});
