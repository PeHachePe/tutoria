import { inject, Service } from '@angular/core';

import { AuthService, Credentials } from '../auth-service';
import { DataError } from '../data-error';
import type { AppUser } from '../user';
import { SUPABASE_CLIENT } from './supabase-client';
import { toDataError, unwrap } from './supabase-error';
import { toAppUser } from './supabase-rows';

/**
 * Supabase Auth with email and password. The session lives in the client, which renews its token
 * and tells the other tabs; the profile and the role come from `app_user`, never from the metadata
 * of the account, which its owner can edit (2.1).
 */
@Service({ autoProvided: false })
export class SupabaseAuthService extends AuthService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async signIn({ email, password }: Credentials): Promise<AppUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw toDataError(error);
    const user = await this.profileOf(data.user.id);
    // Auth already blocks the disabled accounts (seed.sql); this covers one disabled meanwhile
    if (user.status !== 'active') {
      await this.signOut();
      throw new DataError('forbidden', 'The account is disabled');
    }
    return user;
  }

  /** Only this device: the student's other devices keep their session. */
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    if (error) throw toDataError(error);
  }

  async currentUser(): Promise<AppUser | null> {
    const userId = await this.sessionUserId();
    if (!userId) return null;
    const user = await this.profileOf(userId);
    return user.status === 'active' ? user : null;
  }

  watchSession(listener: (userId: string | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      // Calling the client from inside its own callback can lock it: the listener runs right after
      setTimeout(() => listener(session?.user.id ?? null));
    });
    return () => data.subscription.unsubscribe();
  }

  async markPrivacyNoticeSeen(): Promise<AppUser> {
    const userId = await this.sessionUserId();
    if (!userId) throw new DataError('unauthorized');
    // The only column of app_user its owner may change (2.1)
    const row = unwrap(
      await this.supabase
        .from('app_user')
        .update({ privacy_notice_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single(),
    );
    return toAppUser(row);
  }

  /** The user of the saved session, renewed first if it expired; undefined without one. */
  private async sessionUserId(): Promise<string | undefined> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw toDataError(error);
    return data.session?.user.id;
  }

  private async profileOf(userId: string): Promise<AppUser> {
    const row = unwrap(await this.supabase.from('app_user').select().eq('id', userId).single());
    return toAppUser(row);
  }
}
