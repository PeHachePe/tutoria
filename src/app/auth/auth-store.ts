import { computed, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PageReloader } from '../core/page-reloader';
import { AuthService, Credentials } from '../data/auth-service';
import { DataError, DataErrorKind } from '../data/data-error';
import type { AppUser } from '../data/user';
import { loginRedirect } from './login-redirect';

/**
 * Why the user is on the login without having signed out: the session ended elsewhere (another tab,
 * or it could not be renewed) or it expired while working («Volver a entrar»).
 */
export type SessionEnd = 'ended' | 'expired';

export type SignInResult =
  | { readonly ok: true; readonly user: AppUser }
  | { readonly ok: false; readonly error: DataErrorKind };

/**
 * The signed-in user and their role (4.5): the guards, the menus and almost every screen read it.
 * The session is restored once, before the first navigation (app.config.ts), so the guards can
 * decide synchronously. From then on it follows the session: if it ends in another tab or expires,
 * the page goes to the login, which comes back to it; if another user signs in, the page reloads.
 */
@Service()
export class AuthStore {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reloader = inject(PageReloader);

  private readonly userState = signal<AppUser | null>(null);
  private readonly sessionEndState = signal<SessionEnd | null>(null);
  /** Not state: nothing is drawn from it, so a plain set instead of a signal. */
  private readonly beforeSignOutTasks = new Set<() => Promise<void>>();
  /** Signing in or out here: the changes of session it causes are not news from elsewhere. */
  private changingSession = false;
  private watching = false;

  readonly user = this.userState.asReadonly();
  /** `undefined` without a session, so a `resource()` keyed on it stays idle. */
  readonly userId = computed(() => this.userState()?.id);
  readonly role = computed(() => this.userState()?.role);
  readonly signedIn = computed(() => this.userState() !== null);
  /** Why the session ended without signing out, for the login to say so; null otherwise. */
  readonly sessionEnd = this.sessionEndState.asReadonly();
  /** The student accepted the notice on the registered data (RF-07). */
  readonly privacyNoticeSeen = computed(() => !!this.userState()?.privacyNoticeSeenAt);

  async restore(): Promise<void> {
    try {
      this.userState.set(await this.auth.currentUser());
    } catch {
      // Without an answer there is no usable session: the guards send the user to the login.
      this.userState.set(null);
    }
    // Only once restored: until then, the session the client starts with is not a change
    if (!this.watching) {
      this.watching = true;
      this.auth.watchSession((userId) => this.sessionChanged(userId));
    }
  }

  async signIn(credentials: Credentials): Promise<SignInResult> {
    this.changingSession = true;
    try {
      const user = await this.auth.signIn(credentials);
      this.userState.set(user);
      this.sessionEndState.set(null);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error instanceof DataError ? error.kind : 'unknown' };
    } finally {
      this.changingSession = false;
    }
  }

  /**
   * Registers work that must reach the server while the session still exists, such as the code not
   * saved yet or the queued events. Returns the function that removes it, for its owner's DestroyRef.
   */
  beforeSignOut(task: () => Promise<void>): () => void {
    this.beforeSignOutTasks.add(task);
    return () => {
      this.beforeSignOutTasks.delete(task);
    };
  }

  /**
   * Waits for the work registered with beforeSignOut() and then forgets the user, even if that work
   * or the server fail: the device must not stay signed in.
   */
  async signOut(): Promise<void> {
    await Promise.allSettled([...this.beforeSignOutTasks].map((task) => task()));
    this.changingSession = true;
    try {
      await this.auth.signOut();
    } catch {
      // Nothing else to do: the local session is gone either way.
    } finally {
      this.userState.set(null);
      this.changingSession = false;
    }
  }

  /**
   * «Volver a entrar», when the session expired: signs out and opens the login, which comes back to
   * this page. What the editor could not save stays in its local draft (D-041).
   */
  async signInAgain(): Promise<void> {
    const returnUrl = this.router.url;
    await this.signOut();
    this.sessionEndState.set('expired');
    await this.router.navigateByUrl(loginRedirect(this.router, returnUrl));
  }

  /**
   * Shown as seen at once, so the notice closes without waiting; if the server does not record it,
   * the notice appears again on the next visit.
   */
  async markPrivacyNoticeSeen(): Promise<void> {
    const user = this.userState();
    if (!user || user.privacyNoticeSeenAt) return;
    this.userState.set({ ...user, privacyNoticeSeenAt: new Date().toISOString() });
    try {
      const saved = await this.auth.markPrivacyNoticeSeen();
      if (this.userState()?.id === saved.id) this.userState.set(saved);
    } catch {
      // Seen in this visit only: it is asked again next time.
    }
  }

  private sessionChanged(userId: string | null): void {
    if (this.changingSession || userId === (this.userState()?.id ?? null)) return;
    if (userId === null) {
      // Signed out in another tab, or expired without renewal: back here after signing in again
      const returnUrl = this.router.url;
      this.userState.set(null);
      this.sessionEndState.set('ended');
      void this.router.navigateByUrl(loginRedirect(this.router, returnUrl));
    } else {
      // Another user signed in in another tab: every screen has to read its data again
      this.reloader.reload();
    }
  }
}
