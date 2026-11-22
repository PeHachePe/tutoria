import { TestBed } from '@angular/core/testing';

import { PROACTIVE_LIMITS } from '../shared/proactive-reason';
import { DEFAULT_PROACTIVE_TIMING, PROACTIVE_TIMING } from './proactive-timing';

describe('PROACTIVE_TIMING', () => {
  it('follows the times of 2.7 unless the environment says otherwise', () => {
    expect(TestBed.inject(PROACTIVE_TIMING)()).toBe(DEFAULT_PROACTIVE_TIMING);
    expect(DEFAULT_PROACTIVE_TIMING).toEqual({
      checkMs: 15_000,
      writingPauseMs: 15_000,
      idleMinutes: null,
      limits: PROACTIVE_LIMITS,
    });
  });
});
