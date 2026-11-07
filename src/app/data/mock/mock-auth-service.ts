import { inject, Service } from '@angular/core';

import { AuthService, Credentials } from '../auth-service';
import { DataError } from '../data-error';
import type { AppUser } from '../user';
import { MOCK_PASSWORD } from './fixtures/users';
import { MockDb } from './mock-db';
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
}
