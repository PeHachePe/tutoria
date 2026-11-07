import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { provideMockData } from '../data/mock/provide-mock-data';
import { DataExplorerPage } from './data-explorer/data-explorer-page';
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

  it('serves the mock data explorer at /dev/datos with its own title', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/dev/datos', DataExplorerPage);

    expect(page).toBeInstanceOf(DataExplorerPage);
    expect(document.title).toBe('Datos simulados');
  });
});
