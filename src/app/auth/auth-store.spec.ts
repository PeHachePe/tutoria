import { TestBed } from '@angular/core/testing';

import { AuthService, Credentials } from '../data/auth-service';
import { DataError } from '../data/data-error';
import { AuthStore } from './auth-store';
import { FakeAuthService, userWith } from './auth-testing';

const STUDENT = userWith('student');

const CREDENTIALS: Credentials = { email: STUDENT.email, password: 'tutoria' };

describe('AuthStore', () => {
  let service: FakeAuthService;
  let store: AuthStore;

  beforeEach(() => {
    service = new FakeAuthService();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: service }] });
    store = TestBed.inject(AuthStore);
  });

  it('starts without a session', () => {
    expect(store.user()).toBeNull();
    expect(store.userId()).toBeUndefined();
    expect(store.role()).toBeUndefined();
    expect(store.signedIn()).toBe(false);
  });

  describe('restore', () => {
    it('takes the user of the saved session', async () => {
      service.currentUser.mockResolvedValue(STUDENT);

      await store.restore();

      expect(store.user()).toEqual(STUDENT);
      expect(store.userId()).toBe(STUDENT.id);
      expect(store.role()).toBe('student');
      expect(store.signedIn()).toBe(true);
    });

    it('stays without a session when there is none', async () => {
      service.currentUser.mockResolvedValue(null);

      await store.restore();

      expect(store.signedIn()).toBe(false);
    });

    it('treats a failure as no session, so the app still starts and shows the login', async () => {
      service.currentUser.mockRejectedValue(new DataError('network'));

      await store.restore();

      expect(store.signedIn()).toBe(false);
    });
  });

  describe('signIn', () => {
    it('keeps the user and reports success', async () => {
      service.signIn.mockResolvedValue(STUDENT);

      const result = await store.signIn(CREDENTIALS);

      expect(service.signIn).toHaveBeenCalledWith(CREDENTIALS);
      expect(result).toEqual({ ok: true, user: STUDENT });
      expect(store.user()).toEqual(STUDENT);
    });

    it('reports the kind of a data error and stays without a session', async () => {
      service.signIn.mockRejectedValue(new DataError('unauthorized'));

      const result = await store.signIn(CREDENTIALS);

      expect(result).toEqual({ ok: false, error: 'unauthorized' });
      expect(store.signedIn()).toBe(false);
    });

    it('reports any other failure as unknown', async () => {
      service.signIn.mockRejectedValue(new Error('boom'));

      await expect(store.signIn(CREDENTIALS)).resolves.toEqual({ ok: false, error: 'unknown' });
    });
  });

  describe('signOut', () => {
    beforeEach(async () => {
      service.signIn.mockResolvedValue(STUDENT);
      await store.signIn(CREDENTIALS);
    });

    it('ends the session', async () => {
      await store.signOut();

      expect(service.signOut).toHaveBeenCalled();
      expect(store.signedIn()).toBe(false);
    });

    it('forgets the user even if the server cannot be reached', async () => {
      service.signOut.mockRejectedValue(new DataError('network'));

      await store.signOut();

      expect(store.signedIn()).toBe(false);
    });
  });
});
