import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { provideMockData } from '../data/mock/provide-mock-data';
import { devRoutes } from './dev.routes';
import { ShowcasePage } from './showcase/showcase-page';

describe('devRoutes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(devRoutes), provideMockData()] });
  });

  it('serves the showcase at /dev/ui with its own title', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/dev/ui', ShowcasePage);

    expect(page).toBeInstanceOf(ShowcasePage);
    expect(document.title).toBe('Muestrario');
  });
});
