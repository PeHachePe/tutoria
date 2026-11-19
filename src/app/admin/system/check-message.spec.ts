import type { AiCheckProblem } from '../../data/ai-provider-setting';
import { checkMessage } from './check-message';

describe('checkMessage', () => {
  it('says how long a model took to answer', () => {
    expect(checkMessage({ model: 'gemini', ms: 820 })).toBe('Responde en 820 ms');
  });

  it('says why a model did not answer, never with the text of the provider', () => {
    const problems: AiCheckProblem[] = [
      'invalid',
      'host_not_allowed',
      'no_key',
      'unauthorized',
      'not_found',
      'rate_limited',
      'timeout',
      'unavailable',
    ];
    const messages = problems.map((problem) => checkMessage({ model: 'm', problem }));
    expect(new Set(messages).size).toBe(problems.length);
    expect(checkMessage({ model: 'm', problem: 'host_not_allowed' })).toContain('AI_ALLOWED_HOSTS');
    expect(checkMessage({ model: 'm', problem: 'not_found' })).toBe(
      'El proveedor no conoce ese modelo.',
    );
  });
});
