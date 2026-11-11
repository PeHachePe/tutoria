import { assertEquals } from '@std/assert';

import { type AnswerCheck, checkAnswer, containsCode } from './model-answer.ts';

const answer = (fields: Record<string, unknown>) =>
  JSON.stringify({
    message: '¿Qué valor tiene el acumulador antes del bucle?',
    emotion: 'encouragement',
    intensity: 2,
    reaction: 'thinking',
    elusion: false,
    ...fields,
  });

Deno.test('checkAnswer accepts the answer of 2.6, also wrapped in a fenced block', () => {
  const expected: AnswerCheck = {
    ok: true,
    answer: {
      message: '¿Qué valor tiene el acumulador antes del bucle?',
      emotion: 'encouragement',
      intensity: 2,
      reaction: 'thinking',
      elusion: false,
    },
  };
  assertEquals(checkAnswer(answer({}), false), expected);
  assertEquals(checkAnswer('```json\n' + answer({}) + '\n```', false), expected);
});

Deno.test('checkAnswer rejects broken JSON and a wrong shape', () => {
  assertEquals(checkAnswer('{"message": "Hola", ', false), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer('Hola, ¿qué tal?', false), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer(answer({ intensity: 4 }), false), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer(answer({ message: 7 }), false), { ok: false, problem: 'invalid' });
});

Deno.test('checkAnswer rejects an unknown emotion', () => {
  assertEquals(checkAnswer(answer({ emotion: 'anger' }), false), { ok: false, problem: 'invalid' });
});

Deno.test('checkAnswer drops a reaction outside the catalog instead of asking again', () => {
  const check = checkAnswer(answer({ reaction: 'stone' }), false);
  assertEquals(check.ok && check.answer.reaction, undefined);
});

Deno.test('checkAnswer takes a missing elusion as false', () => {
  const check = checkAnswer(answer({ elusion: undefined }), false);
  assertEquals(check.ok && check.answer.elusion, false);
});

Deno.test('checkAnswer only lets an intervention of the tutor keep quiet', () => {
  assertEquals(checkAnswer(answer({ message: '  ' }), false), { ok: false, problem: 'invalid' });
  const quiet = checkAnswer(answer({ message: '  ' }), true);
  assertEquals(quiet.ok && quiet.answer.message, '');
});

Deno.test('checkAnswer rejects a message with code', () => {
  const code = 'Prueba esto:\n```js\nfunction suma(v) { return 0; }\n```';
  assertEquals(checkAnswer(answer({ message: code }), false), {
    ok: false,
    problem: 'code',
    elusion: false,
  });
  // Turned down, it still says whether the student asked for the solution (D-044)
  assertEquals(checkAnswer(answer({ message: code, elusion: true }), false), {
    ok: false,
    problem: 'code',
    elusion: true,
  });
});

Deno.test('containsCode finds fenced blocks and lines that look like code', () => {
  for (const message of [
    '```\nreturn total\n```',
    'Haz esto:\nfor (let i = 0; i < v.length; i++) {',
    'Escribe:\ntotal += v[i];',
    'Así:\nlet total = 0',
    'const doble = (n) => n * 2',
    'function suma(v) {',
    'Cierra la llave:\n}',
    'return total;',
  ]) {
    assertEquals(containsCode(message), true, message);
  }
});

Deno.test('containsCode lets words about the code through', () => {
  for (const message of [
    '¿Qué valor tiene el acumulador antes de empezar el bucle?',
    'Fíjate en la condición del bucle: ¿llega hasta el último elemento?',
    'Si el vector está vacío, ¿qué debería devolver la función? Piensa en el ejemplo con [].',
    'Return the total only after the loop ends: where is your return now?',
    'Para i = 0, ¿qué elemento lees?',
  ]) {
    assertEquals(containsCode(message), false, message);
  }
});
