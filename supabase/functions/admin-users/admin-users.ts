import { z } from 'zod';

import {
  MAX_DISABLE_BATCH,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  type UserLinks,
  userChangeProblem,
} from '../../../src/app/data/admin/user-rules.ts';
import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import {
  bearerToken,
  BodyTooLargeError,
  failure,
  json,
  preflight,
  readJson,
  tooLarge,
} from '../_shared/http.ts';

/** A name, an email, a role and a password: a request is far smaller. */
export const MAX_ADMIN_BODY_BYTES = 10_000;

export type UserRow = Database['public']['Tables']['app_user']['Row'];

/** What `updateProfile()` writes of `app_user`. */
export type ProfileChanges = Partial<Pick<UserRow, 'name' | 'role' | 'status'>>;

/** What `createAccount()` answers when the email already has an account. */
export const EMAIL_EXISTS = 'email_exists';

/**
 * Auth turned down a password the schema accepted: one past the 72 bytes bcrypt reads, as a long
 * one full of accents or emoji (D-072).
 */
export class PasswordRejectedError extends Error {
  constructor(reason: string) {
    super(`Auth turned down the password: ${reason}`);
    this.name = 'PasswordRejectedError';
  }
}

/** What the function reads and writes, with `service_role` (`SupabaseAdminUsersStore`). */
export interface AdminUsersStore {
  /** The user of a session token, or `null` if it is not valid. */
  userOf(token: string): Promise<string | null>;
  /** The row of `app_user`, or null. */
  profileOf(userId: string): Promise<UserRow | null>;
  linksOf(userId: string): Promise<UserLinks>;
  /**
   * The id of the new account, or `EMAIL_EXISTS`. Its email is confirmed already. Throws
   * `PasswordRejectedError`, as `setPassword()`.
   */
  createAccount(account: { email: string; password: string; name: string }): Promise<string>;
  deleteAccount(userId: string): Promise<void>;
  /** Name, role and status of `app_user`; returns the row. */
  updateProfile(userId: string, changes: ProfileChanges): Promise<UserRow>;
  setBan(userId: string, banned: boolean): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;
}

export interface AdminUsersDependencies {
  readonly store: AdminUsersStore;
}

const ROLES = ['student', 'teacher', 'admin'] as const;
const STATUSES = ['active', 'disabled'] as const;

const name = z.string().trim().min(1).max(MAX_USER_NAME_LENGTH);
// Spaces are part of a password: it is never trimmed
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

export const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name,
    email: z.string().trim().max(MAX_EMAIL_LENGTH).pipe(z.email()),
    role: z.enum(ROLES),
    password,
  }),
  z.object({
    action: z.literal('update'),
    userId: z.uuid(),
    changes: z
      .object({
        name: name.optional(),
        role: z.enum(ROLES).optional(),
        status: z.enum(STATUSES).optional(),
        password: password.optional(),
      })
      .refine((changes) => Object.values(changes).some((value) => value !== undefined)),
  }),
  z.object({
    action: z.literal('disable'),
    userIds: z
      .array(z.uuid())
      .min(1)
      .max(MAX_DISABLE_BATCH)
      .refine((ids) => new Set(ids).size === ids.length),
  }),
]);

type CreateRequest = Extract<z.infer<typeof requestSchema>, { action: 'create' }>;
type UpdateRequest = Extract<z.infer<typeof requestSchema>, { action: 'update' }>;
type DisableRequest = Extract<z.infer<typeof requestSchema>, { action: 'disable' }>;

/**
 * The Edge Function `admin-users` (5.1a, D-072): the administration creates the accounts, changes
 * their name, role and status, resets their password and disables several at once (5.2g), with the
 * API of administration of Supabase Auth. Public sign-up is closed and the app sends no email: the
 * password is handed over in person.
 * Without a limit per minute, as it calls no model and only the administration uses it. The password
 * is never logged nor answered.
 */
export function createAdminUsersHandler({
  store,
}: AdminUsersDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    try {
      const token = bearerToken(request);
      const callerId = token ? await store.userOf(token) : null;
      if (!callerId) return failure(401, 'Sign in to manage the users');
      const caller = await store.profileOf(callerId);
      if (caller?.role !== 'admin' || caller.status !== 'active') {
        return failure(403, 'Only the administration manages the users');
      }
      const body = requestSchema.safeParse(await readJson(request, MAX_ADMIN_BODY_BYTES));
      if (!body.success) {
        return failure(400, "Expected { action: 'create' | 'update' | 'disable', … }");
      }
      switch (body.data.action) {
        case 'create':
          return await create(store, body.data);
        case 'update':
          return await update(store, callerId, body.data);
        case 'disable':
          return await disable(store, callerId, body.data);
      }
    } catch (error) {
      if (error instanceof BodyTooLargeError) return tooLarge();
      if (error instanceof PasswordRejectedError) return failure(400, 'The password is not valid');
      console.error(error);
      return failure(500, 'The change of the user failed');
    }
  };
}

/**
 * The trigger `create_app_user` makes the row as a student; then it gets the role it was asked.
 * If that fails, the account goes away: none is left halfway.
 */
async function create(store: AdminUsersStore, ask: CreateRequest): Promise<Response> {
  const userId = await store.createAccount({
    email: normalizeEmail(ask.email),
    password: ask.password,
    name: ask.name,
  });
  if (userId === EMAIL_EXISTS) return failure(409, 'The email already has an account');
  try {
    return json(200, await store.updateProfile(userId, { name: ask.name, role: ask.role }));
  } catch (error) {
    await store.deleteAccount(userId);
    throw error;
  }
}

/**
 * The password goes first, so a password Auth turns down leaves everything as it was. Then disabling
 * closes the RLS (`status`) before banning the account in Auth; activating, the other way round, so
 * the account is never open in Auth while the data say it is disabled.
 */
async function update(
  store: AdminUsersStore,
  callerId: string,
  { userId, changes }: UpdateRequest,
): Promise<Response> {
  const target = await store.profileOf(userId);
  if (!target) return failure(404, 'The user does not exist');
  const { password, ...profile } = changes;
  const problem = userChangeProblem(callerId, target, profile, await store.linksOf(userId));
  if (problem) return failure(409, `The change is not allowed: ${problem}`);

  const activates = profile.status === 'active' && target.status !== 'active';
  const disables = profile.status === 'disabled' && target.status !== 'disabled';
  if (password !== undefined) await store.setPassword(userId, password);
  if (activates) await store.setBan(userId, false);
  let row = target;
  if (Object.keys(profile).length > 0) row = await store.updateProfile(userId, profile);
  if (disables) await store.setBan(userId, true);
  return json(200, row);
}

/**
 * Several accounts disabled at once (5.2g): those of the students who finished. Each as an update
 * alone, one after another, as Auth bans them one by one: one that does not exist, that the rules
 * forbid (the administration itself) or whose change fails is left in `failed`, and the others go
 * on. One already disabled is not touched again.
 */
async function disable(
  store: AdminUsersStore,
  callerId: string,
  { userIds }: DisableRequest,
): Promise<Response> {
  const disabled: string[] = [];
  const failed: string[] = [];
  const changes: ProfileChanges = { status: 'disabled' };
  for (const userId of userIds) {
    try {
      const target = await store.profileOf(userId);
      if (!target || userChangeProblem(callerId, target, changes, await store.linksOf(userId))) {
        failed.push(userId);
        continue;
      }
      if (target.status !== 'disabled') {
        await store.updateProfile(userId, changes);
        await store.setBan(userId, true);
      }
      disabled.push(userId);
    } catch (error) {
      console.error(error);
      failed.push(userId);
    }
  }
  return json(200, { disabled, failed });
}
