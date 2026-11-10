import type { Provider } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import type { Row } from './supabase-rows';

/** Test helpers: a Supabase server in memory, answering the real client through its `fetch`. */

export const FAKE_SUPABASE_URL = 'https://supabase.test';

/** A request the client sent, as the tests check it. */
export interface FakeRequest {
  readonly method: string;
  /** Without the origin: `/rest/v1/attempt`. */
  readonly path: string;
  readonly params: URLSearchParams;
  readonly headers: Headers;
  /** The JSON body, if any. */
  readonly body: unknown;
}

export interface FakeReply {
  readonly status?: number;
  readonly body?: unknown;
}

type Answer = FakeReply | ((request: FakeRequest) => FakeReply);

interface Route {
  readonly method: string;
  readonly path: string;
  readonly answer: Answer;
}

/**
 * Answers each request with the reply registered for its method and path (the latest one wins), or
 * 404 without one. `offline()` makes the next requests fail as without a network.
 */
export class FakeSupabaseServer {
  readonly requests: FakeRequest[] = [];
  private routes: Route[] = [];
  private online = true;

  on(method: string, path: string, answer: Answer): this {
    this.routes = [{ method, path, answer }, ...this.routes];
    return this;
  }

  offline(): this {
    this.online = false;
    return this;
  }

  /** The requests to a path, in the order they were sent. */
  sentTo(method: string, path: string): FakeRequest[] {
    return this.requests.filter((request) => request.method === method && request.path === path);
  }

  readonly fetch: typeof fetch = async (input, init) => {
    if (!this.online) throw new TypeError('Failed to fetch');
    const url = new URL(input instanceof Request ? input.url : String(input));
    const text = typeof init?.body === 'string' ? init.body : '';
    const request: FakeRequest = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      params: url.searchParams,
      headers: new Headers(init?.headers),
      body: text ? JSON.parse(text) : undefined,
    };
    this.requests.push(request);
    const route = this.routes.find(
      ({ method, path }) => method === request.method && path === request.path,
    );
    const reply = route
      ? typeof route.answer === 'function'
        ? route.answer(request)
        : route.answer
      : { status: 404, body: { message: 'No route', code: 'PGRST125' } };
    const status = reply.status ?? 200;
    const body = reply.body === undefined || status === 204 ? null : JSON.stringify(reply.body);
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
  };

  /** Lets `user` sign in with any password; the client then sends their token. */
  acceptSignIn(user: Row<'app_user'>): this {
    return this.on('POST', '/auth/v1/token', { body: sessionOf(user.id, user.email) });
  }
}

/** Each test gets its own storage key: Supabase warns about two clients sharing one. */
let clientCount = 0;

/** The real client, with the fake server as its network and the session only in memory. */
export function provideFakeSupabase(server: FakeSupabaseServer): Provider {
  return {
    provide: SUPABASE_CLIENT,
    useFactory: () =>
      createClient<Database>(FAKE_SUPABASE_URL, 'sb_publishable_test', {
        global: { fetch: server.fetch },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: `fake-supabase-${++clientCount}`,
        },
        // The app keeps the retries of PostgREST; the tests see each failure at once
        db: { retry: false },
      }),
  };
}

/** What Auth answers to a sign-in: a session that lasts an hour. */
export function sessionOf(userId: string, email: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: fakeJwt({ sub: userId, email, role: 'authenticated', exp: expiresAt }),
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-09-01T08:00:00Z',
    },
  };
}

function fakeJwt(claims: object): string {
  const encode = (part: object) =>
    btoa(JSON.stringify(part)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

/** Rows as PostgREST returns them, for the tests to change only what they are about. */
export function appUserRow(overrides: Partial<Row<'app_user'>> = {}): Row<'app_user'> {
  return {
    id: 'user-1',
    name: 'Lucía Pérez',
    email: 'lucia@tutoria.test',
    role: 'student',
    status: 'active',
    privacy_notice_seen_at: null,
    created_at: '2026-09-01T08:00:00+00:00',
    updated_at: '2026-09-01T08:00:00+00:00',
    ...overrides,
  };
}

export function exerciseRow(overrides: Partial<Row<'exercise'>> = {}): Row<'exercise'> {
  return {
    id: 'exercise-1',
    title: 'Sumar los elementos de un vector',
    statement: 'Escribe `sumar(numeros)`.',
    difficulty: 'initial',
    topics: ['Vectores'],
    kind: 'code',
    language: 'javascript',
    function_name: 'sumar',
    max_repeated_failures: 3,
    max_idle_minutes: 4,
    created_by: 'teacher-1',
    created_at: '2026-09-01T08:00:00+00:00',
    updated_at: '2026-09-01T08:00:00+00:00',
    ...overrides,
  };
}

export function testRow(overrides: Partial<Row<'test'>> = {}): Row<'test'> {
  return {
    id: 'test-1',
    exercise_id: 'exercise-1',
    input: [[1, 2, 3]],
    expected_output: 6,
    is_hidden: false,
    position: 1,
    ...overrides,
  };
}

export function attemptRow(overrides: Partial<Row<'attempt'>> = {}): Row<'attempt'> {
  return {
    id: 'attempt-1',
    exercise_id: 'exercise-1',
    user_id: 'user-1',
    assignment_id: 'assignment-1',
    current_code: '',
    final_code: null,
    status: 'in_progress',
    started_at: '2026-09-01T08:00:00+00:00',
    finished_at: null,
    updated_at: '2026-09-01T08:00:00+00:00',
    ...overrides,
  };
}

export function interactionRow(
  overrides: Partial<Row<'tutor_interaction'>> = {},
): Row<'tutor_interaction'> {
  return {
    id: 'interaction-1',
    attempt_id: 'attempt-1',
    trigger: 'hint',
    hint_level: 1,
    student_message: null,
    transcript: '¿Qué valor tiene el acumulador al empezar?',
    emotion: 'encouragement',
    intensity: 1,
    elusion: false,
    prompt_version: 'v1',
    created_at: '2026-09-01T08:05:00+00:00',
    ...overrides,
  };
}

export function eventRow(overrides: Partial<Row<'process_event'>> = {}): Row<'process_event'> {
  return {
    id: 'event-1',
    attempt_id: 'attempt-1',
    type: 'paste',
    timestamp: '2026-09-01T08:03:00+00:00',
    detail: { length: 40 },
    received_at: '2026-09-01T08:03:01+00:00',
    ...overrides,
  };
}
