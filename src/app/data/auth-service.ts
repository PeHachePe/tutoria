import type { AppUser } from './user';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Sign-in and the current session. Abstract class without a decorator: it is the injection token,
 * and each environment provides its mock or Supabase version (4.2, D-005).
 */
export abstract class AuthService {
  /** Throws `DataError('unauthorized')` if the credentials are wrong or the user is disabled. */
  abstract signIn(credentials: Credentials): Promise<AppUser>;

  abstract signOut(): Promise<void>;

  /** User of the restored session, or null if nobody is signed in. */
  abstract currentUser(): Promise<AppUser | null>;
}
