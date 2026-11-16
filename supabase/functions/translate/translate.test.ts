import { assertEquals } from '@std/assert';

import { type ChatMessage, type LlmProvider, ProviderError } from '../_shared/llm-provider.ts';
import type { ProviderSetting } from '../_shared/provider-setting.ts';
import type { StaffRequestKind, StaffRequests } from '../_shared/staff-requests.ts';
import {
  createTranslateHandler,
  TRANSLATIONS_PER_DAY,
  TRANSLATIONS_PER_MINUTE,
  type TranslateStore,
} from './translate.ts';

const SETTING: ProviderSetting = {
  models: [
    {
      baseUrl: 'https://ai.test',
      model: 'flash',
      keySecret: 'AI_API_KEY',
      responseFormat: 'json_schema',
    },
  ],
};

const REQUEST = {
  from: 'es',
  to: 'ca',
  texts: { title: 'Suma', statement: 'Escribe `sum(values)`.', topics: ['Bucles'] },
  functionName: 'sum',
  parameters: ['values'],
};

const GOOD = { title: 'Suma', statement: 'Escriu `sum(values)`.', topics: ['Bucles'] };

/** Marta signs in with `token-marta`. */
class FakeStore implements TranslateStore {
  setting: ProviderSetting | null = SETTING;
  userOf(token: string) {
    return Promise.resolve(token === 'token-marta' ? 'marta' : null);
  }
  providerSetting() {
    return Promise.resolve(this.setting);
  }
}

class FakeStaff implements StaffRequests {
  teacher = true;
  wait = 0;
  readonly claims: [string, StaffRequestKind, number, number | undefined][] = [];
  claim(userId: string, kind: StaffRequestKind, perMinute: number, perDay?: number) {
    this.claims.push([userId, kind, perMinute, perDay]);
    return Promise.resolve(this.teacher ? this.wait : null);
  }
}

/** A model that gives the answers of the test in order, and remembers what it was asked. */
class FakeProvider implements LlmProvider {
  readonly model = 'flash';
  readonly asked: ChatMessage[][] = [];
  constructor(private readonly answers: (string | Error)[]) {}
  complete(messages: readonly ChatMessage[]) {
    this.asked.push([...messages]);
    const answer = this.answers.shift() ?? '';
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }
}

function setup(answers: (string | Error)[] = [JSON.stringify(GOOD)]) {
  const store = new FakeStore();
  const staff = new FakeStaff();
  const provider = new FakeProvider(answers);
  const settings: ProviderSetting[] = [];
  const handle = createTranslateHandler({
    store,
    staff,
    providerFor: (setting) => {
      settings.push(setting);
      return provider;
    },
  });
  return { store, staff, provider, settings, handle };
}

function post(body: unknown, token: string | null = 'token-marta'): Request {
  return new Request('http://functions.test/translate', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Runs `fn` without the warnings and errors the function logs on purpose. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { warn, error } = console;
  console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

Deno.test(
  'a teacher gets the draft of the translation, with the models of the setting',
  async () => {
    const { staff, provider, settings, handle } = setup();

    const response = await handle(post(REQUEST));

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(await response.json(), GOOD);
    assertEquals(settings, [SETTING]);
    assertEquals(staff.claims, [
      ['marta', 'translate', TRANSLATIONS_PER_MINUTE, TRANSLATIONS_PER_DAY],
    ]);
    assertEquals(provider.asked.length, 1);
  },
);

Deno.test('a translation that changes the code is asked once more, saying why', async () => {
  const changed = JSON.stringify({ ...GOOD, statement: 'Escriu `suma(valors)`.' });
  const { provider, handle } = setup([changed, JSON.stringify(GOOD)]);

  const response = await quietly(() => handle(post(REQUEST)));

  assertEquals(response.status, 200);
  assertEquals(provider.asked.length, 2);
  const second = provider.asked[1];
  assertEquals(second.at(-2), { role: 'assistant', content: changed });
  assertEquals(second.at(-1)?.content.includes('changed the code'), true);
});

Deno.test('twice wrong, there is no draft', async () => {
  const { handle } = setup(['no', 'no']);

  assertEquals((await quietly(() => handle(post(REQUEST)))).status, 502);
});

Deno.test('the browser may ask before calling, and only POST translates', async () => {
  const { handle } = setup();

  const options = await handle(
    new Request('http://functions.test/translate', { method: 'OPTIONS' }),
  );
  assertEquals(options.status, 204);
  assertEquals((await handle(new Request('http://functions.test/translate'))).status, 405);
});

Deno.test('without a session, or without being a teacher, nothing is translated', async () => {
  const { staff, provider, handle } = setup();

  assertEquals((await handle(post(REQUEST, null))).status, 401);
  assertEquals((await handle(post(REQUEST, 'forged'))).status, 401);
  staff.teacher = false;
  assertEquals((await handle(post(REQUEST))).status, 403);
  assertEquals(provider.asked, []);
});

Deno.test('a body that is not a request is invalid, before counting it', async () => {
  const { staff, handle } = setup();

  assertEquals((await handle(post('not json'))).status, 400);
  assertEquals((await handle(post({ ...REQUEST, to: 'es' }))).status, 400);
  assertEquals(staff.claims, []);
});

Deno.test('a body past the limit is not read', async () => {
  const { handle, staff } = setup();
  const huge = new Request('http://functions.test/translate', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-marta' },
    body: JSON.stringify({ pad: 'x'.repeat(1_000_001) }),
  });

  assertEquals((await handle(huge)).status, 413);
  assertEquals(staff.claims, []);
});

Deno.test('past the limit it waits, and says how long', async () => {
  const { staff, provider, handle } = setup();
  staff.wait = 20;

  const response = await handle(post(REQUEST));

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '20');
  assertEquals(provider.asked, []);
});

Deno.test('without a provider, or when it fails, the AI is not available', async () => {
  const none = setup();
  none.store.setting = null;
  assertEquals((await none.handle(post(REQUEST))).status, 503);

  const failing = setup([new ProviderError('quota', 429)]);
  assertEquals((await quietly(() => failing.handle(post(REQUEST)))).status, 503);
});

Deno.test('a failure of the server is an unknown error, never a crash', async () => {
  const { store, handle } = setup();
  store.providerSetting = () => Promise.reject(new Error('Database down'));

  assertEquals((await quietly(() => handle(post(REQUEST)))).status, 500);
});
