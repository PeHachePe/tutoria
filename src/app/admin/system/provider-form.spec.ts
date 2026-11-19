import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { type AiProviderSetting, MAX_AI_FALLBACKS } from '../../data/ai-provider-setting';
import {
  applyPreset,
  type FallbackFormModel,
  newFallback,
  OTHER_PROVIDER,
  type ProviderFormModel,
  providerSchema,
  SAME_PROVIDER,
  toProviderFormModel,
  toProviderSetting,
} from './provider-form';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GROQ = 'https://api.groq.com/openai/v1';

/** The setting of the seed. */
const SEED: AiProviderSetting = {
  baseUrl: GEMINI,
  model: 'gemini-3.5-flash-lite',
  timeoutMs: 10000,
  fallbacks: [
    { model: 'gemma-4-31b-it', timeoutMs: 30000 },
    { model: 'gemma-4-26b-a4b-it', timeoutMs: 30000 },
  ],
};

const GROQ_FALLBACK = {
  baseUrl: GROQ,
  model: 'llama-3.3-70b-versatile',
  keySecret: 'AI_GROQ_API_KEY',
  responseFormat: 'json_object',
  timeoutMs: 20000,
} as const;

describe('toProviderFormModel', () => {
  it('reads the setting of the seed with its preset', () => {
    expect(toProviderFormModel(SEED)).toEqual({
      presetId: 'gemini',
      baseUrl: GEMINI,
      model: 'gemini-3.5-flash-lite',
      keySecret: 'AI_API_KEY',
      responseFormat: 'json_schema',
      timeoutSeconds: 10,
      fallbacks: [
        { ...newFallback(30), model: 'gemma-4-31b-it' },
        { ...newFallback(30), model: 'gemma-4-26b-a4b-it' },
      ],
    });
  });

  it('is «Other» with a URL of no preset, and keeps a setting without a key', () => {
    const model = toProviderFormModel({
      baseUrl: 'https://llm.centro.es/v1',
      model: 'm',
      keySecret: null,
      responseFormat: 'none',
    });
    expect(model).toMatchObject({
      presetId: OTHER_PROVIDER,
      keySecret: '',
      responseFormat: 'none',
      timeoutSeconds: 15,
    });
  });

  it('opens a fallback saved with only its name with the time of the main model', () => {
    const model = toProviderFormModel({ ...SEED, fallbacks: ['gemma-x', { model: 'gemma-y' }] });
    expect(model.fallbacks).toEqual([
      { ...newFallback(10), model: 'gemma-x' },
      { ...newFallback(10), model: 'gemma-y' },
    ]);
  });

  it('reads a fallback of another provider with its preset, and one without a key', () => {
    const model = toProviderFormModel({
      ...SEED,
      fallbacks: [GROQ_FALLBACK, { baseUrl: 'https://llm.centro.es/v1', model: 'local' }],
    });
    expect(model.fallbacks).toEqual([
      {
        presetId: 'groq',
        baseUrl: GROQ,
        model: 'llama-3.3-70b-versatile',
        keySecret: 'AI_GROQ_API_KEY',
        responseFormat: 'json_object',
        timeoutSeconds: 20,
      },
      {
        presetId: OTHER_PROVIDER,
        baseUrl: 'https://llm.centro.es/v1',
        model: 'local',
        keySecret: '',
        responseFormat: 'json_schema',
        timeoutSeconds: 15,
      },
    ]);
  });
});

describe('toProviderSetting', () => {
  it('gives back the setting of the seed unchanged', () => {
    expect(toProviderSetting(toProviderFormModel(SEED))).toEqual(SEED);
  });

  it('gives back a fallback of another provider in its place', () => {
    const setting = { ...SEED, fallbacks: [SEED.fallbacks![0], GROQ_FALLBACK] };
    expect(toProviderSetting(toProviderFormModel(setting))).toEqual(setting);
  });

  it('saves a fallback opened with only its name as an object', () => {
    const setting = toProviderSetting(toProviderFormModel({ ...SEED, fallbacks: ['gemma-x'] }));
    expect(setting.fallbacks).toEqual([{ model: 'gemma-x', timeoutMs: 10000 }]);
  });

  it('writes the key and the format when they are not those by default, without spaces', () => {
    const model: ProviderFormModel = {
      ...toProviderFormModel(SEED),
      model: '  gemini-x ',
      keySecret: '',
      responseFormat: 'json_object',
      fallbacks: [
        { ...applyPreset(newFallback(15), OTHER_PROVIDER), baseUrl: ' https://a.es/v1 ' },
      ],
    };
    expect(toProviderSetting(model)).toEqual({
      baseUrl: GEMINI,
      model: 'gemini-x',
      keySecret: null,
      responseFormat: 'json_object',
      timeoutMs: 10000,
      fallbacks: [
        {
          baseUrl: 'https://a.es/v1',
          model: '',
          keySecret: null,
          responseFormat: 'json_schema',
          timeoutMs: 15000,
        },
      ],
    });
  });

  it('leaves out the fallbacks when there are none', () => {
    expect(toProviderSetting({ ...toProviderFormModel(SEED), fallbacks: [] })).not.toHaveProperty(
      'fallbacks',
    );
  });
});

describe('applyPreset', () => {
  it('fills in how to call a preset', () => {
    expect(applyPreset(toProviderFormModel(SEED), 'ollama')).toMatchObject({
      presetId: 'ollama',
      baseUrl: 'http://host.docker.internal:11434/v1',
      keySecret: '',
      responseFormat: 'json_schema',
      model: 'gemini-3.5-flash-lite',
    });
  });

  it('keeps what there is with «Other», to change it from there', () => {
    const groq = applyPreset(toProviderFormModel(SEED), 'groq');
    expect(applyPreset(groq, OTHER_PROVIDER)).toEqual({ ...groq, presetId: OTHER_PROVIDER });
  });

  it('turns a fallback back to the main provider', () => {
    const fallback: FallbackFormModel = { ...applyPreset(newFallback(30), 'groq'), model: 'llama' };
    expect(applyPreset(fallback, SAME_PROVIDER)).toEqual({ ...newFallback(30), model: 'llama' });
  });
});

describe('providerSchema', () => {
  function formOf(model: ProviderFormModel) {
    return TestBed.runInInjectionContext(() => form(signal(model), providerSchema));
  }

  function kinds(field: () => { errors: () => readonly { kind: string }[] }): string[] {
    return field()
      .errors()
      .map((error) => error.kind);
  }

  it('takes the setting of the seed', () => {
    expect(formOf(toProviderFormModel(SEED))().valid()).toBe(true);
  });

  it('asks for a URL of the web and a model', () => {
    const tree = formOf({
      ...toProviderFormModel(SEED),
      presetId: OTHER_PROVIDER,
      baseUrl: 'ftp://x',
      model: ' ',
    });
    expect(kinds(tree.baseUrl)).toEqual(['pattern']);
    expect(kinds(tree.model)).toEqual(['required']);
  });

  it('asks for the name of a secret or none, written with «Other»', () => {
    const base = { ...toProviderFormModel(SEED), presetId: OTHER_PROVIDER };
    expect(kinds(formOf({ ...base, keySecret: 'SERVICE_ROLE_KEY' }).keySecret)).toEqual([
      'pattern',
    ]);
    expect(kinds(formOf({ ...base, keySecret: 'AI_MY_2_API_KEY' }).keySecret)).toEqual([]);
    expect(kinds(formOf({ ...base, keySecret: '' }).keySecret)).toEqual([]);
  });

  it('asks for a time of 1 to 120 seconds', () => {
    const base = toProviderFormModel(SEED);
    expect(kinds(formOf({ ...base, timeoutSeconds: 0 }).timeoutSeconds)).toEqual(['min']);
    expect(kinds(formOf({ ...base, timeoutSeconds: 121 }).timeoutSeconds)).toEqual(['max']);
    expect(kinds(formOf({ ...base, timeoutSeconds: Number.NaN }).timeoutSeconds)).toEqual([
      'required',
    ]);
  });

  it('checks each fallback, and the fields of its provider only with «Other»', () => {
    const tree = formOf({
      ...toProviderFormModel(SEED),
      fallbacks: [
        { ...newFallback(200), baseUrl: 'nada' },
        { ...applyPreset(newFallback(30), OTHER_PROVIDER), baseUrl: 'nada', keySecret: 'X' },
      ],
    });
    expect(kinds(tree.fallbacks[0].model)).toEqual(['required']);
    expect(kinds(tree.fallbacks[0].timeoutSeconds)).toEqual(['max']);
    expect(kinds(tree.fallbacks[0].baseUrl)).toEqual([]);
    expect(kinds(tree.fallbacks[1].baseUrl)).toEqual(['pattern']);
    expect(kinds(tree.fallbacks[1].keySecret)).toEqual(['pattern']);
  });

  it(`takes ${MAX_AI_FALLBACKS} fallbacks at most`, () => {
    const fallbacks = Array.from({ length: MAX_AI_FALLBACKS + 1 }, (_, index) => ({
      ...newFallback(30),
      model: `m${index}`,
    }));
    const base = toProviderFormModel(SEED);
    expect(kinds(formOf({ ...base, fallbacks }).fallbacks)).toEqual(['maxFallbacks']);
    expect(kinds(formOf({ ...base, fallbacks: fallbacks.slice(1) }).fallbacks)).toEqual([]);
  });
});
