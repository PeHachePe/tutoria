import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from './app';

@Component({ template: '<h1>Página de prueba</h1>' })
class TestPage {}

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
});
