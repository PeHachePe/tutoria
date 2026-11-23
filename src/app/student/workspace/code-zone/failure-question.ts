import { formatValue } from '../../../shared/format-value';
import { MAX_QUESTION_LENGTH } from '../tutor/question-limit';

/** How a visible example failed, when «Pregúntale al tutor» can ask about it (6.2d). */
export interface FailingExample {
  readonly state: 'failed' | 'error' | 'timeout';
  /** The call as the student would write it: `sum([1, 2, 3])`. */
  readonly call: string;
  readonly expected: unknown;
  /** What the code returned, for a wrong value. */
  readonly actual?: unknown;
  /** The message of the error it threw. */
  readonly error?: string;
}

/**
 * The question «Pregúntale al tutor» sends for a failing example, with what the student sees in its
 * row: «¿Por qué falla `sum([1, 2, 3])`? Devuelve `5` y se espera `6`.». The call and the values go
 * as the student would write them, in one line and as code, so the chat shows them in monospace.
 * If that does not fit in a question, the short one names the example by its position, from 1: the
 * tutor has the code and the results of the last run.
 */
export function failureQuestion(example: FailingExample, position: number): string {
  const { call } = example;
  const expected = formatValue(example.expected);
  let question: string;
  switch (example.state) {
    case 'failed': {
      const actual = formatValue(example.actual);
      question = $localize`:@@runResults.question.failed:¿Por qué falla \`${call}:call:\`? Devuelve \`${actual}:actual:\` y se espera \`${expected}:expected:\`.`;
      break;
    }
    case 'error': {
      const error = example.error;
      question = $localize`:@@runResults.question.error:¿Por qué falla \`${call}:call:\`? Lanza el error «${error}:error:» y se espera \`${expected}:expected:\`.`;
      break;
    }
    case 'timeout':
      question = $localize`:@@runResults.question.timeout:¿Por qué \`${call}:call:\` no termina a tiempo? Se espera \`${expected}:expected:\`.`;
      break;
  }
  return question.length <= MAX_QUESTION_LENGTH
    ? question
    : $localize`:@@runResults.question.short:¿Por qué falla el ejemplo ${position}:n:?`;
}
