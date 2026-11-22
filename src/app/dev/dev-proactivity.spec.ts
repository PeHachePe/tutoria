import { TestBed } from '@angular/core/testing';

import { DEFAULT_PROACTIVE_TIMING } from '../core/proactive-timing';
import { DevProactivity, FAST_PROACTIVE_TIMING } from './dev-proactivity';

describe('DevProactivity', () => {
  it('starts with the times of 2.7 and makes them short while it is fast', () => {
    const proactivity = TestBed.inject(DevProactivity);
    expect(proactivity.fast()).toBe(false);
    expect(proactivity.timing()).toBe(DEFAULT_PROACTIVE_TIMING);

    proactivity.setFast(true);
    expect(proactivity.timing()).toBe(FAST_PROACTIVE_TIMING);

    proactivity.setFast(false);
    expect(proactivity.timing()).toBe(DEFAULT_PROACTIVE_TIMING);
  });

  it('shortens the pause, the cooldown, the checks and the pause in writing, not the failures', () => {
    expect(FAST_PROACTIVE_TIMING).toEqual({
      checkMs: 5000,
      writingPauseMs: 5000,
      idleMinutes: 0.5,
      limits: { ...DEFAULT_PROACTIVE_TIMING.limits, cooldownMs: 20_000 },
    });
  });
});
