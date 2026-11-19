import {
  AI_PROVIDER_PRESETS,
  type AiProviderSetting,
  isValidAiProvider,
  MAX_AI_FALLBACKS,
} from './ai-provider-setting';

const GEMINI: AiProviderSetting = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemini-3.5-flash-lite',
};

describe('isValidAiProvider', () => {
  it('takes the main model alone, and with fallbacks of both kinds', () => {
    expect(isValidAiProvider(GEMINI)).toBe(true);
    expect(
      isValidAiProvider({
        ...GEMINI,
        fallbacks: [
          'gemma-4-31b-it',
          { model: 'gemma' },
          { baseUrl: 'http://ollama:11434/v1', model: 'qwen' },
        ],
      }),
    ).toBe(true);
  });

  it('needs a URL of the web and a model', () => {
    expect(isValidAiProvider({ ...GEMINI, baseUrl: 'file:///etc' })).toBe(false);
    expect(isValidAiProvider({ ...GEMINI, model: '  ' })).toBe(false);
  });

  it('takes up to five fallbacks, each with a URL of the web if it has one', () => {
    const fallbacks = Array.from({ length: MAX_AI_FALLBACKS }, (_, index) => `model-${index}`);
    expect(isValidAiProvider({ ...GEMINI, fallbacks })).toBe(true);
    expect(isValidAiProvider({ ...GEMINI, fallbacks: [...fallbacks, 'one more'] })).toBe(false);
    expect(
      isValidAiProvider({ ...GEMINI, fallbacks: [{ baseUrl: 'ftp://host', model: 'x' }] }),
    ).toBe(false);
  });

  it('has presets that are valid providers, with a secret of the right shape', () => {
    for (const { baseUrl, keySecret } of AI_PROVIDER_PRESETS) {
      expect(isValidAiProvider({ baseUrl, model: 'model' })).toBe(true);
      if (keySecret !== null) expect(keySecret).toMatch(/^AI_(?:[A-Z0-9]+_)*API_KEY$/);
    }
  });
});
