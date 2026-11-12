import { assertEquals } from '@std/assert';

import {
  ANSWER_FORMAT,
  type AnswerCheck,
  checkAnswer,
  containsCode,
  queriesIn,
  type FunctionSignature,
  signatureOf,
} from './model-answer.ts';
import { syntaxBlocks } from '../../../src/app/data/tutor/syntax-examples.ts';

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
  assertEquals(checkAnswer(answer({})), expected);
  assertEquals(checkAnswer('```json\n' + answer({}) + '\n```'), expected);
});

Deno.test('checkAnswer rejects broken JSON and a wrong shape', () => {
  assertEquals(checkAnswer('{"message": "Hola", '), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer('Hola, ¿qué tal?'), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer(answer({ intensity: 4 })), { ok: false, problem: 'invalid' });
  assertEquals(checkAnswer(answer({ message: 7 })), { ok: false, problem: 'invalid' });
});

Deno.test('checkAnswer rejects an unknown emotion', () => {
  assertEquals(checkAnswer(answer({ emotion: 'anger' })), { ok: false, problem: 'invalid' });
});

Deno.test('checkAnswer drops a reaction outside the catalog instead of asking again', () => {
  const check = checkAnswer(answer({ reaction: 'stone' }));
  assertEquals(check.ok && check.answer.reaction, undefined);
});

Deno.test('checkAnswer takes a missing elusion as false', () => {
  const check = checkAnswer(answer({ elusion: undefined }));
  assertEquals(check.ok && check.answer.elusion, false);
});

Deno.test('checkAnswer only lets an intervention of the tutor keep quiet', () => {
  assertEquals(checkAnswer(answer({ message: '  ' })), { ok: false, problem: 'invalid' });
  const quiet = checkAnswer(answer({ message: '  ' }), { mayKeepQuiet: true });
  assertEquals(quiet.ok && quiet.answer.message, '');
});

Deno.test('checkAnswer rejects a message with code', () => {
  const code = 'Prueba esto:\n```js\nfunction suma(v) { return 0; }\n```';
  assertEquals(checkAnswer(answer({ message: code })), {
    ok: false,
    problem: 'code',
    elusion: false,
  });
  // Turned down, it still says whether the student asked for the solution (D-044)
  assertEquals(checkAnswer(answer({ message: code, elusion: true })), {
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

const SUMA: FunctionSignature = { functionName: 'suma', parameters: 1 };

Deno.test('containsCode lets through only the empty skeleton of the function asked for', () => {
  for (const message of [
    'Empieza así:\n```js\nfunction suma(vector) {\n}\n```\nDentro irá el recorrido del vector.',
    '```javascript\nfunction suma( numeros ) {}\n```',
    '```\nfunction suma(v) {\n\n}\n```',
  ]) {
    assertEquals(containsCode(message, SUMA), false, message);
  }
  assertEquals(
    containsCode('```js\nfunction media(a, b) {\n}\n```', { functionName: 'media', parameters: 2 }),
    false,
  );
});

Deno.test('containsCode still finds any other code beside or inside the skeleton', () => {
  for (const message of [
    // Something in its body, however little
    '```js\nfunction suma(vector) {\n  return 0;\n}\n```',
    '```js\nfunction suma(vector) {\n  // recorre el vector\n}\n```',
    // Another name, another number of parameters, a default value or an arrow function
    '```js\nfunction sumar(vector) {\n}\n```',
    '```js\nfunction suma(vector, n) {\n}\n```',
    '```js\nfunction suma() {\n}\n```',
    '```js\nfunction suma(vector = []) {\n}\n```',
    '```js\nconst suma = (vector) => {\n};\n```',
    // The skeleton without its block is a line of code, and code beside it is code
    'function suma(vector) {\n}',
    '```js\nfunction suma(vector) {\n}\n```\nY luego:\nlet total = 0',
    '```js\nfunction suma(vector) {\n}\n```\n```js\nreturn total;\n```',
  ]) {
    assertEquals(containsCode(message, SUMA), true, message);
  }
  // Without the signature of the exercise, no skeleton is allowed
  assertEquals(containsCode('```js\nfunction suma(vector) {\n}\n```'), true);
});

Deno.test('checkAnswer accepts the skeleton of the exercise and nothing else', () => {
  const skeleton = 'Así se empieza:\n```js\nfunction suma(vector) {\n}\n```';
  const check = checkAnswer(answer({ message: skeleton }), { skeleton: SUMA });
  assertEquals(check.ok && check.answer.message, skeleton);
  assertEquals(checkAnswer(answer({ message: skeleton })).ok, false);
});

Deno.test('checkAnswer writes the skeleton the model asks for under its message', () => {
  const asked = (fields: Record<string, unknown>, signature = SUMA) => {
    const check = checkAnswer(answer({ message: 'Así empieza:', ...fields }), {
      skeleton: signature,
    });
    return check.ok && check.answer.message;
  };
  assertEquals(
    asked({ skeleton: ['vector'] }),
    'Así empieza:\n```js\nfunction suma(vector) {\n}\n```',
  );
  // Names that are not plain are replaced, and the number of parameters is the exercise's
  assertEquals(
    asked({ skeleton: ['v = []', 'otro'] }),
    'Así empieza:\n```js\nfunction suma(otro) {\n}\n```',
  );
  assertEquals(
    asked({ skeleton: ['a', 'b'] }, { functionName: 'pow', parameters: undefined }),
    'Así empieza:\n```js\nfunction pow(a, b) {\n}\n```',
  );
  // Not asked, asked without a signature, a wrong shape, or already written: nothing is added
  assertEquals(asked({ skeleton: [] }), 'Así empieza:');
  const check = checkAnswer(answer({ message: 'Hola', skeleton: ['v'] }));
  assertEquals(check.ok && check.answer.message, 'Hola');
  assertEquals(asked({ skeleton: 'vector' }), 'Así empieza:');
  const written = 'Así:\n```js\nfunction suma(vector) {\n}\n```';
  assertEquals(asked({ message: written, skeleton: ['vector'] }), written);
  // A tutor that keeps quiet adds nothing
  const quiet = checkAnswer(answer({ message: '', skeleton: ['v'] }), {
    mayKeepQuiet: true,
    skeleton: SUMA,
  });
  assertEquals(quiet.ok && quiet.answer.message, '');
});

Deno.test('signatureOf takes the number of parameters from the tests', () => {
  assertEquals(signatureOf({ functionName: 'suma', tests: [{ input: [[1]] }] }), SUMA);
  assertEquals(signatureOf({ functionName: 'nada', tests: [] }), {
    functionName: 'nada',
    parameters: undefined,
  });
});

Deno.test('checkAnswer writes the examples of syntax of the catalog the model asks for', () => {
  const asked = (fields: Record<string, unknown>) => {
    const check = checkAnswer(answer({ message: 'Así se escribe:', ...fields }), {
      skeleton: SUMA,
      examples: true,
    });
    return check.ok && check.answer.message;
  };
  assertEquals(asked({ syntax: ['for'] }), `Así se escribe:\n${syntaxBlocks(['for'])}`);
  // After the skeleton, and only topics of the catalog
  assertEquals(
    asked({ skeleton: ['vector'], syntax: ['stone', 'math'] }),
    `Así se escribe:\n\`\`\`js\nfunction suma(vector) {\n}\n\`\`\`\n${syntaxBlocks(['math'])}`,
  );
  assertEquals(asked({ syntax: ['stone'] }), 'Así se escribe:');
  assertEquals(asked({ syntax: 'for' }), 'Así se escribe:');
  // Not in a hint: it is about the student's code
  const hint = checkAnswer(answer({ message: 'Mira la línea 3.', syntax: ['for'] }), {
    skeleton: SUMA,
  });
  assertEquals(hint.ok && hint.answer.message, 'Mira la línea 3.');
  // Never as the only thing an intervention says
  const quiet = checkAnswer(answer({ message: '', syntax: ['for'] }), {
    mayKeepQuiet: true,
    skeleton: SUMA,
    examples: true,
  });
  assertEquals(quiet.ok && quiet.answer.message, '');
});

// Tools (2.5e)

Deno.test('the actions of the contract are kept, checked', () => {
  const check = checkAnswer(
    answer({
      actions: {
        highlightLines: { lines: [{ line: 3, note: 'Revisa la condición' }] },
        writeCode: { code: 'return 1;' },
        navigate: { to: 'admin' },
      },
    }),
  );
  assertEquals(check.ok && check.answer.actions, [
    { name: 'highlightLines', arguments: { lines: [{ line: 3, note: 'Revisa la condición' }] } },
  ]);
});

Deno.test('a mark with code in its note is dropped, never shown', () => {
  const check = checkAnswer(
    answer({ actions: { highlightLines: { lines: [{ line: 3, note: 'return total;' }] } } }),
  );
  assertEquals(check.ok && check.answer.actions, undefined);
});

Deno.test('an answer without actions, or an intervention kept quiet, does nothing', () => {
  const plain = checkAnswer(answer({}));
  assertEquals(plain.ok && 'actions' in plain.answer, false);
  const quiet = checkAnswer(
    answer({ message: '', actions: { pointAt: { target: 'hiddenTests' } } }),
    {
      mayKeepQuiet: true,
    },
  );
  assertEquals(quiet.ok && quiet.answer.actions, undefined);
});

Deno.test('the queries the model asks for, only those of the contract', () => {
  assertEquals(queriesIn(answer({ query: { getMyProgress: {}, navigate: { to: 'data' } } })), [
    { name: 'getMyProgress', arguments: {} },
  ]);
  assertEquals(queriesIn(answer({})), []);
  assertEquals(queriesIn('not json'), []);
  assertEquals(queriesIn('null'), []);
});

Deno.test('the format asks for the queries and the actions by name, without minProperties', () => {
  const properties = ANSWER_FORMAT.schema.properties as Record<string, { properties: object }>;
  assertEquals(Object.keys(properties.query.properties), [
    'getMyProgress',
    'searchExercises',
    'getExerciseStats',
    'getSettings',
  ]);
  assertEquals(Object.keys(properties.actions.properties).includes('highlightLines'), true);
  assertEquals(JSON.stringify(ANSWER_FORMAT.schema).includes('minProperties'), false);
});
