import { TestBed } from '@angular/core/testing';

import { DEV_TOOLBAR } from '../core/dev-toolbar-token';
import { PROACTIVE_TIMING } from '../core/proactive-timing';
import { DevProactivity, FAST_PROACTIVE_TIMING } from './dev-proactivity';
import { DevToolbar } from './dev-toolbar/dev-toolbar';
import { provideDevToolbar } from './provide-dev-toolbar';

describe('provideDevToolbar', () => {
  it('registers the dev toolbar component for App to draw', () => {
    TestBed.configureTestingModule({ providers: [provideDevToolbar()] });

    expect(TestBed.inject(DEV_TOOLBAR)).toBe(DevToolbar);
  });

  it('gives the proactive tutor the times of the toolbar', () => {
    TestBed.configureTestingModule({ providers: [provideDevToolbar()] });

    TestBed.inject(DevProactivity).setFast(true);

    expect(TestBed.inject(PROACTIVE_TIMING)()).toBe(FAST_PROACTIVE_TIMING);
  });
});
