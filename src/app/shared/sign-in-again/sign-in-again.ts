import { Component, inject, input } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { AuthStore } from '../../auth/auth-store';
import { DataError } from '../../data/data-error';

/** The session expired: trying again would fail the same way until the user signs in again. */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof DataError && error.kind === 'unauthorized';
}

/**
 * «Volver a entrar», in place of «Reintentar» when the session expired: it opens the login, which
 * comes back to the same page (AuthStore.signInAgain). What was not saved stays in the local draft.
 */
@Component({
  selector: 'app-sign-in-again',
  imports: [MatButton],
  template: `
    <button [matButton]="appearance()" type="button" (click)="signInAgain()" i18n="@@signInAgain">
      Volver a entrar
    </button>
  `,
})
export class SignInAgain {
  private readonly auth = inject(AuthStore);

  /** The look of the «Reintentar» it replaces. */
  readonly appearance = input<'text' | 'tonal'>('text');

  protected signInAgain(): void {
    void this.auth.signInAgain();
  }
}
