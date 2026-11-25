import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { BlockService } from '../../data/block-service';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import type { Role } from '../../data/user';
import { staffGuide } from './staff-guide';

const SIDE_MENU = {
  open: () => undefined,
  close: () => undefined,
  closed: () => Promise.resolve(),
};

describe('staffGuide', () => {
  function profileOf(role: Role | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { user: signal(null), userId: signal('x'), role: signal(role) },
        },
        { provide: GroupService, useValue: {} },
        { provide: ExerciseService, useValue: {} },
        { provide: BlockService, useValue: {} },
      ],
    });
    return TestBed.runInInjectionContext(() => staffGuide(SIDE_MENU));
  }

  it('is chosen by the role, in both areas (D-093)', () => {
    expect(profileOf('teacher')?.id).toBe('teacher');
    TestBed.resetTestingModule();
    expect(profileOf('admin')?.id).toBe('admin');
    TestBed.resetTestingModule();
    expect(profileOf('student')).toBeUndefined();
  });
});
