import {
  applyEach,
  applyWhen,
  disabled,
  max,
  min,
  pattern,
  required,
  type SchemaPath,
  type FieldTree,
  type SchemaPathTree,
  validate,
  type ValidationError,
} from '@angular/forms/signals';

import {
  AI_PROVIDER_PRESETS,
  type AiModelSetting,
  type AiProviderSetting,
  type AiResponseFormat,
  isValidAiProvider,
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

/** The Edge Functions only take whole milliseconds (`isTimeout`): a field may have decimals. */
function msOf(seconds: number): number {
  return Math.round(seconds * MS_PER_SECOND);
}

/**
 * Whether a fallback calls a model already called before it, the main one included: the Edge
 * Functions leave it out (`providerSettingOf`), and the check says it is `invalid`. A model is its
 * URL and its name: the same name at another provider is another model.
 */
function repeatsEarlier(model: ProviderFormModel, fallback: FallbackFormModel): boolean {
  const keyOf = (baseUrl: string, name: string) => `${baseUrl.trim()} ${name.trim()}`;
  const fallbackKey = (entry: FallbackFormModel) =>
    keyOf(entry.presetId === SAME_PROVIDER ? model.baseUrl : entry.baseUrl, entry.model);
  const index = model.fallbacks.indexOf(fallback);
  const earlier = [
    keyOf(model.baseUrl, model.model),
    ...model.fallbacks.slice(0, index).map(fallbackKey),
  ];
  return earlier.includes(fallbackKey(fallback));
}

function toFallbackSetting(fallback: FallbackFormModel): AiModelSetting {
  const model = fallback.model.trim();
  const timeoutMs = msOf(fallback.timeoutSeconds);
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
    timeoutMs: msOf(model.timeoutSeconds),
    ...(model.fallbacks.length === 0 ? {} : { fallbacks: model.fallbacks.map(toFallbackSetting) }),
  };
}

/** A field of a form, as its errors name it. */
type FocusableField = ValidationError.WithFieldTree['fieldTree'];

/**
 * The field to take the focus to: the first one with an error, which says what is missing there,
 * before the error of the whole form (the shape of the table), which Signal Forms lists first; the
 * form itself if no field has one.
 */
export function fieldToFocus<T>(tree: FieldTree<T>): FocusableField {
  const errors = tree().errorSummary();
  const error = errors.find((candidate) => candidate.fieldTree !== tree) ?? errors[0];
  return error?.fieldTree ?? tree;
}

/**
 * What a model saves, as text: two models that save the same setting have the same key, though they
 * are different objects (picking the same preset again, spaces around the model).
 */
export function settingKey(model: ProviderFormModel): string {
  return JSON.stringify(toProviderSetting(model));
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
    validate(fallback.model, ({ value, valueOf }) =>
      value().trim() !== '' && repeatsEarlier(valueOf(path), valueOf(fallback))
        ? {
            kind: 'repeated',
            message: $localize`:@@providerForm.error.repeated:Ya está antes en la lista`,
          }
        : null,
    );
    applyWhen(fallback, ({ value }) => value().presetId === OTHER_PROVIDER, callRules);
  });
  // The rules above say what is wrong field by field; this one keeps the form from ever allowing
  // what the check of the table (is_valid_ai_provider) would turn down
  validate(path, ({ value }) =>
    isValidAiProvider(toProviderSetting(value()))
      ? null
      : {
          kind: 'provider',
          message: $localize`:@@providerForm.error.provider:Falta algún dato del proveedor`,
        },
  );
}
