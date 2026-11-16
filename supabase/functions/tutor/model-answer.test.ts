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
  const code = 'Prueba esto:\n```js\nfunction sum(v) { return 0; }\n```';
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
    'function sum(v) {',
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

Deno.test('containsCode finds code inside a line of words or written as code in it', () => {
  for (const message of [
    // Written as code in the line
    'Escribe esto dentro de tu función: `let total = 0; for (const n of numbers) total += n; return total` y listo.',
    'Te falta `total += n` dentro del bucle.',
    'Usa `numbers.reduce((a, b) => a + b, 0)`.',
    'Prueba con `for (const n of numbers) {`.',
    'Añade `if (n > 0) return n` al principio.',
    // In words, without a line that starts as code
    'La solución es declarar let total = 0, recorrer con for (const n of numbers) total += n y al final return total.',
    'Recorre con for (let i = 0; i < v.length; i++) y suma cada elemento.',
    'Dentro pon if (v.length === 0) return 0 y sigue.',
    // Line by line, each behind a label
    'Línea 1: function sum(numbers) {',
    'Línea 3: total += n',
    'pon: let t = 0',
  ]) {
    assertEquals(containsCode(message), true, message);
  }
});

Deno.test('containsCode lets names, expressions and formats written as code through', () => {
  for (const message of [
    '¿Qué vale `total` antes del bucle? ¿Y `numbers.length`?',
    'Compara `i < v.length` con `i <= v.length`: ¿cuál llega al último elemento?',
    'Prueba mentalmente `sum([1, 2, 3])`: ¿qué devuelve tu `return`?',
    'Cada parámetro va como `clave=valor`, separados por `&`.',
    'Devuelve un objeto como `{ a: 1 }`, no un texto.',
    '¿Conoces el operador `+=`? Mira qué hace con el acumulador.',
    'Para el caso vacío: ¿qué devuelve tu función si no entra en el bucle?',
    'Remember: for each element (starting at the first one) you add it to the total.',
    'Think about this: if the list is empty (no elements), what should come back?',
  ]) {
    assertEquals(containsCode(message), false, message);
  }
});

const SUM: FunctionSignature = { functionName: 'sum', parameters: 1 };

Deno.test('containsCode lets through only the empty skeleton of the function asked for', () => {
  for (const message of [
    'Empieza así:\n```js\nfunction sum(numbers) {\n}\n```\nDentro irá el recorrido del vector.',
    '```javascript\nfunction sum( items ) {}\n```',
    '```\nfunction sum(v) {\n\n}\n```',
  ]) {
    assertEquals(containsCode(message, SUM), false, message);
  }
  assertEquals(
    containsCode('```js\nfunction media(a, b) {\n}\n```', { functionName: 'media', parameters: 2 }),
    false,
  );
});

Deno.test('containsCode still finds any other code beside or inside the skeleton', () => {
  for (const message of [
    // Something in its body, however little
    '```js\nfunction sum(numbers) {\n  return 0;\n}\n```',
    '```js\nfunction sum(numbers) {\n  // recorre el vector\n}\n```',
    // Another name, another number of parameters, a default value or an arrow function
    '```js\nfunction addUp(numbers) {\n}\n```',
    '```js\nfunction sum(numbers, n) {\n}\n```',
    '```js\nfunction sum() {\n}\n```',
    '```js\nfunction sum(numbers = []) {\n}\n```',
    '```js\nconst sum = (numbers) => {\n};\n```',
    // The skeleton without its block is a line of code, and code beside it is code
    'function sum(numbers) {\n}',
    '```js\nfunction sum(numbers) {\n}\n```\nY luego:\nlet total = 0',
    '```js\nfunction sum(numbers) {\n}\n```\n```js\nreturn total;\n```',
  ]) {
    assertEquals(containsCode(message, SUM), true, message);
  }
  // Without the signature of the exercise, no skeleton is allowed
  assertEquals(containsCode('```js\nfunction sum(numbers) {\n}\n```'), true);
});

Deno.test('checkAnswer accepts the skeleton of the exercise and nothing else', () => {
  const skeleton = 'Así se empieza:\n```js\nfunction sum(numbers) {\n}\n```';
  const check = checkAnswer(answer({ message: skeleton }), { skeleton: SUM });
  assertEquals(check.ok && check.answer.message, skeleton);
  assertEquals(checkAnswer(answer({ message: skeleton })).ok, false);
});

Deno.test('checkAnswer writes the skeleton the model asks for under its message', () => {
  const asked = (fields: Record<string, unknown>, signature = SUM) => {
    const check = checkAnswer(answer({ message: 'Así empieza:', ...fields }), {
      skeleton: signature,
    });
    return check.ok && check.answer.message;
  };
  assertEquals(
    asked({ skeleton: ['numbers'] }),
    'Así empieza:\n```js\nfunction sum(numbers) {\n}\n```',
  );
  // Names that are not plain are replaced, and the number of parameters is the exercise's
  assertEquals(
    asked({ skeleton: ['v = []', 'otro'] }),
    'Así empieza:\n```js\nfunction sum(otro) {\n}\n```',
  );
  assertEquals(
    asked({ skeleton: ['a', 'b'] }, { functionName: 'pow', parameters: undefined }),
    'Así empieza:\n```js\nfunction pow(a, b) {\n}\n```',
  );
  // Not asked, asked without a signature, a wrong shape, or already written: nothing is added
  assertEquals(asked({ skeleton: [] }), 'Así empieza:');
  const check = checkAnswer(answer({ message: 'Hola', skeleton: ['v'] }));
  assertEquals(check.ok && check.answer.message, 'Hola');
  assertEquals(asked({ skeleton: 'numbers' }), 'Así empieza:');
  const written = 'Así:\n```js\nfunction sum(numbers) {\n}\n```';
  assertEquals(asked({ message: written, skeleton: ['numbers'] }), written);
  // A tutor that keeps quiet adds nothing
  const quiet = checkAnswer(answer({ message: '', skeleton: ['v'] }), {
    mayKeepQuiet: true,
    skeleton: SUM,
  });
  assertEquals(quiet.ok && quiet.answer.message, '');
});

Deno.test(
  'the skeleton always has the parameters of the exercise, if it names them (D-057)',
  () => {
    const named = signatureOf({ functionName: 'countWords', parameters: ['text'], tests: [] });
    assertEquals(named, { functionName: 'countWords', parameters: 1, names: ['text'] });
    // Whatever the model suggests, never Spanglish such as countWords(palabra)
    const check = checkAnswer(answer({ message: 'Así empieza:', skeleton: ['palabra'] }), {
      skeleton: named,
    });
    assertEquals(
      check.ok && check.answer.message,
      'Así empieza:\n```js\nfunction countWords(text) {\n}\n```',
    );
    assertEquals(check.ok && check.answer.actions, [
      { name: 'insertSkeleton', arguments: { parameters: ['text'] } },
    ]);
    // A skeleton the model writes itself needs those names too
    assertEquals(containsCode('```js\nfunction countWords(text) {\n}\n```', named), false);
    assertEquals(containsCode('```js\nfunction countWords(palabra) {\n}\n```', named), true);
  },
);

Deno.test('signatureOf takes the number of parameters from the tests', () => {
  assertEquals(signatureOf({ functionName: 'sum', tests: [{ input: [[1]] }] }), SUM);
  assertEquals(signatureOf({ functionName: 'nada', tests: [] }), {
    functionName: 'nada',
    parameters: undefined,
  });
});

Deno.test('checkAnswer writes the examples of syntax of the catalog the model asks for', () => {
  const asked = (fields: Record<string, unknown>) => {
    const check = checkAnswer(answer({ message: 'Así se escribe:', ...fields }), {
      skeleton: SUM,
      examples: true,
    });
    return check.ok && check.answer.message;
  };
  assertEquals(asked({ syntax: ['for'] }), `Así se escribe:\n${syntaxBlocks(['for'])}`);
  // After the skeleton, and only topics of the catalog
  assertEquals(
    asked({ skeleton: ['numbers'], syntax: ['stone', 'math'] }),
    `Así se escribe:\n\`\`\`js\nfunction sum(numbers) {\n}\n\`\`\`\n${syntaxBlocks(['math'])}`,
  );
  assertEquals(asked({ syntax: ['stone'] }), 'Así se escribe:');
  assertEquals(asked({ syntax: 'for' }), 'Así se escribe:');
  // Not in a hint: it is about the student's code
  const hint = checkAnswer(answer({ message: 'Mira la línea 3.', syntax: ['for'] }), {
    skeleton: SUM,
  });
  assertEquals(hint.ok && hint.answer.message, 'Mira la línea 3.');
  // Never as the only thing an intervention says
  const quiet = checkAnswer(answer({ message: '', syntax: ['for'] }), {
    mayKeepQuiet: true,
    skeleton: SUM,
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

// Tools only our tutor has (2.5f)

Deno.test('the skeleton comes with «Insertar», which only the server adds', () => {
  const asked = checkAnswer(answer({ message: 'Así empieza:', skeleton: ['v = []', 'numbers'] }), {
    skeleton: SUM,
  });
  assertEquals(asked.ok && asked.answer.actions, [
    { name: 'insertSkeleton', arguments: { parameters: ['numbers'] } },
  ]);
  // The model cannot ask for it on its own, nor sees it among its tools
  const own = checkAnswer(
    answer({ actions: { insertSkeleton: { parameters: ['x'] }, runTests: {} } }),
    { skeleton: SUM },
  );
  assertEquals(own.ok && own.answer.actions, [{ name: 'runTests', arguments: {} }]);
  const actions = ANSWER_FORMAT.schema.properties as Record<string, { properties: object }>;
  assertEquals('insertSkeleton' in actions.actions.properties, false);
  assertEquals('proposeFix' in actions.actions.properties, true);
  assertEquals(
    ANSWER_FORMAT.tools?.some((tool) => tool.name === 'insertSkeleton'),
    false,
  );
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
