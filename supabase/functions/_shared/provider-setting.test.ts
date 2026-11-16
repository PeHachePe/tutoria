import { assertEquals } from '@std/assert';

import {
  allowedHosts,
  MAX_FALLBACKS,
  type ModelEndpoint,
  providerSettingOf,
} from './provider-setting.ts';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GROQ = 'https://api.groq.com/openai/v1';
const OLLAMA = 'http://host.docker.internal:11434/v1';

/** The setting where Groq and a local model are allowed too, as `AI_ALLOWED_HOSTS` would. */
const settingOf = (value: unknown) =>
  providerSettingOf(value, allowedHosts('api.groq.com, http://host.docker.internal:11434'));

/** A model of Gemini with the default key and the JSON schema. */
const gemini = (model: string): ModelEndpoint => ({
  baseUrl: GEMINI,
  model,
  keySecret: 'AI_API_KEY',
  responseFormat: 'json_schema',
});

Deno.test('the main model needs a base URL and a model, and takes the default key', () => {
  assertEquals(settingOf({ baseUrl: GEMINI, model: 'flash-lite' }), {
    models: [gemini('flash-lite')],
  });
  assertEquals(settingOf({ baseUrl: GEMINI }), null);
  assertEquals(settingOf({ model: 'flash-lite' }), null);
  assertEquals(settingOf(null), null);
  assertEquals(settingOf(['flash-lite']), null);
});

Deno.test('a fallback named alone is another model of the same provider, in order', () => {
  assertEquals(settingOf({ baseUrl: GEMINI, model: 'pro', fallbacks: ['flash', 'flash-lite'] }), {
    models: [gemini('pro'), gemini('flash'), gemini('flash-lite')],
  });
});

Deno.test('a fallback of another provider brings its own URL, secret and format', () => {
  const groq: ModelEndpoint = {
    baseUrl: GROQ,
    model: 'llama',
    keySecret: 'AI_GROQ_API_KEY',
    responseFormat: 'json_object',
  };
  assertEquals(
    settingOf({
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
  assertEquals(settingOf(ollama), { models: [ollama] });
});

Deno.test('a secret outside the AI ones makes the model invalid', () => {
  const stolen = 'SUPABASE_SERVICE_ROLE_KEY';
  assertEquals(settingOf({ baseUrl: GEMINI, model: 'pro', keySecret: stolen }), null);
  assertEquals(
    settingOf({
      baseUrl: GEMINI,
      model: 'pro',
      fallbacks: [{ baseUrl: GROQ, model: 'llama', keySecret: stolen }],
    }),
    { models: [gemini('pro')] },
  );
});

Deno.test('what is not a model, a repeated one or the main one is left out', () => {
  assertEquals(
    settingOf({
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
  assertEquals(settingOf({ baseUrl: GEMINI, model: 'pro', fallbacks: 'flash' }), {
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
  assertEquals(settingOf({ baseUrl: OLLAMA, model: 'qwen', keySecret: null, timeoutMs: 60_000 }), {
    models: [local],
  });
  // Another model of the same provider waits as long; one of another provider, the default
  assertEquals(settingOf({ ...local, fallbacks: ['llama', { baseUrl: GEMINI, model: 'flash' }] }), {
    models: [
      local,
      { ...local, model: 'llama' },
      { baseUrl: GEMINI, model: 'flash', keySecret: null, responseFormat: 'json_schema' },
    ],
  });
  for (const timeoutMs of [0, 500, 1.5e3 + 0.5, 300_000, '60000']) {
    assertEquals(settingOf({ baseUrl: OLLAMA, model: 'qwen', timeoutMs }), null);
  }
});

Deno.test('only the provider of the project is called unless a secret allows more', () => {
  const groq = { baseUrl: GROQ, model: 'llama', keySecret: 'AI_GROQ_API_KEY' };
  // The main model at another host: no provider at all, so its key goes nowhere
  assertEquals(providerSettingOf({ baseUrl: 'https://evil.test/v1', model: 'x' }), null);
  assertEquals(providerSettingOf({ baseUrl: OLLAMA, model: 'qwen' }), null);
  // A fallback at another host is left out, with the secret it named
  assertEquals(
    providerSettingOf({ baseUrl: GEMINI, model: 'flash-lite', fallbacks: [groq, 'flash'] }),
    { models: [gemini('flash-lite'), gemini('flash')] },
  );
  assertEquals(
    providerSettingOf(
      { baseUrl: GEMINI, model: 'flash-lite', fallbacks: [groq] },
      allowedHosts('api.groq.com'),
    )?.models.length,
    2,
  );
});

Deno.test('a host is allowed by its origin: scheme, name and port', () => {
  const mayCall = allowedHosts(' api.groq.com ,http://host.docker.internal:11434,, not a host ');
  for (const url of [GEMINI, GROQ, 'https://api.groq.com:443/v2', OLLAMA]) {
    assertEquals(mayCall(url), true, url);
  }
  for (const url of [
    // Another scheme, port or name, credentials in the URL, or no URL at all
    'http://api.groq.com/openai/v1',
    'https://api.groq.com:8443/v1',
    'https://api.groq.com.evil.test/v1',
    'https://evil.test/api.groq.com',
    'https://user:secret@api.groq.com/v1',
    'https://host.docker.internal:11434/v1',
    'http://host.docker.internal/v1',
    'file:///etc/passwd',
    'http://kong:8000/rest/v1',
    'api.groq.com',
    '',
  ]) {
    assertEquals(mayCall(url), false, url);
  }
});

Deno.test('the fallbacks past the limit are not tried', () => {
  const fallbacks = Array.from({ length: MAX_FALLBACKS + 3 }, (_, index) => `model-${index}`);
  assertEquals(
    providerSettingOf({ baseUrl: GEMINI, model: 'main', fallbacks })?.models.length,
    1 + MAX_FALLBACKS,
  );
});
