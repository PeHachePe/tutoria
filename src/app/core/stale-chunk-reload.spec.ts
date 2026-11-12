import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withNavigationErrorHandler } from '@angular/router';

import { PageReloader } from './page-reloader';
import { reloadOnStaleChunk, STALE_CHUNK_RELOAD_KEY } from './stale-chunk-reload';

describe('reloadOnStaleChunk', () => {
  const open = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    open.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  function setup(failure: Error): Router {
    TestBed.configureTestingModule({
      providers: [
        { provide: PageReloader, useValue: { open } },
        provideRouter(
          [{ path: 'docente', loadComponent: () => Promise.reject(failure) }],
          withNavigationErrorHandler(reloadOnStaleChunk),
        ),
      ],
    });
    return TestBed.inject(Router);
  }

  const stale = () =>
    new TypeError('Failed to fetch dynamically imported module: https://x.test/chunk-OLD.js');

  it('loads the page asked for from scratch when its code is from an older deployment', async () => {
    const router = setup(stale());

    await router.navigateByUrl('/docente?grupo=1').catch(() => undefined);

    expect(open).toHaveBeenCalledWith('/docente?grupo=1');
  });

  it('knows the messages of Firefox and Safari too', async () => {
    const router = setup(new TypeError('Importing a module script failed.'));

    await router.navigateByUrl('/docente').catch(() => undefined);

    expect(open).toHaveBeenCalledOnce();
  });

  it('does not reload in a loop when the code is still missing after reloading', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-12T10:00:00Z') });
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now() - 1_000));
    const router = setup(stale());

    await router.navigateByUrl('/docente').catch(() => undefined);

    expect(open).not.toHaveBeenCalled();
  });

  it('reloads again long after the previous time', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-12T10:00:00Z') });
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now() - 60 * 60_000));
    const router = setup(stale());

    await router.navigateByUrl('/docente').catch(() => undefined);

    expect(open).toHaveBeenCalledOnce();
  });

  it('leaves any other error to the router', async () => {
    const router = setup(new Error('boom'));

    await router.navigateByUrl('/docente').catch(() => undefined);

    expect(open).not.toHaveBeenCalled();
  });
});
