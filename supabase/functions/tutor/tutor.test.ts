import { assertEquals, assertStringIncludes } from '@std/assert';

import type {
  AnswerStore,
  ModelEndpoint,
  NewAnswer,
  ProviderSetting,
  RecordedAnswer,
  RecordOutcome,
  TutorAttempt,
} from './answer-store.ts';
import type { RunOutcome, RunRequest } from '../../../src/app/data/code-runner/run-result.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import { type ChatMessage, type LlmProvider, ProviderError } from './llm-provider.ts';
import {
  DEFAULT_ANSWERS,
  MAX_MESSAGE_LENGTH,
  TUTOR_CALLS_PER_MINUTE,
  createTutorHandler,
} from './tutor.ts';
import { PROMPT_VERSION } from './prompt.ts';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const ATTEMPT_ID = '70000000-0000-4000-8000-000000000012';
const REQUEST_ID = 'a0000000-0000-4000-8000-000000000001';
const CODE = 'function suma(v) { return 0; }';
const FLASH: ModelEndpoint = {
  baseUrl: 'https://llm.test/v1',
  model: 'flash',
  keySecret: 'AI_API_KEY',
  responseFormat: 'json_schema',
};

const ATTEMPT: TutorAttempt = {
  userId: 'hugo',
  ownerActive: true,
  status: 'in_progress',
  currentCode: CODE,
  exercise: {
    title: 'Suma',
    statement: 'Escribe una función `suma`.',
    topics: [],
    sourceLocale: 'es',
    translations: {},
    functionName: 'suma',
    tests: [{ id: 't1', input: [[1, 2, 3]], expectedOutput: 6, isHidden: false }],
  },
  lastRun: null,
  previous: [],
};

const GOOD = JSON.stringify({
  message: '¿Qué valor tiene el total antes del bucle?',
  emotion: 'encouragement',
  intensity: 2,
  reaction: 'thinking',
  elusion: false,
});

/** A store in memory: Hugo signs in with `token-hugo`. */
class FakeStore implements AnswerStore {
  attempt: TutorAttempt | null = ATTEMPT;
  answers: RecordedAnswer[] = [];
  calls: Date[] = [];
  setting: ProviderSetting | null = { models: [FLASH] };
  outcome: RecordOutcome | null = null;
  readonly recorded: NewAnswer[] = [];

  userOf(token: string) {
    return Promise.resolve(token === 'token-hugo' ? 'hugo' : null);
  }
  findAttempt(attemptId: string) {
    return Promise.resolve(attemptId === ATTEMPT_ID ? this.attempt : null);
  }
  findAnswer(requestId: string) {
    return Promise.resolve(this.answers.find((answer) => answer.id === `i-${requestId}`) ?? null);
  }
  latestCalls(_userId: string, since: Date, limit: number) {
    return Promise.resolve(this.calls.filter((call) => call >= since).slice(0, limit));
  }
  providerSetting() {
    return Promise.resolve(this.setting);
  }
  recordAnswer(answer: NewAnswer): Promise<RecordOutcome> {
    this.recorded.push(answer);
    return Promise.resolve(
      this.outcome ?? { status: 'recorded', interactionId: answer.answer ? 'i-new' : null },
    );
  }
}

/** A model that answers what the test says, one answer per call, and remembers what it got. */
class FakeProvider implements LlmProvider {
  readonly model = 'flash';
  readonly requests: ChatMessage[][] = [];
  constructor(private readonly answers: (string | Error)[]) {}
  complete(messages: readonly ChatMessage[]) {
    this.requests.push([...messages]);
    const answer = this.answers.shift() ?? GOOD;
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }
}

/** A sandbox where the code returns 0 for every example, and that remembers what it got. */
class FakeSandbox implements CodeSandbox {
  readonly requests: RunRequest[] = [];
  outcome: RunOutcome = { outcomes: [{ ok: true, value: 0 }] };
  run(request: RunRequest) {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

function setup(answers: (string | Error)[] = [GOOD]) {
  const store = new FakeStore();
  const llm = new FakeProvider(answers);
  const sandbox = new FakeSandbox();
  const settings: ProviderSetting[] = [];
  const handle = createTutorHandler({
    store,
    providerFor: (setting) => {
      settings.push(setting);
      return llm;
    },
    sandbox,
    now: () => NOW,
  });
  return { store, llm, settings, handle, sandbox };
}

function post(body: Record<string, unknown> = {}, token: string | null = 'token-hugo'): Request {
  return new Request('http://functions.test/tutor', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({
      requestId: REQUEST_ID,
      attemptId: ATTEMPT_ID,
      kind: 'hint',
      code: CODE,
      language: 'es',
      ...body,
    }),
  });
}

Deno.test('a hint asks the model at the next level and answers meta, delta and done', async () => {
  const { handle, store, llm, settings } = setup();
  store.attempt = {
    ...ATTEMPT,
    previous: [
      {
        trigger: 'hint',
        hintLevel: 1,
        studentMessage: null,
        transcript: 'Mira el bucle.',
        emotion: 'encouragement',
        intensity: 2,
        elusion: false,
        actions: [],
      },
    ],
  };

  const response = await handle(post());

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    events: [
      {
        type: 'meta',
        emotion: 'encouragement',
        intensity: 2,
        hintLevel: 2,
        reaction: 'thinking',
        elusion: false,
      },
      { type: 'delta', text: '¿Qué valor tiene el total antes del bucle?' },
      { type: 'done', interactionId: 'i-new', silent: false },
    ],
  });
  assertEquals(settings, [{ models: [FLASH] }]);
  assertStringIncludes(llm.requests[0].at(-1)!.content, 'Usa el nivel 2.');
  assertEquals(store.recorded, [
    {
      attemptId: ATTEMPT_ID,
      requestId: REQUEST_ID,
      trigger: 'hint',
      hintLevel: 2,
      studentMessage: null,
      answer: {
        message: '¿Qué valor tiene el total antes del bucle?',
        emotion: 'encouragement',
        intensity: 2,
        reaction: 'thinking',
        elusion: false,
      },
      promptVersion: PROMPT_VERSION,
      model: 'flash',
      rejected: 0,
    },
  ]);
});

Deno.test(
  'saying again that they are stuck raises the level without asking for a hint',
  async () => {
    const { handle, store, llm } = setup();
    store.attempt = {
      ...ATTEMPT,
      previous: [
        {
          trigger: 'question',
          hintLevel: 1,
          studentMessage: 'No me acuerdo de cómo se empieza',
          transcript: '¿Qué palabra crees que declara una función?',
          emotion: 'encouragement',
          intensity: 2,
          elusion: false,
          actions: [],
        },
      ],
    };

    const { events } = await (await handle(post({ kind: 'question', message: 'Ni idea' }))).json();

    assertEquals(events[0].hintLevel, 2);
    assertEquals(store.recorded[0].hintLevel, 2);
    assertStringIncludes(llm.requests[0].at(-1)!.content, 'usa como mucho el nivel 2.');
    assertStringIncludes(
      llm.requests[0].at(-1)!.content,
      'Nota: el alumno dice que no sabe seguir',
    );
    // The earlier turn goes before the request, as a turn of the chat
    assertEquals(
      llm.requests[0].map((message) => message.role),
      ['system', 'user', 'assistant', 'user'],
    );
  },
);

Deno.test('the empty skeleton of the exercise gets through; anything in it does not', async () => {
  const skeleton =
    'Así empieza:\n```js\nfunction suma(vector) {\n}\n```\nDentro, recorre el vector.';
  const filled = '```js\nfunction suma(vector) {\n  return 0;\n}\n```';
  const reply = (message: string) => JSON.stringify({ ...JSON.parse(GOOD), message });
  const { handle, store } = setup([reply(skeleton), reply(filled), reply(filled)]);

  const { events } = await (await handle(post({ kind: 'question', message: 'No sé' }))).json();
  assertEquals(events[1], { type: 'delta', text: skeleton });
  assertEquals(store.recorded[0].rejected, 0);

  await handle(post({ requestId: 'a0000000-0000-4000-8000-000000000002' }));
  assertEquals(store.recorded[1].rejected, 2);
  assertEquals(store.recorded[1].answer?.message, DEFAULT_ANSWERS.es);
});

Deno.test('a question keeps what the student asked and answers in their language', async () => {
  const { handle, store, llm } = setup();

  const response = await handle(
    post({ kind: 'question', message: '  What is a loop?  ', language: 'en' }),
  );

  assertEquals(response.status, 200);
  assertEquals(store.recorded[0].studentMessage, 'What is a loop?');
  assertEquals(store.recorded[0].hintLevel, 1);
  assertStringIncludes(llm.requests[0][0].content, 'Respondes SIEMPRE en inglés (English)');
});

Deno.test('an answer without a reaction of the catalog leaves it out of meta', async () => {
  const { handle } = setup([JSON.stringify({ ...JSON.parse(GOOD), reaction: 'stone' })]);
  const { events } = await (await handle(post())).json();
  assertEquals(events[0], {
    type: 'meta',
    emotion: 'encouragement',
    intensity: 2,
    hintLevel: 1,
    elusion: false,
  });
});

Deno.test('broken JSON or code is asked once more, reinforcing the rule', async () => {
  const withCode = JSON.stringify({ ...JSON.parse(GOOD), message: 'Escribe:\nlet total = 0;' });
  const { handle, llm, store } = setup(['{"message": ', GOOD, withCode, GOOD]);

  // Broken JSON, then good
  assertEquals((await handle(post())).status, 200);
  assertEquals(llm.requests.length, 2);
  assertStringIncludes(llm.requests[1][3].content, 'no era un objeto JSON');
  assertEquals(store.recorded[0].rejected, 1);

  // Code, then good
  await handle(post({ requestId: 'a0000000-0000-4000-8000-000000000002' }));
  assertEquals(llm.requests.length, 4);
  assertStringIncludes(llm.requests[3][3].content, 'incluía código');
  assertEquals(store.recorded[1].answer?.message, '¿Qué valor tiene el total antes del bucle?');
  assertEquals(store.recorded[1].rejected, 1);
});

Deno.test(
  'after two bad answers the tutor gives the default one, in the language of the request',
  async () => {
    const { handle, store } = setup(['nope', 'nope again']);

    const { events } = await (await handle(post({ language: 'ca' }))).json();

    assertEquals(events[0], {
      type: 'meta',
      emotion: 'encouragement',
      intensity: 1,
      hintLevel: 1,
      elusion: false,
    });
    assertEquals(events[1], { type: 'delta', text: DEFAULT_ANSWERS.ca });
    assertEquals(store.recorded[0].answer?.message, DEFAULT_ANSWERS.ca);
    assertEquals(store.recorded[0].rejected, 2);
  },
);

Deno.test(
  'a request for the solution answered twice with code stays an elusion in the default answer',
  async () => {
    const leak = JSON.stringify({
      ...JSON.parse(GOOD),
      message: 'Toma:\nreturn v.reduce((a, b) => a + b, 0);',
      elusion: true,
    });
    const { handle, store } = setup([leak, leak]);

    const { events } = await (
      await handle(post({ kind: 'question', message: 'Dame la solución' }))
    ).json();

    assertEquals(events[0].elusion, true);
    assertEquals(events[1], { type: 'delta', text: DEFAULT_ANSWERS.es });
    assertEquals(store.recorded[0].answer?.elusion, true);
    assertEquals(store.recorded[0].rejected, 2);
  },
);

Deno.test(
  'an intervention of the tutor may keep quiet, and does after two bad answers',
  async () => {
    const quiet = JSON.stringify({ ...JSON.parse(GOOD), message: '' });
    const { handle, store } = setup([quiet, 'nope', 'nope again']);

    const first = await (await handle(post({ kind: 'proactive' }))).json();
    assertEquals(first.events, [{ type: 'done', interactionId: null, silent: true }]);
    assertEquals(store.recorded[0].answer, null);

    const second = await (
      await handle(post({ kind: 'proactive', requestId: 'a0000000-0000-4000-8000-000000000002' }))
    ).json();
    assertEquals(second.events, [{ type: 'done', interactionId: null, silent: true }]);
  },
);

Deno.test(
  'a retry of a request already answered gets that answer, without asking the model',
  async () => {
    const { handle, store, llm } = setup();
    store.answers = [
      {
        id: `i-${REQUEST_ID}`,
        attemptId: ATTEMPT_ID,
        hintLevel: 2,
        emotion: 'joy',
        intensity: 1,
        transcript: 'Ya te lo dije: mira el bucle.',
        elusion: true,
        actions: [],
      },
    ];

    const { events } = await (await handle(post())).json();

    assertEquals(events, [
      { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 2, elusion: true },
      { type: 'delta', text: 'Ya te lo dije: mira el bucle.' },
      { type: 'done', interactionId: `i-${REQUEST_ID}`, silent: false },
    ]);
    assertEquals(llm.requests.length, 0);
    assertEquals(store.recorded.length, 0);

    // The id of a request of another attempt is not a way to read its answer
    store.answers = [{ ...store.answers[0], attemptId: 'another' }];
    assertEquals((await handle(post())).status, 400);
  },
);

Deno.test('the same request twice at once gets the answer kept first', async () => {
  const { handle, store } = setup();
  store.outcome = { status: 'duplicate' };
  store.recordAnswer = (answer) => {
    store.answers.push({
      id: `i-${answer.requestId}`,
      attemptId: ATTEMPT_ID,
      hintLevel: 1,
      emotion: 'joy',
      intensity: 3,
      transcript: 'La primera.',
      elusion: false,
      actions: [],
    });
    return Promise.resolve({ status: 'duplicate' });
  };

  const { events } = await (await handle(post())).json();
  assertEquals(events[1], { type: 'delta', text: 'La primera.' });

  store.recordAnswer = () => Promise.resolve({ status: 'duplicate' });
  store.answers = [];
  assertEquals((await handle(post())).status, 500);
});

Deno.test('the tutor needs a session, a valid request and an attempt of the caller', async () => {
  const { handle, store } = setup();

  assertEquals((await handle(post({}, null))).status, 401);
  assertEquals((await handle(post({}, 'token-other'))).status, 401);
  assertEquals((await handle(post({ kind: 'question' }))).status, 400);
  assertEquals((await handle(post({ kind: 'hint', message: 'Hola' }))).status, 400);
  assertEquals((await handle(post({ language: 'fr' }))).status, 400);
  assertEquals((await handle(post({ requestId: 'x' }))).status, 400);
  assertEquals(
    (await handle(post({ kind: 'question', message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }))).status,
    400,
  );
  const notJson = new Request('http://functions.test/tutor', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-hugo' },
    body: '{',
  });
  assertEquals((await handle(notJson)).status, 400);
  assertEquals((await handle(post({ attemptId: crypto.randomUUID() }))).status, 404);

  store.attempt = { ...ATTEMPT, userId: 'lucia' };
  assertEquals((await handle(post())).status, 404);
  store.attempt = { ...ATTEMPT, ownerActive: false };
  assertEquals((await handle(post())).status, 403);
  store.attempt = { ...ATTEMPT, status: 'submitted' };
  assertEquals((await handle(post())).status, 409);
});

Deno.test('the tutor answers its limit per minute with how long to wait', async () => {
  const { handle, store, llm } = setup();
  store.calls = Array.from({ length: TUTOR_CALLS_PER_MINUTE }, () => new Date(NOW - 20_000));

  const response = await handle(post());

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '40');
  assertEquals(llm.requests.length, 0);
});

Deno.test('without a provider, or when it fails, the tutor is unavailable', async () => {
  const unset = setup();
  unset.store.setting = null;
  assertEquals((await unset.handle(post())).status, 503);

  const down = setup([new ProviderError('The model answered 503', 503)]);
  assertEquals((await down.handle(post())).status, 503);
  assertEquals(down.store.recorded.length, 0);

  const broken = setup([new Error('bug')]);
  assertEquals((await broken.handle(post())).status, 500);
});

Deno.test('an attempt submitted or deleted while the model answered keeps nothing', async () => {
  const { handle, store } = setup();
  store.outcome = { status: 'submitted' };
  assertEquals((await handle(post())).status, 409);
  store.outcome = { status: 'not_found' };
  assertEquals((await handle(post())).status, 404);
});

Deno.test('the tutor answers the preflight and only takes POST', async () => {
  const { handle } = setup();
  const options = await handle(new Request('http://functions.test/tutor', { method: 'OPTIONS' }));
  assertEquals(options.status, 204);
  const get = await handle(new Request('http://functions.test/tutor'));
  assertEquals(get.status, 405);
});

Deno.test(
  'the code is tried with the visible examples only, and the model is told what it does',
  async () => {
    const { handle, store, sandbox, llm } = setup();
    store.attempt = {
      ...ATTEMPT,
      exercise: {
        ...ATTEMPT.exercise,
        tests: [
          ...ATTEMPT.exercise.tests,
          { id: 'hidden', input: [[7, -3, 1]], expectedOutput: 5, isHidden: true },
        ],
      },
    };
    sandbox.outcome = {
      outcomes: [{ ok: false, error: 'ReferenceError: PIKACHU is not defined' }],
    };

    await handle(post({ code: 'function suma(v) { PIKACHU }' }));

    assertEquals(sandbox.requests, [
      { code: 'function suma(v) { PIKACHU }', functionName: 'suma', inputs: [[[1, 2, 3]]] },
    ]);
    assertStringIncludes(
      llm.requests[0].at(-1)!.content,
      'suma([1,2,3]) lanza un error: ReferenceError: PIKACHU is not defined (se esperaba 6)',
    );
  },
);

Deno.test('without code there is nothing to try', async () => {
  const { handle, sandbox, llm } = setup();

  await handle(post({ code: '   ' }));

  assertEquals(sandbox.requests.length, 0);
  assertStringIncludes(llm.requests[0].at(-1)!.content, '(no hay código que probar)');
});

// Tools (2.5e)

const QUESTION = { kind: 'question', message: '¿Cuántos me quedan?' };
const ASKS_PROGRESS = JSON.stringify({
  message: 'Voy a mirarlo.',
  emotion: 'joy',
  intensity: 2,
  reaction: 'thinking',
  elusion: false,
  query: { getMyProgress: {} },
});
const PROGRESS = [{ name: 'getMyProgress', arguments: {}, result: { pending: 4 } }];

Deno.test(
  'the model asks for data first: the app gets the queries and nothing is kept',
  async () => {
    const { store, handle } = setup([ASKS_PROGRESS]);
    const response = await handle(post(QUESTION));
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      events: [{ type: 'query', calls: [{ name: 'getMyProgress', arguments: {} }] }],
    });
    assertEquals(store.recorded, []);
  },
);

Deno.test('with the results, the model answers with the data, once', async () => {
  // Asking again for data is not taken: its message is the answer
  const { store, llm, handle } = setup([ASKS_PROGRESS]);
  const response = await handle(post({ ...QUESTION, results: PROGRESS }));
  const { events } = await response.json();
  assertEquals(events[1], { type: 'delta', text: 'Voy a mirarlo.' });
  assertEquals(llm.requests.length, 1);
  const sent = llm.requests[0];
  assertEquals(JSON.parse(sent.at(-2)!.content), { message: '', query: { getMyProgress: {} } });
  assertStringIncludes(sent.at(-1)!.content, '<resultado_consulta>');
  assertStringIncludes(sent.at(-1)!.content, 'getMyProgress: {"pending":4}');
  assertEquals(store.recorded.length, 1);
});

Deno.test('a hint never waits for data', async () => {
  const { store, handle } = setup([ASKS_PROGRESS]);
  const { events } = await (await handle(post())).json();
  assertEquals(events[0].type, 'meta');
  assertEquals(store.recorded.length, 1);
});

Deno.test('results of something that is not a query of the contract are turned down', async () => {
  for (const results of [
    [{ name: 'navigate', arguments: { to: 'settings' }, result: 'ok' }],
    [{ name: 'getMyProgress', arguments: { subject: 3 }, result: {} }],
    [{ name: 'getMyProgress', arguments: {}, result: 'x'.repeat(13_000) }],
    [],
  ]) {
    const { handle } = setup();
    assertEquals((await handle(post({ ...QUESTION, results }))).status, 400);
  }
});

Deno.test('the actions of the answer reach the app and are kept, also for a retry', async () => {
  const withActions = JSON.stringify({
    ...JSON.parse(GOOD),
    actions: { highlightLines: { lines: [{ line: 1, note: 'Mira el valor inicial' }] } },
  });
  const { store, handle } = setup([withActions]);
  const { events } = await (await handle(post())).json();
  const actions = [
    {
      name: 'highlightLines' as const,
      arguments: { lines: [{ line: 1, note: 'Mira el valor inicial' }] },
    },
  ];
  assertEquals(events[0].actions, actions);
  assertEquals(store.recorded[0].answer?.actions, actions);

  store.answers.push({
    id: `i-${REQUEST_ID}`,
    attemptId: ATTEMPT_ID,
    hintLevel: 1,
    emotion: 'joy',
    intensity: 2,
    transcript: 'Mira la línea 1.',
    elusion: false,
    actions,
  });
  const replayed = await (await handle(post())).json();
  assertEquals(replayed.events[0].actions, actions);
});

Deno.test(
  'what touches the code is checked against the attempt before it reaches the app',
  async () => {
    const fixing = (actions: Record<string, unknown>) =>
      JSON.stringify({ ...JSON.parse(GOOD), actions });
    // The code runs: no fix, nor a submission of an attempt that did not pass (2.5f)
    const { store, handle, sandbox } = setup([
      fixing({
        proposeFix: { line: 1, code: 'function suma(v) { return 0;; }' },
        submitAttempt: {},
      }),
      fixing({ proposeFix: { line: 1, code: 'function suma(v) { return 0; }' }, runTests: {} }),
    ]);
    const first = await (await handle(post())).json();
    assertEquals(first.events[0].actions, undefined);
    assertEquals(store.recorded[0].answer?.actions, undefined);

    // The code does not load, and the fix takes the error away in the sandbox
    sandbox.outcome = { outcomes: [], loadError: { kind: 'invalid_code', message: 'SyntaxError' } };
    const loads = { outcomes: [{ ok: true as const, value: 6 }] };
    sandbox.run = (request) => {
      sandbox.requests.push(request);
      return Promise.resolve(request.code.includes('retrun') ? sandbox.outcome : loads);
    };
    const second = await (
      await handle(
        post({ requestId: REQUEST_ID.replace('1', '2'), code: 'function suma(v) { retrun 0; }' }),
      )
    ).json();
    assertEquals(
      second.events[0].actions.map((action: { name: string }) => action.name),
      ['runTests', 'proposeFix'],
    );
  },
);
