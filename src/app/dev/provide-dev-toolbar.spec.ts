import { TestBed } from '@angular/core/testing';

import { DEV_TOOLBAR } from '../core/dev-toolbar-token';
import { DevToolbar } from './dev-toolbar/dev-toolbar';
import { provideDevToolbar } from './provide-dev-toolbar';

describe('provideDevToolbar', () => {
  it('registers the dev toolbar component for App to draw', () => {
    TestBed.configureTestingModule({ providers: [provideDevToolbar()] });

    expect(TestBed.inject(DEV_TOOLBAR)).toBe(DevToolbar);
  });
});
