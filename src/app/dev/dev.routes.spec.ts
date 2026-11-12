import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { provideSessionOf, restoreSession } from '../auth/auth-testing';
import { provideMockData } from '../data/mock/provide-mock-data';
import type { Role } from '../data/user';
import { adminDevRoutes, devRoutes } from './dev.routes';
import { ShowcasePage } from './showcase/showcase-page';

describe('devRoutes', () => {
  it('serves the showcase at /dev/ui with its own title', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(devRoutes), provideMockData()] });
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/dev/ui', ShowcasePage);

    expect(page).toBeInstanceOf(ShowcasePage);
    expect(document.title).toBe('Muestrario');
  });
});

describe('adminDevRoutes', () => {
  async function showcaseFor(role: Role): Promise<boolean> {
    const fallback: Routes = [{ path: '**', title: '404', children: [] }];
    TestBed.configureTestingModule({
      providers: [provideSessionOf(role), provideRouter([...adminDevRoutes, ...fallback])],
    });
    await restoreSession();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dev/ui');
    return document.title === 'Muestrario';
  }

  it('serves the showcase to the administration only, as in production (D-053)', async () => {
    expect(await showcaseFor('admin')).toBe(true);
  });

  it('does not exist for any other role', async () => {
    expect(await showcaseFor('teacher')).toBe(false);
  });
});
