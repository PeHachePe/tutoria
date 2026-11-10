import { TestBed } from '@angular/core/testing';

import { DAW_STUDENT_IDS, DISABLED_STUDENT_ID, MOCK_PASSWORD } from './fixtures/users';
import { MockAuthService } from './mock-auth-service';
import { MOCK_DB_STORAGE_KEY, MOCK_SESSION_STORAGE_KEY, MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

describe('MockAuthService', () => {
  let service: MockAuthService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockAuthService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockAuthService);
  });

  afterEach(() => localStorage.clear());

  it('signs in a seed user with the shared password, ignoring case and spaces in the email', async () => {
    const user = await service.signIn({
      email: ' Lucia.Martin@tutoria.test ',
      password: MOCK_PASSWORD,
    });

    expect(user.id).toBe(DAW_STUDENT_IDS[0]);
    expect(db.sessionUserId()).toBe(DAW_STUDENT_IDS[0]);
    await expect(service.currentUser()).resolves.toEqual(user);
  });

  it.each([
    ['a wrong password', 'lucia.martin@tutoria.test', 'otra'],
    ['an unknown email', 'nadie@tutoria.test', MOCK_PASSWORD],
  ])('rejects %s as unauthorized', async (_case, email, password) => {
    await expect(service.signIn({ email, password })).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(db.sessionUserId()).toBeNull();
  });

  it.each([MOCK_PASSWORD, 'otra'])(
    'rejects a disabled account as forbidden, whatever the password (%s), as Supabase does',
    async (password) => {
      await expect(
        service.signIn({ email: 'raul.medina@tutoria.test', password }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expect(db.sessionUserId()).toBeNull();
    },
  );

  it('signs out', async () => {
    db.setSession(DAW_STUDENT_IDS[0]);

    await service.signOut();

    await expect(service.currentUser()).resolves.toBeNull();
  });

  it('has no current user when the session belongs to a disabled account', async () => {
    db.setSession(DISABLED_STUDENT_ID);

    await expect(service.currentUser()).resolves.toBeNull();
  });

  it('goes through the simulated network', async () => {
    TestBed.inject(MockNetwork).failNextRequest('network');

    await expect(service.currentUser()).rejects.toMatchObject({ kind: 'network' });
  });

  describe('watchSession', () => {
    function storageEvent(key: string, newValue: string | null): StorageEvent {
      return new StorageEvent('storage', { key, newValue });
    }

    it('takes the session another tab saved and tells the listener', () => {
      const listener = vi.fn();
      const stop = service.watchSession(listener);

      window.dispatchEvent(storageEvent(MOCK_SESSION_STORAGE_KEY, DAW_STUDENT_IDS[1]));
      window.dispatchEvent(storageEvent(MOCK_SESSION_STORAGE_KEY, null));

      expect(listener.mock.calls).toEqual([[DAW_STUDENT_IDS[1]], [null]]);
      expect(db.sessionUserId()).toBeNull();
      stop();
    });

    it('ignores the other keys and stops when asked', () => {
      const listener = vi.fn();
      const stop = service.watchSession(listener);

      window.dispatchEvent(storageEvent(MOCK_DB_STORAGE_KEY, '{}'));
      stop();
      window.dispatchEvent(storageEvent(MOCK_SESSION_STORAGE_KEY, null));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('records that the signed-in user saw the data notice', async () => {
    db.setSession(DAW_STUDENT_IDS[0]);

    const user = await service.markPrivacyNoticeSeen();

    expect(user.privacyNoticeSeenAt).not.toBeNull();
    expect(user.updatedAt).toBe(user.privacyNoticeSeenAt);
    expect(db.currentUser()).toEqual(user);
    // The other users keep theirs
    expect(db.tables().users.filter((row) => row.privacyNoticeSeenAt !== null)).toHaveLength(1);
  });

  it('needs a session to record the data notice', async () => {
    await expect(service.markPrivacyNoticeSeen()).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
