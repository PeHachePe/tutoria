import { NgComponentOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DEV_TOOLBAR } from './core/dev-toolbar-token';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgComponentOutlet],
  template: `
    <router-outlet />
    @if (devToolbar) {
      <ng-container *ngComponentOutlet="devToolbar" />
    }
  `,
})
export class App {
  /** Only in development builds. */
  protected readonly devToolbar = inject(DEV_TOOLBAR, { optional: true });
}
