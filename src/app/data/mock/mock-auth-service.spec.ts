import { TestBed } from '@angular/core/testing';

import { DAW_STUDENT_IDS, DISABLED_STUDENT_ID, MOCK_PASSWORD } from './fixtures/users';
import { MockAuthService } from './mock-auth-service';
import { MockDb } from './mock-db';
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
    ['a disabled account', 'raul.medina@tutoria.test', MOCK_PASSWORD],
  ])('rejects %s as unauthorized', async (_case, email, password) => {
    await expect(service.signIn({ email, password })).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(db.sessionUserId()).toBeNull();
  });

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
});
