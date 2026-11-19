import {
  applyEach,
  applyWhen,
  disabled,
  max,
  min,
  pattern,
  required,
  type SchemaPath,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import {
  AI_PROVIDER_PRESETS,
  type AiModelSetting,
  type AiProviderSetting,
  type AiResponseFormat,
  MAX_AI_FALLBACKS,
} from '../../data/ai-provider-setting';

/** The option of the provider select that lets the URL, the secret and the format be written. */
export const OTHER_PROVIDER = 'other';

/** The option of a fallback that is another model of the main provider. */
export const SAME_PROVIDER = 'same';

/** The secret of the key of the main provider when the setting names none (as the Edge Functions). */
export const DEFAULT_KEY_SECRET = 'AI_API_KEY';

/** The format of the answer when the setting says none (as the Edge Functions). */
const DEFAULT_RESPONSE_FORMAT: AiResponseFormat = 'json_schema';

/** The time a model may take when the setting says none, in seconds (as the Edge Functions). */
const DEFAULT_TIMEOUT_SECONDS = 15;

/** The limits of the time a model may take, in seconds (as the Edge Functions). */
export const MIN_TIMEOUT_SECONDS = 1;
export const MAX_TIMEOUT_SECONDS = 120;

const MS_PER_SECOND = 1000;

/** A URL of the web, as the check of `app_setting` asks. */
const WEB_URL = /^https?:\/\/[^/\s]+.*$/;

/** The only secrets a setting may name, or none: `AI_API_KEY`, `AI_GROQ_API_KEY`… */
const KEY_SECRET = /^(?:AI_(?:[A-Z0-9]+_)*API_KEY)?$/;

/** How to call a provider: what a preset fills in. `keySecret` is empty for none. */
interface ProviderCall {
  readonly presetId: string;
  readonly baseUrl: string;
  readonly keySecret: string;
  readonly responseFormat: AiResponseFormat;
}

/** A fallback as the form edits it: of the main provider (`SAME_PROVIDER`) or of another. */
export interface FallbackFormModel extends ProviderCall {
  readonly model: string;
  readonly timeoutSeconds: number;
}

/** The setting of the AI provider as the form edits it (5.3b). */
export interface ProviderFormModel extends ProviderCall {
  readonly model: string;
  readonly timeoutSeconds: number;
  readonly fallbacks: readonly FallbackFormModel[];
}

/** The preset of a URL, or `OTHER_PROVIDER`. */
function presetOf(baseUrl: string): string {
  return AI_PROVIDER_PRESETS.find((preset) => preset.baseUrl === baseUrl)?.id ?? OTHER_PROVIDER;
}

function secondsOf(timeoutMs: number | undefined, fallback: number): number {
  return timeoutMs === undefined ? fallback : timeoutMs / MS_PER_SECOND;
}

/** A new fallback: another model of the main provider, with the time given. */
export function newFallback(timeoutSeconds: number): FallbackFormModel {
  return {
    presetId: SAME_PROVIDER,
    baseUrl: '',
    keySecret: '',
    responseFormat: DEFAULT_RESPONSE_FORMAT,
    model: '',
    timeoutSeconds,
  };
}

function toFallbackFormModel(
  fallback: string | AiModelSetting,
  mainSeconds: number,
): FallbackFormModel {
  if (typeof fallback === 'string') return { ...newFallback(mainSeconds), model: fallback };
  if (fallback.baseUrl === undefined) {
    return {
      ...newFallback(secondsOf(fallback.timeoutMs, mainSeconds)),
      model: fallback.model,
    };
  }
  // Another provider never inherits the key of the main one (D-044)
  return {
    presetId: presetOf(fallback.baseUrl),
    baseUrl: fallback.baseUrl,
    keySecret: fallback.keySecret ?? '',
    responseFormat: fallback.responseFormat ?? DEFAULT_RESPONSE_FORMAT,
    model: fallback.model,
    timeoutSeconds: secondsOf(fallback.timeoutMs, DEFAULT_TIMEOUT_SECONDS),
  };
}

/** The model of a setting; the preset is the one of its URL. */
export function toProviderFormModel(setting: AiProviderSetting): ProviderFormModel {
  const timeoutSeconds = secondsOf(setting.timeoutMs, DEFAULT_TIMEOUT_SECONDS);
  return {
    presetId: presetOf(setting.baseUrl),
    baseUrl: setting.baseUrl,
    model: setting.model,
    keySecret: setting.keySecret === undefined ? DEFAULT_KEY_SECRET : (setting.keySecret ?? ''),
    responseFormat: setting.responseFormat ?? DEFAULT_RESPONSE_FORMAT,
    timeoutSeconds,
    fallbacks: (setting.fallbacks ?? []).map((fallback) =>
      toFallbackFormModel(fallback, timeoutSeconds),
    ),
  };
}

function toFallbackSetting(fallback: FallbackFormModel): AiModelSetting {
  const model = fallback.model.trim();
  const timeoutMs = fallback.timeoutSeconds * MS_PER_SECOND;
  if (fallback.presetId === SAME_PROVIDER) return { model, timeoutMs };
  return {
    baseUrl: fallback.baseUrl.trim(),
    model,
    keySecret: fallback.keySecret.trim() || null,
    responseFormat: fallback.responseFormat,
    timeoutMs,
  };
}

/**
 * What is saved: what the model says, without surrounding spaces. The main key and format by default
 * are left out, as the Edge Functions read them, so a setting comes back as it was.
 */
export function toProviderSetting(model: ProviderFormModel): AiProviderSetting {
  const keySecret = model.keySecret.trim();
  return {
    baseUrl: model.baseUrl.trim(),
    model: model.model.trim(),
    ...(keySecret === DEFAULT_KEY_SECRET ? {} : { keySecret: keySecret || null }),
    ...(model.responseFormat === DEFAULT_RESPONSE_FORMAT
      ? {}
      : { responseFormat: model.responseFormat }),
    timeoutMs: model.timeoutSeconds * MS_PER_SECOND,
    ...(model.fallbacks.length === 0 ? {} : { fallbacks: model.fallbacks.map(toFallbackSetting) }),
  };
}

/**
 * Picks a provider: a preset fills in how to call it; `OTHER_PROVIDER` keeps what there is, to
 * change it from there; `SAME_PROVIDER` (a fallback) clears it, as the main one decides it.
 */
export function applyPreset<T extends ProviderCall>(call: T, presetId: string): T {
  if (presetId === SAME_PROVIDER) {
    return {
      ...call,
      presetId,
      baseUrl: '',
      keySecret: '',
      responseFormat: DEFAULT_RESPONSE_FORMAT,
    };
  }
  const preset = AI_PROVIDER_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) return { ...call, presetId };
  return {
    ...call,
    presetId,
    baseUrl: preset.baseUrl,
    keySecret: preset.keySecret ?? '',
    responseFormat: preset.responseFormat,
  };
}

/** The rules of a model: its name and its time. */
function modelRules(
  path: SchemaPathTree<{ readonly model: string; readonly timeoutSeconds: number }>,
): void {
  required(path.model, { message: $localize`:@@providerForm.error.model:Escribe el modelo` });
  validate(path.model, ({ value }) =>
    value().trim() === '' && value() !== ''
      ? {
          kind: 'required',
          message: $localize`:@@providerForm.error.model:Escribe el modelo`,
        }
      : null,
  );
  timeoutRules(path.timeoutSeconds);
}

function timeoutRules(path: SchemaPath<number>): void {
  const message = $localize`:@@providerForm.error.timeout:Entre ${MIN_TIMEOUT_SECONDS}:min: y ${MAX_TIMEOUT_SECONDS}:max: segundos`;
  validate(path, ({ value }) => (Number.isFinite(value()) ? null : { kind: 'required', message }));
  min(path, MIN_TIMEOUT_SECONDS, { message });
  max(path, MAX_TIMEOUT_SECONDS, { message });
}

/** The rules of how to call a provider written by hand. */
function callRules(path: SchemaPathTree<ProviderCall>): void {
  required(path.baseUrl, {
    message: $localize`:@@providerForm.error.baseUrl:Escribe la URL base del proveedor`,
  });
  pattern(path.baseUrl, WEB_URL, {
    message: $localize`:@@providerForm.error.baseUrlFormat:Escribe una URL que empiece por http:// o https://`,
  });
  pattern(path.keySecret, KEY_SECRET, {
    message: $localize`:@@providerForm.error.keySecret:Como AI_API_KEY o AI_GROQ_API_KEY, o vacío si no lleva clave`,
  });
}

/**
 * The shape `isValidAiProvider()` asks, and what the Edge Functions check when they read it: a URL of
 * the web, a model, a secret `AI_…_API_KEY` or none, 1 to 120 s and `MAX_AI_FALLBACKS` fallbacks at
 * most. The URL, the secret and the format of a preset are not written: only with «Other».
 */
export function providerSchema(path: SchemaPathTree<ProviderFormModel>): void {
  callRules(path);
  modelRules(path);
  for (const field of [path.baseUrl, path.keySecret, path.responseFormat]) {
    disabled(field, ({ valueOf }) => valueOf(path.presetId) !== OTHER_PROVIDER);
  }
  validate(path.fallbacks, ({ value }) =>
    value().length > MAX_AI_FALLBACKS
      ? {
          kind: 'maxFallbacks',
          message: $localize`:@@providerForm.error.fallbacks:Como mucho ${MAX_AI_FALLBACKS}:max: respaldos`,
        }
      : null,
  );
  applyEach(path.fallbacks, (fallback) => {
    modelRules(fallback);
    applyWhen(fallback, ({ value }) => value().presetId === OTHER_PROVIDER, callRules);
  });
}
