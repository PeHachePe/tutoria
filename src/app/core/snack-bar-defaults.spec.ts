import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { provideSnackBarDefaults, SNACK_BAR_DURATION_MS } from './snack-bar-defaults';

describe('provideSnackBarDefaults', () => {
  afterEach(() => vi.useRealTimers());

  it('closes the notices of the area once they have been read, also those with «Deshacer»', async () => {
    vi.useFakeTimers();
    // As the routes of an area provide it: below the root, which has the MatSnackBar of the app
    const area = createEnvironmentInjector(
      [provideSnackBarDefaults()],
      TestBed.inject(EnvironmentInjector),
    );
    const ref = area.get(MatSnackBar).open('Ejercicio archivado', 'Deshacer');
    let dismissed = false;
    ref.afterDismissed().subscribe(() => (dismissed = true));

    await vi.advanceTimersByTimeAsync(SNACK_BAR_DURATION_MS - 100);
    expect(dismissed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(dismissed).toBe(true);
  });
});
