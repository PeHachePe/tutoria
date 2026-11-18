import { assertEquals } from '@std/assert';

import type { UserLinks } from '../../../src/app/data/admin/user-rules.ts';
import {
  type AdminUsersStore,
  createAdminUsersHandler,
  EMAIL_EXISTS,
  MAX_ADMIN_BODY_BYTES,
  PasswordRejectedError,
  type ProfileChanges,
  type UserRow,
} from './admin-users.ts';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const TEACHER_ID = '10000000-0000-4000-8000-000000000002';
const STUDENT_ID = '10000000-0000-4000-8000-000000000011';
const NEW_ID = '10000000-0000-4000-8000-000000000099';
const MISSING_ID = '10000000-0000-4000-8000-000000000098';
const PASSWORD = 'contraseña segura';

function row(id: string, name: string, role: UserRow['role']): UserRow {
  return {
    id,
    name,
    email: `${name.toLowerCase()}@tutoria.test`,
    role,
    status: 'active',
    privacy_notice_seen_at: null,
    created_at: '2026-09-01T08:00:00+00:00',
    updated_at: '2026-09-01T08:00:00+00:00',
  };
}

/** The administration signs in with `token-admin`, and Marta with `token-marta`. */
class FakeStore implements AdminUsersStore {
  readonly rows = new Map<string, UserRow>([
    [ADMIN_ID, row(ADMIN_ID, 'Admin', 'admin')],
    [TEACHER_ID, row(TEACHER_ID, 'Marta', 'teacher')],
    [STUDENT_ID, row(STUDENT_ID, 'Lucia', 'student')],
  ]);
  readonly links = new Map<string, UserLinks>([[TEACHER_ID, { groups: 2, enrollments: 0 }]]);
  readonly emails = new Set(['lucia@tutoria.test']);
  /** Every write, in order, to check what happened and in which order. */
  readonly calls: string[] = [];
  readonly passwords = new Map<string, string>();
  failProfile = false;
  /** As Auth with a password past 72 bytes. */
  rejectPasswords = false;

  userOf(token: string) {
    const users: Record<string, string> = { 'token-admin': ADMIN_ID, 'token-marta': TEACHER_ID };
    return Promise.resolve(users[token] ?? null);
  }
  profileOf(userId: string) {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }
  linksOf(userId: string) {
    return Promise.resolve(this.links.get(userId) ?? { groups: 0, enrollments: 0 });
  }
  createAccount(account: { email: string; password: string; name: string }) {
    if (this.emails.has(account.email)) return Promise.resolve(EMAIL_EXISTS);
    if (this.rejectPasswords) return Promise.reject(new PasswordRejectedError('too long'));
    this.calls.push(`create ${account.email}`);
    this.passwords.set(NEW_ID, account.password);
    // As the trigger `create_app_user`: always a student
    this.rows.set(NEW_ID, { ...row(NEW_ID, account.name, 'student'), email: account.email });
    return Promise.resolve(NEW_ID);
  }
  deleteAccount(userId: string) {
    this.calls.push(`delete ${userId}`);
    this.rows.delete(userId);
    return Promise.resolve();
  }
  updateProfile(userId: string, changes: ProfileChanges) {
    if (this.failProfile) return Promise.reject(new Error('Database down'));
    this.calls.push(`profile ${JSON.stringify(changes)}`);
    const updated = { ...this.rows.get(userId)!, ...changes };
    this.rows.set(userId, updated);
    return Promise.resolve(updated);
  }
  setBan(_userId: string, banned: boolean) {
    this.calls.push(banned ? 'ban' : 'unban');
    return Promise.resolve();
  }
  setPassword(userId: string, password: string) {
    if (this.rejectPasswords) return Promise.reject(new PasswordRejectedError('too long'));
    this.calls.push('password');
    this.passwords.set(userId, password);
    return Promise.resolve();
  }
}

function setup() {
  const store = new FakeStore();
  return { store, handle: createAdminUsersHandler({ store }) };
}

function post(body: unknown, token: string | null = 'token-admin'): Request {
  return new Request('http://functions.test/admin-users', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const CREATE = {
  action: 'create',
  name: ' Clara ',
  email: ' Clara@Tutoria.test ',
  role: 'teacher',
  password: PASSWORD,
};

const update = (userId: string, changes: Record<string, unknown>) => ({
  action: 'update',
  userId,
  changes,
});

/** Runs `fn` without the errors the function logs on purpose. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { error } = console;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
  }
}

Deno.test('the administration creates an account with its role and password', async () => {
  const { store, handle } = setup();

  const response = await handle(post(CREATE));

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  const body = await response.json();
  assertEquals(body.id, NEW_ID);
  assertEquals(body.role, 'teacher');
  assertEquals(body.email, 'clara@tutoria.test');
  assertEquals(store.calls, [
    'create clara@tutoria.test',
    'profile {"name":"Clara","role":"teacher"}',
  ]);
  assertEquals(store.passwords.get(NEW_ID), PASSWORD);
  assertEquals(JSON.stringify(body).includes(PASSWORD), false);
});

Deno.test('an email that already has an account is turned down', async () => {
  const { store, handle } = setup();

  const response = await handle(post({ ...CREATE, email: 'Lucia@tutoria.test' }));

  assertEquals(response.status, 409);
  assertEquals(store.calls, []);
});

Deno.test('if the role cannot be set, the new account goes away', async () => {
  const { store, handle } = setup();
  store.failProfile = true;

  const response = await quietly(() => handle(post(CREATE)));

  assertEquals(response.status, 500);
  assertEquals(store.calls, ['create clara@tutoria.test', `delete ${NEW_ID}`]);
  assertEquals(store.rows.has(NEW_ID), false);
});

Deno.test('the name, the role and the password change', async () => {
  const { store, handle } = setup();

  const response = await handle(
    post(update(STUDENT_ID, { name: 'Lucía', role: 'teacher', password: 'otra contraseña' })),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals([body.name, body.role], ['Lucía', 'teacher']);
  assertEquals(store.calls, ['password', 'profile {"name":"Lucía","role":"teacher"}']);
  assertEquals(store.passwords.get(STUDENT_ID), 'otra contraseña');
  assertEquals(JSON.stringify(body).includes('otra contraseña'), false);
});

Deno.test('a password Auth turns down is invalid, and nothing else changes', async () => {
  const { store, handle } = setup();
  store.rejectPasswords = true;

  assertEquals((await handle(post(CREATE))).status, 400);
  const changes = { status: 'disabled', password: 'ñ'.repeat(40) };
  assertEquals((await handle(post(update(STUDENT_ID, changes)))).status, 400);
  assertEquals(store.calls, []);
});

Deno.test('a reset of the password alone leaves the row as it is', async () => {
  const { store, handle } = setup();

  const response = await handle(post(update(STUDENT_ID, { password: 'otra contraseña' })));

  assertEquals(response.status, 200);
  assertEquals((await response.json()).name, 'Lucia');
  assertEquals(store.calls, ['password']);
});

Deno.test('disabling closes the data first and then bans; activating, the other way', async () => {
  const { store, handle } = setup();

  assertEquals((await handle(post(update(STUDENT_ID, { status: 'disabled' })))).status, 200);
  assertEquals(store.calls, ['profile {"status":"disabled"}', 'ban']);

  store.calls.length = 0;
  assertEquals((await handle(post(update(STUDENT_ID, { status: 'active' })))).status, 200);
  assertEquals(store.calls, ['unban', 'profile {"status":"active"}']);
});

Deno.test('the same status again does not touch the ban', async () => {
  const { store, handle } = setup();

  assertEquals((await handle(post(update(STUDENT_ID, { status: 'active' })))).status, 200);
  assertEquals(store.calls, ['profile {"status":"active"}']);
});

Deno.test('each change the rules forbid is a conflict that names it', async () => {
  const { store, handle } = setup();
  store.links.set(STUDENT_ID, { groups: 0, enrollments: 1 });
  const cases: [Record<string, unknown>, string][] = [
    [update(ADMIN_ID, { role: 'teacher' }), 'own_role'],
    [update(ADMIN_ID, { status: 'disabled' }), 'own_status'],
    [update(TEACHER_ID, { role: 'student' }), 'has_groups'],
    [update(STUDENT_ID, { role: 'teacher' }), 'has_enrollments'],
  ];

  for (const [body, problem] of cases) {
    const response = await handle(post(body));
    assertEquals(response.status, 409);
    assertEquals((await response.json()).message.includes(problem), true);
  }
  assertEquals(store.calls, []);
});

Deno.test('a user that does not exist is not found', async () => {
  const { handle } = setup();

  assertEquals((await handle(post(update(MISSING_ID, { name: 'Nadie' })))).status, 404);
});

Deno.test(
  'without a session, or without being an active administrator, nothing changes',
  async () => {
    const { store, handle } = setup();

    assertEquals((await handle(post(CREATE, null))).status, 401);
    assertEquals((await handle(post(CREATE, 'forged'))).status, 401);
    assertEquals((await handle(post(CREATE, 'token-marta'))).status, 403);
    store.rows.set(ADMIN_ID, { ...store.rows.get(ADMIN_ID)!, status: 'disabled' });
    assertEquals((await handle(post(CREATE))).status, 403);
    assertEquals(store.calls, []);
  },
);

Deno.test('a body that is not a request is invalid', async () => {
  const { store, handle } = setup();
  const bodies: unknown[] = [
    'not json',
    { action: 'delete', userId: STUDENT_ID },
    { ...CREATE, email: 'no es un correo' },
    { ...CREATE, name: '   ' },
    { ...CREATE, role: 'root' },
    { ...CREATE, password: 'corta' },
    { ...CREATE, password: 'a'.repeat(65) },
    update('no-es-un-uuid', { name: 'Lucía' }),
    update(STUDENT_ID, {}),
    update(STUDENT_ID, { status: 'gone' }),
  ];

  for (const body of bodies) {
    assertEquals((await handle(post(body))).status, 400, JSON.stringify(body));
  }
  assertEquals(store.calls, []);
});

Deno.test('a body past the limit is not read', async () => {
  const { handle } = setup();

  const response = await handle(post({ ...CREATE, pad: 'x'.repeat(MAX_ADMIN_BODY_BYTES) }));

  assertEquals(response.status, 413);
});

Deno.test('the browser may ask before calling, and only POST changes users', async () => {
  const { handle } = setup();

  const options = await handle(
    new Request('http://functions.test/admin-users', { method: 'OPTIONS' }),
  );
  assertEquals(options.status, 204);
  assertEquals((await handle(new Request('http://functions.test/admin-users'))).status, 405);
});

Deno.test('a failure of the server is an unknown error, never a crash', async () => {
  const { store, handle } = setup();
  store.linksOf = () => Promise.reject(new Error('Database down'));

  assertEquals((await quietly(() => handle(post(update(STUDENT_ID, { name: 'L' }))))).status, 500);
});
