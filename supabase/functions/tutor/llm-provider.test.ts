import { assertEquals, assertRejects } from '@std/assert';

import { type ChatMessage, OpenAICompatibleProvider, ProviderError } from './llm-provider.ts';
import { ANSWER_FORMAT } from './model-answer.ts';

const MESSAGES: ChatMessage[] = [{ role: 'user', content: 'Hola' }];
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/';

/** A provider whose `fetch` answers what the test says, and remembers what it got. */
function provider(answer: () => Response | Promise<Response>, apiKey?: string) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(answer());
  };
  return {
    calls,
    llm: new OpenAICompatibleProvider(
      { baseUrl: GEMINI, model: 'gemini-flash', apiKey, timeoutMs: 50, overloadRetryMs: 0 },
      fetchFn as typeof fetch,
    ),
  };
}

const completion = (content: unknown) =>
  Response.json({ choices: [{ message: { role: 'assistant', content } }] });

Deno.test(
  'the provider asks chat completions with the model, the key and the answer format',
  async () => {
    const { llm, calls } = provider(() => completion('{"message": "Hola"}'), 'secret-key');

    assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), '{"message": "Hola"}');
    assertEquals(llm.model, 'gemini-flash');
    assertEquals(calls[0].url, `${GEMINI}chat/completions`);
    assertEquals(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer secret-key');
    const body = JSON.parse(String(calls[0].init.body));
    assertEquals(body.model, 'gemini-flash');
    assertEquals(body.messages, MESSAGES);
    assertEquals(body.response_format.type, 'json_schema');
    assertEquals(body.response_format.json_schema.name, 'tutor_answer');
  },
);

Deno.test('a local Ollama needs no key', async () => {
  const { llm, calls } = provider(() => completion('{}'));
  await llm.complete(MESSAGES, ANSWER_FORMAT);
  assertEquals(new Headers(calls[0].init.headers).has('Authorization'), false);
});

Deno.test('the provider fails with its status, without an answer or out of time', async () => {
  const limited = provider(() => new Response('{"error": "quota"}', { status: 429 })).llm;
  const error = await assertRejects(() => limited.complete(MESSAGES, ANSWER_FORMAT), ProviderError);
  assertEquals(error.status, 429);

  const empty = provider(() => Response.json({ choices: [] })).llm;
  await assertRejects(() => empty.complete(MESSAGES, ANSWER_FORMAT), ProviderError, 'no answer');
  const notJson = provider(() => new Response('<html>')).llm;
  await assertRejects(() => notJson.complete(MESSAGES, ANSWER_FORMAT), ProviderError, 'no answer');
  const noChoices = provider(() => Response.json({ error: 'x' })).llm;
  await assertRejects(
    () => noChoices.complete(MESSAGES, ANSWER_FORMAT),
    ProviderError,
    'no answer',
  );
  const notText = provider(() => completion(null)).llm;
  await assertRejects(() => notText.complete(MESSAGES, ANSWER_FORMAT), ProviderError, 'no answer');

  const offline = provider(() => {
    throw new TypeError('connection refused');
  }).llm;
  await assertRejects(() => offline.complete(MESSAGES, ANSWER_FORMAT), ProviderError, 'failed');
});

Deno.test('the provider gives up when the model takes too long', async () => {
  const fetchFn = (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
  const slow = new OpenAICompatibleProvider(
    { baseUrl: GEMINI, model: 'gemini-flash', timeoutMs: 10 },
    fetchFn as typeof fetch,
  );
  await assertRejects(() => slow.complete(MESSAGES, ANSWER_FORMAT), ProviderError, 'timed out');
});

Deno.test('the provider asks once more when the model is overloaded for a moment', async () => {
  const answers = [
    () => Response.json([{ error: { code: 503, message: 'High demand' } }], { status: 503 }),
    () => completion('{"message": "Hola"}'),
  ];
  const { llm, calls } = provider(() => answers.shift()!());

  assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), '{"message": "Hola"}');
  assertEquals(calls.length, 2);
});

Deno.test(
  'the provider gives up after a second overload, with the reason of the provider',
  async () => {
    const overloaded = provider(() =>
      Response.json([{ error: { code: 503, message: 'High demand' } }], { status: 503 }),
    );
    const error = await assertRejects(
      () => overloaded.llm.complete(MESSAGES, ANSWER_FORMAT),
      ProviderError,
      'The model answered 503: High demand',
    );
    assertEquals(error.status, 503);
    assertEquals(overloaded.calls.length, 2);
  },
);

Deno.test('the provider does not ask again when the key or the model is wrong', async () => {
  const forbidden = provider(() =>
    Response.json({ error: { message: 'API key not valid' } }, { status: 403 }),
  );
  await assertRejects(
    () => forbidden.llm.complete(MESSAGES, ANSWER_FORMAT),
    ProviderError,
    'The model answered 403: API key not valid',
  );
  assertEquals(forbidden.calls.length, 1);
});
