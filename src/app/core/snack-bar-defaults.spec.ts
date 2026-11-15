import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';

import { provideSnackBarDefaults, SNACK_BAR_DURATION_MS } from './snack-bar-defaults';

describe('provideSnackBarDefaults', () => {
  it('keeps the notices on screen long enough to read them', () => {
    TestBed.configureTestingModule({ providers: [provideSnackBarDefaults()] });

    expect(TestBed.inject(MAT_SNACK_BAR_DEFAULT_OPTIONS).duration).toBe(SNACK_BAR_DURATION_MS);
  });
});
