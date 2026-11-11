import { assertEquals } from '@std/assert';

import type { ModelEndpoint } from './answer-store.ts';
import { providerSettingOf } from './provider-setting.ts';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GROQ = 'https://api.groq.com/openai/v1';
const OLLAMA = 'http://host.docker.internal:11434/v1';

/** A model of Gemini with the default key and the JSON schema. */
const gemini = (model: string): ModelEndpoint => ({
  baseUrl: GEMINI,
  model,
  keySecret: 'AI_API_KEY',
  responseFormat: 'json_schema',
});

Deno.test('the main model needs a base URL and a model, and takes the default key', () => {
  assertEquals(providerSettingOf({ baseUrl: GEMINI, model: 'flash-lite' }), {
    models: [gemini('flash-lite')],
  });
  assertEquals(providerSettingOf({ baseUrl: GEMINI }), null);
  assertEquals(providerSettingOf({ model: 'flash-lite' }), null);
  assertEquals(providerSettingOf(null), null);
  assertEquals(providerSettingOf(['flash-lite']), null);
});

Deno.test('a fallback named alone is another model of the same provider, in order', () => {
  assertEquals(
    providerSettingOf({ baseUrl: GEMINI, model: 'pro', fallbacks: ['flash', 'flash-lite'] }),
    { models: [gemini('pro'), gemini('flash'), gemini('flash-lite')] },
  );
});

Deno.test('a fallback of another provider brings its own URL, secret and format', () => {
  const groq: ModelEndpoint = {
    baseUrl: GROQ,
    model: 'llama',
    keySecret: 'AI_GROQ_API_KEY',
    responseFormat: 'json_object',
  };
  assertEquals(
    providerSettingOf({
      baseUrl: GEMINI,
      model: 'flash-lite',
      fallbacks: [groq, { baseUrl: OLLAMA, model: 'qwen' }],
    }),
    {
      models: [
        gemini('flash-lite'),
        groq,
        // Never the key of the main provider: it would reach another one
        { baseUrl: OLLAMA, model: 'qwen', keySecret: null, responseFormat: 'json_schema' },
      ],
    },
  );
});

Deno.test('the main model may go without a key or with another format', () => {
  const ollama: ModelEndpoint = {
    baseUrl: OLLAMA,
    model: 'qwen',
    keySecret: null,
    responseFormat: 'none',
  };
  assertEquals(providerSettingOf(ollama), { models: [ollama] });
});

Deno.test('a secret outside the AI ones makes the model invalid', () => {
  const stolen = 'SUPABASE_SERVICE_ROLE_KEY';
  assertEquals(providerSettingOf({ baseUrl: GEMINI, model: 'pro', keySecret: stolen }), null);
  assertEquals(
    providerSettingOf({
      baseUrl: GEMINI,
      model: 'pro',
      fallbacks: [{ baseUrl: GROQ, model: 'llama', keySecret: stolen }],
    }),
    { models: [gemini('pro')] },
  );
});

Deno.test('what is not a model, a repeated one or the main one is left out', () => {
  assertEquals(
    providerSettingOf({
      baseUrl: GEMINI,
      model: 'pro',
      fallbacks: [
        'flash',
        'pro',
        'flash',
        '',
        42,
        { model: 'x', responseFormat: 'xml' },
        'flash-lite',
      ],
    }),
    { models: [gemini('pro'), gemini('flash'), gemini('flash-lite')] },
  );
  assertEquals(providerSettingOf({ baseUrl: GEMINI, model: 'pro', fallbacks: 'flash' }), {
    models: [gemini('pro')],
  });
});

Deno.test('a model may take longer, as a local one may need, within limits', () => {
  const local = {
    baseUrl: OLLAMA,
    model: 'qwen',
    keySecret: null,
    responseFormat: 'json_schema',
    timeoutMs: 60_000,
  } as const;
  assertEquals(
    providerSettingOf({ baseUrl: OLLAMA, model: 'qwen', keySecret: null, timeoutMs: 60_000 }),
    { models: [local] },
  );
  // Another model of the same provider waits as long; one of another provider, the default
  assertEquals(
    providerSettingOf({ ...local, fallbacks: ['llama', { baseUrl: GEMINI, model: 'flash' }] }),
    {
      models: [
        local,
        { ...local, model: 'llama' },
        { baseUrl: GEMINI, model: 'flash', keySecret: null, responseFormat: 'json_schema' },
      ],
    },
  );
  for (const timeoutMs of [0, 500, 1.5e3 + 0.5, 300_000, '60000']) {
    assertEquals(providerSettingOf({ baseUrl: OLLAMA, model: 'qwen', timeoutMs }), null);
  }
});
