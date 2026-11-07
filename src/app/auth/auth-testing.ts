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
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };
}

/** Test double of the data service: each test decides what it answers. */
export class FakeAuthService extends AuthService {
  signIn = vi.fn<AuthService['signIn']>();
  signOut = vi.fn<AuthService['signOut']>(() => Promise.resolve());
  currentUser = vi.fn<AuthService['currentUser']>(() => Promise.resolve(null));
}

/** Provides a fake AuthService that restores a session of `role`, or none if `role` is null. */
export function provideSessionOf(role: Role | null): Provider[] {
  const service = new FakeAuthService();
  service.currentUser.mockResolvedValue(role && userWith(role));
  return [{ provide: AuthService, useValue: service }];
}

/** Restores the session given by provideSessionOf(), as the app does on start-up. */
export function restoreSession(): Promise<void> {
  return TestBed.inject(AuthStore).restore();
}
