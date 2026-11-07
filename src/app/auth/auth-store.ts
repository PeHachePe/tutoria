import { computed, inject, Service, signal } from '@angular/core';

import { AuthService, Credentials } from '../data/auth-service';
import { DataError, DataErrorKind } from '../data/data-error';
import type { AppUser } from '../data/user';

export type SignInResult =
  | { readonly ok: true; readonly user: AppUser }
  | { readonly ok: false; readonly error: DataErrorKind };

/**
 * The signed-in user and their role (4.5): the guards, the menus and almost every screen read it.
 * The session is restored once, before the first navigation (app.config.ts), so the guards can
 * decide synchronously.
 */
@Service()
export class AuthStore {
  private readonly auth = inject(AuthService);

  private readonly userState = signal<AppUser | null>(null);

  readonly user = this.userState.asReadonly();
  /** `undefined` without a session, so a `resource()` keyed on it stays idle. */
  readonly userId = computed(() => this.userState()?.id);
  readonly role = computed(() => this.userState()?.role);
  readonly signedIn = computed(() => this.userState() !== null);

  async restore(): Promise<void> {
    try {
      this.userState.set(await this.auth.currentUser());
    } catch {
      // Without an answer there is no usable session: the guards send the user to the login.
      this.userState.set(null);
    }
  }

  async signIn(credentials: Credentials): Promise<SignInResult> {
    try {
      const user = await this.auth.signIn(credentials);
      this.userState.set(user);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error instanceof DataError ? error.kind : 'unknown' };
    }
  }

  /** Forgets the user even if the server cannot be reached: the device must not stay signed in. */
  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // Nothing else to do: the local session is gone either way.
    } finally {
      this.userState.set(null);
    }
  }
}
