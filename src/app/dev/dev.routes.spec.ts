import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { devRoutes } from './dev.routes';
import { ShowcasePage } from './showcase/showcase-page';

describe('devRoutes', () => {
  it('serves the showcase at /dev/ui with its own title', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(devRoutes)] });
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/dev/ui', ShowcasePage);

    expect(page).toBeInstanceOf(ShowcasePage);
    expect(document.title).toBe('Muestrario · TutorIA');
  });
});
