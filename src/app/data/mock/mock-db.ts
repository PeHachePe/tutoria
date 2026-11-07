import { computed, Service, signal } from '@angular/core';

import { DataError } from '../data-error';
import type { AppUser, Role } from '../user';
import { SEED, SEED_VERSION } from './fixtures/seed';
import type { MockTables } from './mock-tables';

export const MOCK_DB_STORAGE_KEY = 'tutoria.mock-db';
export const MOCK_SESSION_STORAGE_KEY = 'tutoria.mock-session';

interface SavedTables {
  readonly version: number;
  readonly tables: MockTables;
}

/**
 * The simulated database (4.3): every table in one immutable signal, saved in localStorage with the
 * seed version, plus the signed-in user, which plays the part of the Supabase Auth session.
 * Only the mock services and the dev toolbar use it.
 */
@Service()
export class MockDb {
  private readonly tablesState = signal(readSavedTables());
  private readonly sessionState = signal(readSavedSession());

  readonly tables = this.tablesState.asReadonly();
  readonly sessionUserId = this.sessionState.asReadonly();
  /** The signed-in user, or null if there is none or the account is disabled. */
  readonly currentUser = computed(() => {
    const userId = this.sessionState();
    const user = this.tablesState().users.find((candidate) => candidate.id === userId);
    return user?.status === 'active' ? user : null;
  });

  /** Replaces one table with the result of `change`, which must not mutate its rows. */
  update<K extends keyof MockTables>(
    table: K,
    change: (rows: MockTables[K]) => MockTables[K],
  ): void {
    this.tablesState.update((tables) => ({ ...tables, [table]: change(tables[table]) }));
    this.save();
  }

  /** Back to the seed. The session is kept: the seed users never change their ids. */
  reset(): void {
    this.tablesState.set(SEED);
    this.save();
  }

  setSession(userId: string | null): void {
    this.sessionState.set(userId);
    try {
      if (userId === null) {
        localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
      } else {
        localStorage.setItem(MOCK_SESSION_STORAGE_KEY, userId);
      }
    } catch {
      // Storage unavailable: the session lasts until the page is closed.
    }
  }

  /**
   * The signed-in user, as the server sees it. Throws `unauthorized` if there is none and `forbidden`
   * if `roles` are given and the user has none of them.
   */
  requireUser(...roles: Role[]): AppUser {
    const user = this.currentUser();
    if (!user) {
      throw new DataError('unauthorized');
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      throw new DataError('forbidden');
    }
    return user;
  }

  private save(): void {
    const saved: SavedTables = { version: SEED_VERSION, tables: this.tablesState() };
    try {
      localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Storage unavailable or full: the data lives in memory until the page is closed.
    }
  }
}

function readSavedTables(): MockTables {
  try {
    const saved = JSON.parse(
      localStorage.getItem(MOCK_DB_STORAGE_KEY) ?? 'null',
    ) as Partial<SavedTables> | null;
    return saved?.version === SEED_VERSION && saved.tables ? saved.tables : SEED;
  } catch {
    return SEED;
  }
}

function readSavedSession(): string | null {
  try {
    return localStorage.getItem(MOCK_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}
