import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PageReloader } from '../core/page-reloader';

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
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: service },
        { provide: PageReloader, useValue: { reload: vi.fn() } },
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
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

    it('first waits for the work that needs the session, such as unsaved code', async () => {
      const order: string[] = [];
      store.beforeSignOut(async () => {
        await Promise.resolve();
        order.push('saved');
      });
      service.signOut.mockImplementation(() => {
        order.push('signed out');
        return Promise.resolve();
      });

      await store.signOut();

      expect(order).toEqual(['saved', 'signed out']);
    });

    it('signs out even if that work fails', async () => {
      store.beforeSignOut(() => Promise.reject(new DataError('network')));

      await store.signOut();

      expect(service.signOut).toHaveBeenCalled();
      expect(store.signedIn()).toBe(false);
    });

    it('forgets the work whose owner removed it', async () => {
      const task = vi.fn(() => Promise.resolve());
      const remove = store.beforeSignOut(task);
      remove();

      await store.signOut();

      expect(task).not.toHaveBeenCalled();
    });
  });

  describe('the session changing elsewhere', () => {
    let router: Router;

    beforeEach(async () => {
      router = TestBed.inject(Router);
      service.currentUser.mockResolvedValue(STUDENT);
      await store.restore();
      await router.navigateByUrl('/alumno/ejercicio/1?tab=code');
    });

    it('starts watching once restored, and only once', async () => {
      await store.restore();

      expect(service.watchSession).toHaveBeenCalledOnce();
    });

    it('goes to the login, which comes back here, when the session ends in another tab', async () => {
      service.sessionListener?.(null);
      await vi.waitFor(() => expect(router.url).toMatch(/^\/login/));

      expect(store.signedIn()).toBe(false);
      expect(router.parseUrl(router.url).queryParams).toEqual({
        redirect: '/alumno/ejercicio/1?tab=code',
      });
    });

    it('reloads the page when another user signs in in another tab', () => {
      service.sessionListener?.('someone-else');

      expect(TestBed.inject(PageReloader).reload).toHaveBeenCalled();
      expect(store.user()).toEqual(STUDENT);
    });

    it('reloads a page without a session, such as the login, when someone signs in elsewhere', async () => {
      await store.signOut();
      service.sessionListener?.(null);
      expect(TestBed.inject(PageReloader).reload).not.toHaveBeenCalled();

      service.sessionListener?.(STUDENT.id);

      expect(TestBed.inject(PageReloader).reload).toHaveBeenCalled();
    });

    it('ignores a renewed token of the same user', () => {
      service.sessionListener?.(STUDENT.id);

      expect(TestBed.inject(PageReloader).reload).not.toHaveBeenCalled();
      expect(router.url).toBe('/alumno/ejercicio/1?tab=code');
    });

    it('ignores the changes its own sign-in and sign-out cause', async () => {
      service.signOut.mockImplementation(() => {
        service.sessionListener?.(null);
        return Promise.resolve();
      });
      service.signIn.mockImplementation(() => {
        service.sessionListener?.(STUDENT.id);
        return Promise.resolve(STUDENT);
      });

      await store.signOut();
      await store.signIn(CREDENTIALS);

      expect(TestBed.inject(PageReloader).reload).not.toHaveBeenCalled();
      expect(router.url).toBe('/alumno/ejercicio/1?tab=code');
    });

    it('signs in again: signs out and opens the login, which comes back here', async () => {
      await store.signInAgain();

      expect(service.signOut).toHaveBeenCalled();
      expect(router.url).toBe('/login?redirect=%2Falumno%2Fejercicio%2F1%3Ftab%3Dcode');
    });
  });

  describe('the data notice', () => {
    const SEEN = { ...STUDENT, privacyNoticeSeenAt: '2026-11-10T09:00:00.000Z' };

    beforeEach(async () => {
      service.currentUser.mockResolvedValue(STUDENT);
      await store.restore();
    });

    it('records it and keeps the user the server returns', async () => {
      service.markPrivacyNoticeSeen.mockResolvedValue(SEEN);
      expect(store.privacyNoticeSeen()).toBe(false);

      const marking = store.markPrivacyNoticeSeen();

      // Seen at once, without waiting for the server
      expect(store.privacyNoticeSeen()).toBe(true);
      await marking;
      expect(store.user()).toEqual(SEEN);
    });

    it('stays seen in this visit if the server does not record it', async () => {
      service.markPrivacyNoticeSeen.mockRejectedValue(new DataError('network'));

      await store.markPrivacyNoticeSeen();

      expect(store.privacyNoticeSeen()).toBe(true);
    });

    it('ignores the answer if the user changed meanwhile', async () => {
      service.markPrivacyNoticeSeen.mockResolvedValue(SEEN);

      const marking = store.markPrivacyNoticeSeen();
      await store.signOut();
      await marking;

      expect(store.user()).toBeNull();
    });

    it('does nothing when it was already seen or without a user', async () => {
      service.markPrivacyNoticeSeen.mockResolvedValue(SEEN);
      await store.markPrivacyNoticeSeen();
      await store.markPrivacyNoticeSeen();
      await store.signOut();
      await store.markPrivacyNoticeSeen();

      expect(service.markPrivacyNoticeSeen).toHaveBeenCalledOnce();
    });
  });
});
