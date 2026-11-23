import { MAX_QUESTION_LENGTH } from '../tutor/question-limit';
import { failureQuestion } from './failure-question';

describe('failureQuestion', () => {
  it('asks about a wrong value, with both values as the student would write them', () => {
    expect(
      failureQuestion({ state: 'failed', call: 'sum([1, 2, 3])', expected: 6, actual: 5 }, 1),
    ).toBe('¿Por qué falla `sum([1, 2, 3])`? Devuelve `5` y se espera `6`.');
    expect(
      failureQuestion({ state: 'failed', call: 'price(2.5)', expected: '2.50', actual: 2.5 }, 2),
    ).toBe('¿Por qué falla `price(2.5)`? Devuelve `2.5` y se espera `"2.50"`.');
  });

  it('asks about a value that is not there: undefined is written as such', () => {
    expect(
      failureQuestion({ state: 'failed', call: 'sum([])', expected: 0, actual: undefined }, 1),
    ).toBe('¿Por qué falla `sum([])`? Devuelve `undefined` y se espera `0`.');
  });

  it('asks about an error thrown', () => {
    expect(
      failureQuestion(
        { state: 'error', call: 'sum([])', expected: 0, error: 'TypeError: x is undefined' },
        3,
      ),
    ).toBe('¿Por qué falla `sum([])`? Lanza el error «TypeError: x is undefined» y se espera `0`.');
  });

  it('asks about a test out of time', () => {
    expect(failureQuestion({ state: 'timeout', call: 'loop(1)', expected: 1 }, 2)).toBe(
      '¿Por qué `loop(1)` no termina a tiempo? Se espera `1`.',
    );
  });

  it('keeps a text with line breaks in one line, as a quoted string', () => {
    expect(
      failureQuestion(
        {
          state: 'failed',
          call: 'table(2)',
          expected: '2 x 1 = 2\n2 x 2 = 4',
          actual: '2 x 1 = 2',
        },
        1,
      ),
    ).toBe(
      '¿Por qué falla `table(2)`? Devuelve `"2 x 1 = 2"` y se espera `"2 x 1 = 2\\n2 x 2 = 4"`.',
    );
  });

  it('asks the short question when the long one would not fit in a question', () => {
    const long = 'x'.repeat(MAX_QUESTION_LENGTH);

    expect(
      failureQuestion({ state: 'failed', call: 'echo()', expected: long, actual: '' }, 4),
    ).toBe('¿Por qué falla el ejemplo 4?');
    expect(failureQuestion({ state: 'error', call: 'echo()', expected: 1, error: long }, 2)).toBe(
      '¿Por qué falla el ejemplo 2?',
    );
  });

  it('keeps the long question when it fits exactly', () => {
    const question = failureQuestion({ state: 'timeout', call: 'f()', expected: '' }, 1);
    const room = MAX_QUESTION_LENGTH - question.length;
    const fitting = failureQuestion(
      { state: 'timeout', call: 'f()', expected: 'y'.repeat(room) },
      1,
    );

    expect(fitting).toHaveLength(MAX_QUESTION_LENGTH);
    expect(fitting).toContain('y');
  });
});
