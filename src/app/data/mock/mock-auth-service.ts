import { inject, Service } from '@angular/core';

import { AuthService, Credentials } from '../auth-service';
import { DataError } from '../data-error';
import type { AppUser } from '../user';
import { MOCK_PASSWORD } from './fixtures/users';
import { findRow, now } from './mock-access';
import { MOCK_SESSION_STORAGE_KEY, MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Sign-in against the seed users, all with the same test password. The dev toolbar switches user. */
@Service({ autoProvided: false })
export class MockAuthService extends AuthService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  signIn({ email, password }: Credentials): Promise<AppUser> {
    return this.network.request(() => {
      const normalized = email.trim().toLowerCase();
      const user = this.db.tables().users.find((candidate) => candidate.email === normalized);
      if (!user || user.status !== 'active' || password !== MOCK_PASSWORD) {
        throw new DataError('unauthorized');
      }
      this.db.setSession(user.id);
      return user;
    });
  }

  signOut(): Promise<void> {
    return this.network.request(() => this.db.setSession(null));
  }

  currentUser(): Promise<AppUser | null> {
    return this.network.request(() => this.db.currentUser());
  }

  /** Another tab changed the saved session: this one takes it, as Supabase Auth does. */
  watchSession(listener: (userId: string | null) => void): () => void {
    const onStorage = ({ key, newValue }: StorageEvent) => {
      if (key !== MOCK_SESSION_STORAGE_KEY) return;
      this.db.setSession(newValue);
      listener(newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  markPrivacyNoticeSeen(): Promise<AppUser> {
    return this.network.request(() => {
      const { id } = this.db.requireUser();
      const seenAt = now();
      this.db.update('users', (rows) =>
        rows.map((row) =>
          row.id === id ? { ...row, privacyNoticeSeenAt: seenAt, updatedAt: seenAt } : row,
        ),
      );
      return findRow(this.db.tables().users, id);
    });
  }
}
