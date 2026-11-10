import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../data/auth-service';
import type { AppUser, Role } from '../data/user';
import { AuthStore } from './auth-store';

/** Test helpers: an active user of the given role and a session for the components under test. */
export function userWith(role: Role): AppUser {
  return {
    id: `${role}-1`,
    name: `Usuario ${role}`,
    email: `${role}@tutoria.test`,
    role,
    status: 'active',
    privacyNoticeSeenAt: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };
}

/** Test double of the data service: each test decides what it answers. */
export class FakeAuthService extends AuthService {
  signIn = vi.fn<AuthService['signIn']>();
  signOut = vi.fn<AuthService['signOut']>(() => Promise.resolve());
  currentUser = vi.fn<AuthService['currentUser']>(() => Promise.resolve(null));
  markPrivacyNoticeSeen = vi.fn<AuthService['markPrivacyNoticeSeen']>();
  /** The listener of watchSession(), for a test to announce a change of session. */
  sessionListener: ((userId: string | null) => void) | undefined;
  watchSession = vi.fn<AuthService['watchSession']>((listener) => {
    this.sessionListener = listener;
    return () => (this.sessionListener = undefined);
  });
}

/**
 * Provides a fake AuthService that restores a session of `role`, or none if `role` is null, with
 * the changes to its user a test needs.
 */
export function provideSessionOf(role: Role | null, changes: Partial<AppUser> = {}): Provider[] {
  const service = new FakeAuthService();
  service.currentUser.mockResolvedValue(role && { ...userWith(role), ...changes });
  return [{ provide: AuthService, useValue: service }];
}

/** Restores the session given by provideSessionOf(), as the app does on start-up. */
export function restoreSession(): Promise<void> {
  return TestBed.inject(AuthStore).restore();
}
