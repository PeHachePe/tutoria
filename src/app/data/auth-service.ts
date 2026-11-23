import type { GuideState } from './guide-state';
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
  /**
   * Throws `DataError('unauthorized')` if the credentials are wrong and `DataError('forbidden')` if
   * the account is disabled, whatever the password, as Supabase Auth does.
   */
  abstract signIn(credentials: Credentials): Promise<AppUser>;

  abstract signOut(): Promise<void>;

  /** User of the restored session, or null if nobody is signed in. */
  abstract currentUser(): Promise<AppUser | null>;

  /**
   * Calls `listener` with the id of the signed-in user, or null, each time the session changes
   * outside this page: in another tab, or because it expired and could not be renewed. It may also
   * call it with the same user (a renewed token). Returns the function that stops watching.
   */
  abstract watchSession(listener: (userId: string | null) => void): () => void;

  /** Records that the signed-in user saw the notice on the registered data (RF-07). */
  abstract markPrivacyNoticeSeen(): Promise<AppUser>;

  /** What the signed-in user saw and did of the guided help (2.12); empty before they save any. */
  abstract guideState(): Promise<GuideState>;

  /** Saves it whole for the signed-in user. */
  abstract saveGuideState(state: GuideState): Promise<void>;
}
