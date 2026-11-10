import { TestBed } from '@angular/core/testing';
import { AuthError } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from './supabase-client';
import { SupabaseAuthService } from './supabase-auth-service';
import { appUserRow, FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';

const LUCIA = appUserRow({ id: 'lucia', email: 'lucia@tutoria.test' });

describe('SupabaseAuthService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseAuthService;

  beforeEach(() => {
    server = new FakeSupabaseServer()
      .acceptSignIn(LUCIA)
      .on('GET', '/rest/v1/app_user', { body: LUCIA })
      .on('POST', '/auth/v1/logout', { status: 204 });
    TestBed.configureTestingModule({
      providers: [SupabaseAuthService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseAuthService);
  });

  const signIn = () => service.signIn({ email: ' lucia@tutoria.test ', password: 'secret' });

  it('signs in with the email without spaces and returns the profile of app_user', async () => {
    const user = await signIn();

    const [request] = server.sentTo('POST', '/auth/v1/token');
    expect(request.params.get('grant_type')).toBe('password');
    expect(request.body).toMatchObject({ email: 'lucia@tutoria.test', password: 'secret' });
    const [profile] = server.sentTo('GET', '/rest/v1/app_user');
    expect(profile.params.get('id')).toBe('eq.lucia');
    expect(user).toEqual({
      id: 'lucia',
      name: 'Lucía Pérez',
      email: 'lucia@tutoria.test',
      role: 'student',
      status: 'active',
      privacyNoticeSeenAt: null,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('rejects wrong credentials as unauthorized', async () => {
    server.on('POST', '/auth/v1/token', {
      status: 400,
      // What Supabase Auth answers: `code` is the status and `error_code` the reason
      body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
    });

    await expect(signIn()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('rejects a disabled account, which Auth blocks whatever the password', async () => {
    server.on('POST', '/auth/v1/token', {
      status: 400,
      body: { code: 400, error_code: 'user_banned', msg: 'User is banned' },
    });

    await expect(signIn()).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('signs out again and rejects an account disabled after Auth let it in', async () => {
    server.on('GET', '/rest/v1/app_user', { body: { ...LUCIA, status: 'disabled' } });

    await expect(signIn()).rejects.toMatchObject({ kind: 'forbidden' });
    expect(server.sentTo('POST', '/auth/v1/logout')).toHaveLength(1);
    await expect(service.currentUser()).resolves.toBeNull();
  });

  it('restores the user of the saved session, or none without one', async () => {
    await expect(service.currentUser()).resolves.toBeNull();

    await signIn();

    await expect(service.currentUser()).resolves.toMatchObject({ id: 'lucia' });
  });

  it('has no current user when the account was disabled', async () => {
    await signIn();
    server.on('GET', '/rest/v1/app_user', { body: { ...LUCIA, status: 'disabled' } });

    await expect(service.currentUser()).resolves.toBeNull();
  });

  it('throws when the saved session cannot be read or renewed', async () => {
    const client = TestBed.inject(SUPABASE_CLIENT);
    vi.spyOn(client.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: new AuthError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });

    await expect(service.currentUser()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('signs out only this device', async () => {
    await signIn();

    await service.signOut();

    const [request] = server.sentTo('POST', '/auth/v1/logout');
    expect(request.params.get('scope')).toBe('local');
    await expect(service.currentUser()).resolves.toBeNull();
  });

  it('throws when signing out fails on the server', async () => {
    await signIn();
    server.on('POST', '/auth/v1/logout', { status: 500, body: { msg: 'boom' } });

    await expect(service.signOut()).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('tells the listener about each change of session, until it stops', async () => {
    vi.useFakeTimers();
    try {
      const listener = vi.fn();
      const stop = service.watchSession(listener);

      await signIn();
      await vi.runAllTimersAsync();
      await service.signOut();
      await vi.runAllTimersAsync();
      stop();
      await signIn();
      await vi.runAllTimersAsync();

      // The first call is the session the client starts with: none
      expect(listener.mock.calls).toEqual([[null], ['lucia'], [null]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records the data notice in app_user and returns the updated profile', async () => {
    await signIn();
    server.on('PATCH', '/rest/v1/app_user', ({ body }) => ({
      body: { ...LUCIA, ...(body as object) },
    }));

    const user = await service.markPrivacyNoticeSeen();

    const [request] = server.sentTo('PATCH', '/rest/v1/app_user');
    expect(request.params.get('id')).toBe('eq.lucia');
    expect(Object.keys(request.body as object)).toEqual(['privacy_notice_seen_at']);
    expect(user.privacyNoticeSeenAt).toBe(
      new Date(
        (request.body as { privacy_notice_seen_at: string }).privacy_notice_seen_at,
      ).toISOString(),
    );
  });

  it('needs a session to record the data notice', async () => {
    await expect(service.markPrivacyNoticeSeen()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('translates the failures of PostgREST, such as a network down', async () => {
    await signIn();
    server.offline();

    await expect(service.currentUser()).rejects.toMatchObject({ kind: 'network' });
  });
});
