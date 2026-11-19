import { assertEquals, assertStringIncludes } from '@std/assert';

import type { AiModelCheck } from '../../../src/app/data/ai-provider-setting.ts';

import { type LlmProvider, OpenAICompatibleProvider } from '../_shared/llm-provider.ts';
import { MAX_FALLBACKS, type ModelEndpoint } from '../_shared/provider-setting.ts';
import type { StaffRequestKind, StaffRequests } from '../_shared/staff-requests.ts';
import {
  AI_CHECKS_PER_DAY,
  AI_CHECKS_PER_MINUTE,
  type AiCheckStore,
  createAiCheckHandler,
  MAX_CHECK_BODY_BYTES,
} from './ai-check.ts';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const TEACHER_ID = '10000000-0000-4000-8000-000000000002';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GROQ = 'https://api.groq.com/openai/v1';
/** What a provider says on failure: it must never reach the answer. */
const SECRET_REASON = 'echo of the request with sk-123';

class FakeStore implements AiCheckStore {
  userOf(token: string) {
    const users: Record<string, string> = { 'token-admin': ADMIN_ID, 'token-marta': TEACHER_ID };
    return Promise.resolve(users[token] ?? null);
  }
  isActiveAdmin(userId: string) {
    return Promise.resolve(userId === ADMIN_ID);
  }
}

class FakeStaff implements StaffRequests {
  wait: number | null = 0;
  readonly claims: [string, StaffRequestKind, number, number | undefined][] = [];
  claim(userId: string, kind: StaffRequestKind, perMinute: number, perDay?: number) {
    this.claims.push([userId, kind, perMinute, perDay]);
    return Promise.resolve(this.wait);
  }
}

/** How the fake provider answers each model: a status, or `timeout`. */
type Outcome = number | 'timeout';

function setup(outcomes: Record<string, Outcome> = {}) {
  const staff = new FakeStaff();
  let clock = 0;
  const asked: { url: string; model: string; key: string | null }[] = [];
  const fakeFetch = (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const headers = new Headers(init?.headers);
    asked.push({ url: String(url), model: body.model, key: headers.get('Authorization') });
    const outcome = outcomes[body.model] ?? 200;
    clock += 300;
    if (outcome === 'timeout') {
      clock += 60_000;
      return Promise.reject(new DOMException('Too slow', 'TimeoutError'));
    }
    const answer =
      outcome === 200
        ? { choices: [{ message: { content: '{"ok":true}' } }] }
        : { error: { message: SECRET_REASON } };
    return Promise.resolve(Response.json(answer, { status: outcome }));
  };
  const handle = createAiCheckHandler({
    store: new FakeStore(),
    staff,
    mayCall: (baseUrl) => baseUrl === GEMINI || baseUrl === GROQ,
    secretOf: (name) => ({ AI_API_KEY: 'gemini-key' })[name],
    providerOf: ({ keySecret: _, ...endpoint }: ModelEndpoint, apiKey) =>
      new OpenAICompatibleProvider({ ...endpoint, apiKey, overloadRetryMs: 0 }, fakeFetch),
    now: () => clock,
  });
  const call = (body: unknown, token = 'token-admin') =>
    handle(
      new Request('http://localhost/ai-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  return { call, staff, asked };
}

Deno.test('needs a session of an active administrator', async () => {
  const { call, staff } = setup();

  assertEquals((await call({}, 'nobody')).status, 401);
  assertEquals((await call({}, 'token-marta')).status, 403);
  assertEquals(staff.claims, []);
});

Deno.test('counts each check against its limits, and says how long to wait', async () => {
  const { call, staff } = setup();
  staff.wait = 12;

  const response = await call({ baseUrl: GEMINI, model: 'flash' });

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '12');
  assertEquals(staff.claims, [[ADMIN_ID, 'ai_check', AI_CHECKS_PER_MINUTE, AI_CHECKS_PER_DAY]]);
});

Deno.test('turns down a body too large', async () => {
  const { call } = setup();
  const response = await call({ baseUrl: GEMINI, model: 'x'.repeat(MAX_CHECK_BODY_BYTES) });
  assertEquals(response.status, 413);
});

Deno.test('answers invalid for what is not a provider, without calling anything', async () => {
  const { call, asked } = setup();

  assertEquals(await (await call({ baseUrl: GEMINI, model: ' ' })).json(), [
    { model: ' ', problem: 'invalid' },
  ]);
  assertEquals(await (await call('not json')).json(), [{ model: '', problem: 'invalid' }]);
  assertEquals(asked, []);
});

Deno.test('answers host_not_allowed for a main host the functions may not call', async () => {
  const { call, asked } = setup();

  const response = await call({ baseUrl: 'https://evil.test/v1', model: 'm', fallbacks: ['x'] });

  assertEquals(await response.json(), [{ model: 'm', problem: 'host_not_allowed' }]);
  assertEquals(asked, []);
});

Deno.test('checks every model in order, one result each, with its key', async () => {
  const { call, asked } = setup();

  const response = await call({
    baseUrl: GEMINI,
    model: 'flash',
    fallbacks: [
      'gemma',
      { baseUrl: GROQ, model: 'llama', keySecret: 'AI_GROQ_API_KEY' },
      { baseUrl: 'https://evil.test/v1', model: 'other', keySecret: null },
    ],
  });

  assertEquals(response.status, 200);
  assertEquals(withoutTimes(await response.json()), [
    { model: 'flash', ms: 'n' },
    { model: 'gemma', ms: 'n' },
    { model: 'llama', problem: 'no_key' },
    { model: 'other', problem: 'host_not_allowed' },
  ]);
  assertEquals(asked, [
    { url: `${GEMINI}/chat/completions`, model: 'flash', key: 'Bearer gemini-key' },
    { url: `${GEMINI}/chat/completions`, model: 'gemma', key: 'Bearer gemini-key' },
  ]);
});

/** The results with each time as `n`: the models answer at once, in any order. */
function withoutTimes(checks: AiModelCheck[]) {
  return checks.map((check) => (check.ms === undefined ? check : { ...check, ms: 'n' }));
}

Deno.test('keeps in its place, as invalid, a fallback the functions would leave out', async () => {
  const { call, asked } = setup();

  const response = await call({
    baseUrl: GEMINI,
    model: 'flash',
    fallbacks: [
      'flash',
      { model: 'gemma', keySecret: 'SUPABASE_SERVICE_ROLE_KEY' },
      { model: 'slow', timeoutMs: 500_000 },
      'gemma',
      'gemma',
    ],
  });

  assertEquals(withoutTimes(await response.json()), [
    { model: 'flash', ms: 'n' },
    { model: 'flash', problem: 'invalid' },
    { model: 'gemma', problem: 'invalid' },
    { model: 'slow', problem: 'invalid' },
    { model: 'gemma', ms: 'n' },
    { model: 'gemma', problem: 'invalid' },
  ]);
  assertEquals(
    asked.map(({ model }) => model),
    ['flash', 'gemma'],
  );
});

Deno.test(
  'takes as invalid more fallbacks than the table allows, or fallbacks that are no list',
  async () => {
    const { call, asked } = setup();
    const fallbacks = Array.from({ length: MAX_FALLBACKS + 1 }, (_, index) => `m${index}`);

    for (const body of [
      { baseUrl: GEMINI, model: 'flash', fallbacks },
      { baseUrl: GEMINI, model: 'flash', fallbacks: 'gemma' },
    ]) {
      assertEquals(await (await call(body)).json(), [{ model: 'flash', problem: 'invalid' }]);
    }
    assertEquals(asked, []);
  },
);

Deno.test('asks every model at once, not one after another', async () => {
  const staff = new FakeStaff();
  let waiting = 0;
  let release = () => {};
  const allAsked = new Promise<void>((resolve) => (release = resolve));
  const provider = (model: string): LlmProvider => ({
    model,
    async complete() {
      if (++waiting === 3) release();
      // Each answers only once all three were asked: one after another, it would never end
      await allAsked;
      return '{"ok":true}';
    },
  });
  const handle = createAiCheckHandler({
    store: new FakeStore(),
    staff,
    mayCall: () => true,
    secretOf: () => 'key',
    providerOf: ({ model }) => provider(model),
  });

  const response = await handle(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-admin' },
      body: JSON.stringify({ baseUrl: GEMINI, model: 'a', fallbacks: ['b', 'c'] }),
    }),
  );

  assertEquals(
    (await response.json()).map((check: AiModelCheck) => check.model),
    ['a', 'b', 'c'],
  );
});

Deno.test('translates each failure of the provider, never with its text', async () => {
  const { call } = setup({ a: 401, b: 403, c: 404, d: 429, e: 'timeout', f: 503, g: 400 });

  const response = await call({
    baseUrl: GEMINI,
    model: 'a',
    fallbacks: ['b', 'c', 'd', 'e', { model: 'f', timeoutMs: 60_000 }],
  });
  const text = await response.text();

  assertEquals(JSON.parse(text), [
    { model: 'a', problem: 'unauthorized' },
    { model: 'b', problem: 'unauthorized' },
    { model: 'c', problem: 'not_found' },
    { model: 'd', problem: 'rate_limited' },
    { model: 'e', problem: 'timeout' },
    { model: 'f', problem: 'unavailable' },
  ]);
  assertEquals(text.includes(SECRET_REASON), false);

  const other = await call({ baseUrl: GEMINI, model: 'g' });
  assertEquals(await other.json(), [{ model: 'g', problem: 'unavailable' }]);
});

Deno.test('fails with 500 when something else breaks, without its details', async () => {
  const { call, staff } = setup();
  staff.claim = () => Promise.reject(new Error('Database down'));

  const response = await call({ baseUrl: GEMINI, model: 'flash' });

  assertEquals(response.status, 500);
  assertStringIncludes(await response.text(), 'check of the AI provider failed');
});

Deno.test('answers the preflight and only takes POST', async () => {
  const { staff } = setup();
  const handle = createAiCheckHandler({
    store: new FakeStore(),
    staff,
    mayCall: () => true,
    secretOf: () => undefined,
    providerOf: () => {
      throw new Error('Not called');
    },
  });

  assertEquals((await handle(new Request('http://x', { method: 'OPTIONS' }))).ok, true);
  assertEquals((await handle(new Request('http://x', { method: 'GET' }))).status, 405);
});
