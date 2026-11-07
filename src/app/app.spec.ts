import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from './app';
import { DEV_TOOLBAR } from './core/dev-toolbar-token';

@Component({ template: '<h1>Página de prueba</h1>' })
class TestPage {}

@Component({ selector: 'app-test-toolbar', template: '<p>Barra de prueba</p>' })
class TestToolbar {}

describe('App', () => {
  it('renders the page of the current route', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: 'prueba', component: TestPage }])],
    });
    const fixture = TestBed.createComponent(App);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/prueba');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Página de prueba');
  });

  it('draws the dev toolbar only when the environment provides it', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const withoutToolbar = TestBed.createComponent(App);
    await withoutToolbar.whenStable();
    expect(withoutToolbar.nativeElement.textContent).not.toContain('Barra de prueba');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DEV_TOOLBAR, useValue: TestToolbar }],
    });
    const withToolbar = TestBed.createComponent(App);
    await withToolbar.whenStable();
    expect(withToolbar.nativeElement.textContent).toContain('Barra de prueba');
  });
});
