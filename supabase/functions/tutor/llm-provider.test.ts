import { assertEquals, assertRejects } from '@std/assert';

import {
  type ChatMessage,
  FallbackProvider,
  type LlmProvider,
  OpenAICompatibleProvider,
  ProviderError,
} from './llm-provider.ts';
import type { ResponseFormatMode } from './answer-store.ts';
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

Deno.test('the format of the answer is asked as the provider takes it', async () => {
  const bodyFor = async (responseFormat?: ResponseFormatMode) => {
    let body: Record<string, unknown> = {};
    const fetchFn = (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Promise.resolve(completion('{}'));
    };
    const llm = new OpenAICompatibleProvider(
      { baseUrl: GEMINI, model: 'm', responseFormat },
      fetchFn as typeof fetch,
    );
    await llm.complete(MESSAGES, ANSWER_FORMAT);
    return body;
  };

  assertEquals((await bodyFor()).response_format, {
    type: 'json_schema',
    json_schema: { name: ANSWER_FORMAT.name, schema: ANSWER_FORMAT.schema },
  });
  assertEquals((await bodyFor('json_object')).response_format, { type: 'json_object' });
  assertEquals('response_format' in (await bodyFor('none')), false);
});

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

/** A model that answers with its name, or fails as the test says. */
class NamedModel implements LlmProvider {
  calls = 0;
  constructor(
    readonly model: string,
    private readonly failure?: Error,
  ) {}
  complete() {
    this.calls++;
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.model);
  }
}

const OVERLOADED = () => new ProviderError('The model answered 503', 503);

Deno.test('the fallback models stay out while the main one answers', async () => {
  const main = new NamedModel('flash');
  const fallback = new NamedModel('flash-lite');
  const llm = new FallbackProvider([main, fallback]);

  assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), 'flash');
  assertEquals(llm.model, 'flash');
  assertEquals(fallback.calls, 0);
});

Deno.test('when the main model fails, the next one answers the rest of the request', async () => {
  const main = new NamedModel('flash', OVERLOADED());
  const fallback = new NamedModel('flash-lite');
  const llm = new FallbackProvider([main, fallback]);

  assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), 'flash-lite');
  assertEquals(llm.model, 'flash-lite');
  assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), 'flash-lite');
  assertEquals(main.calls, 1);
});

Deno.test('the chain goes down as many fallback models as it has, in order', async () => {
  const models = [
    new NamedModel('pro', OVERLOADED()),
    new NamedModel('flash', new ProviderError('The model answered 429', 429)),
    new NamedModel('flash-lite', new ProviderError('The call to the model timed out')),
    new NamedModel('local'),
  ] as const;
  const llm = new FallbackProvider(models);

  assertEquals(await llm.complete(MESSAGES, ANSWER_FORMAT), 'local');
  assertEquals(llm.model, 'local');
  assertEquals(
    models.map((model) => model.calls),
    [1, 1, 1, 1],
  );
});

Deno.test('the fallback does not hide a failure that is not of the provider', async () => {
  const llm = new FallbackProvider([
    new NamedModel('flash', new TypeError('bug')),
    new NamedModel('flash-lite'),
  ]);
  await assertRejects(() => llm.complete(MESSAGES, ANSWER_FORMAT), TypeError, 'bug');
});

Deno.test('when every model fails, the failure of the last one is the answer', async () => {
  const llm = new FallbackProvider([
    new NamedModel('flash', OVERLOADED()),
    new NamedModel('flash-lite', new ProviderError('The model answered 429', 429)),
  ]);
  const error = await assertRejects(() => llm.complete(MESSAGES, ANSWER_FORMAT), ProviderError);
  assertEquals(error.status, 429);
});

Deno.test('once the time budget is spent, no other model is tried', async () => {
  let clock = 0;
  /** A model that fails after the time the test says. */
  class SlowFailure extends NamedModel {
    constructor(
      model: string,
      private readonly ms: number,
    ) {
      super(model, OVERLOADED());
    }
    override complete() {
      clock += this.ms;
      return super.complete();
    }
  }
  const last = new NamedModel('flash-lite');
  const llm = new FallbackProvider(
    [new SlowFailure('pro', 20_000), new SlowFailure('flash', 15_000), last],
    { budgetMs: 30_000, now: () => clock },
  );

  const error = await assertRejects(() => llm.complete(MESSAGES, ANSWER_FORMAT), ProviderError);
  assertEquals(error.status, 503);
  assertEquals(llm.model, 'flash');
  assertEquals(last.calls, 0);
});

// The answer as calls to tools (2.5e, D-051)

function toolsProvider(message: Record<string, unknown>) {
  let body: Record<string, unknown> = {};
  const fetchFn = (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return Promise.resolve(Response.json({ choices: [{ message }] }));
  };
  const llm = new OpenAICompatibleProvider(
    { baseUrl: GEMINI, model: 'm', responseFormat: 'tools' },
    fetchFn as typeof fetch,
  );
  return { llm, body: () => body };
}

const toolCall = (name: string, args: unknown) => ({
  type: 'function',
  function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
});

Deno.test(
  'with tools, the answer is the tool respond and each tool of the contract one more',
  async () => {
    const { llm, body } = toolsProvider({ content: '{"message":"hola"}' });
    await llm.complete(MESSAGES, ANSWER_FORMAT);
    const sent = body();
    assertEquals('response_format' in sent, false);
    assertEquals(sent.tool_choice, 'required');
    const tools = sent.tools as {
      function: { name: string; parameters: { properties: object } };
    }[];
    assertEquals(tools[0].function.name, 'respond');
    assertEquals(Object.keys(tools[0].function.parameters.properties).includes('query'), false);
    assertEquals(Object.keys(tools[0].function.parameters.properties).includes('actions'), false);
    assertEquals(tools.length, 1 + ANSWER_FORMAT.tools!.length);
  },
);

Deno.test('with tools, the calls become the JSON of the answer', async () => {
  const { llm } = toolsProvider({
    content: null,
    tool_calls: [
      toolCall('respond', { message: 'Mira la línea 2', emotion: 'joy' }),
      toolCall('highlightLines', { lines: [{ line: 2 }] }),
      toolCall('getMyProgress', {}),
      toolCall('unknown', {}),
      toolCall('navigate', '{not json'),
    ],
  });
  assertEquals(JSON.parse(await llm.complete(MESSAGES, ANSWER_FORMAT)), {
    message: 'Mira la línea 2',
    emotion: 'joy',
    actions: { highlightLines: { lines: [{ line: 2 }] } },
    query: { getMyProgress: {} },
  });
});

Deno.test(
  'with tools, only a query is an answer still to write, and plain text still counts',
  async () => {
    const query = toolsProvider({ tool_calls: [toolCall('getSettings', {})] });
    assertEquals(JSON.parse(await query.llm.complete(MESSAGES, ANSWER_FORMAT)), {
      message: '',
      query: { getSettings: {} },
    });
    const text = toolsProvider({ content: '{"message":"hola"}', tool_calls: [] });
    assertEquals(await text.llm.complete(MESSAGES, ANSWER_FORMAT), '{"message":"hola"}');
  },
);
