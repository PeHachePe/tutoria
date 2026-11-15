import { assertEquals, assertStringIncludes } from '@std/assert';

import {
  checkTranslation,
  codeSpans,
  correctionMessage,
  keepsCode,
  requestSchema,
  type TranslationRequest,
  translationMessages,
} from './translation.ts';

const REQUEST: TranslationRequest = {
  from: 'es',
  to: 'en',
  texts: {
    title: 'Contar palabras',
    statement:
      'Escribe `countWords(text)`, que devuelve cuántas palabras tiene `text`: `countWords("hola mundo")` devuelve `2`.',
    topics: ['Cadenas', 'bucles'],
  },
  functionName: 'countWords',
  parameters: ['text'],
};

const GOOD = {
  title: 'Count words',
  statement:
    'Write `countWords(text)`, which returns how many words `text` has: `countWords("hola mundo")` returns `2`.',
  topics: ['Strings', 'loops'],
};

Deno.test('a translation that keeps the code holds', () => {
  assertEquals(checkTranslation(REQUEST, JSON.stringify(GOOD)), { ok: true, texts: GOOD });
});

Deno.test('the JSON may come in a block of Markdown, and must be the JSON asked for', () => {
  assertEquals(checkTranslation(REQUEST, `\`\`\`json\n${JSON.stringify(GOOD)}\n\`\`\``).ok, true);
  assertEquals(checkTranslation(REQUEST, 'Here it is: Count words'), {
    ok: false,
    problem: 'invalid',
  });
  assertEquals(checkTranslation(REQUEST, JSON.stringify({ ...GOOD, title: ' ' })), {
    ok: false,
    problem: 'invalid',
  });
});

Deno.test('a translation without one topic for each topic is turned down', () => {
  assertEquals(checkTranslation(REQUEST, JSON.stringify({ ...GOOD, topics: ['Strings'] })), {
    ok: false,
    problem: 'topics',
  });
});

Deno.test('translating the code between backticks is changing the code', () => {
  const translated = {
    ...GOOD,
    statement: GOOD.statement.replace('"hola mundo"', '"hello world"'),
  };

  assertEquals(checkTranslation(REQUEST, JSON.stringify(translated)), {
    ok: false,
    problem: 'code',
  });
  assertEquals(
    keepsCode(REQUEST, { ...GOOD, statement: GOOD.statement.replace('`2`', '2') }),
    false,
  );
});

Deno.test(
  'a name that only an identifier can be is never translated, with or without backticks',
  () => {
    const request = {
      ...REQUEST,
      texts: { ...REQUEST.texts, statement: 'La función countWords cuenta palabras.' },
    };

    assertEquals(
      keepsCode(request, { ...GOOD, statement: 'The function countWords counts words.' }),
      true,
    );
    assertEquals(
      keepsCode(request, { ...GOOD, statement: 'The function contarPalabras counts words.' }),
      false,
    );
  },
);

Deno.test('a name that is also a word may be translated where it is a word', () => {
  const request = {
    ...REQUEST,
    functionName: 'sum',
    parameters: ['values'],
    texts: { ...REQUEST.texts, statement: 'Escribe `sum(values)`: la suma de los valores.' },
  };

  assertEquals(
    keepsCode(request, { ...GOOD, statement: 'Write `sum(values)`: the sum of the values.' }),
    true,
  );
});

Deno.test('the code may appear more often in the translation, never less', () => {
  assertEquals(
    keepsCode(REQUEST, { ...GOOD, statement: `${GOOD.statement} Use \`text.split\`.` }),
    true,
  );
});

Deno.test('codeSpans finds every text between backticks', () => {
  assertEquals(codeSpans('`a` y `"b c"`, sin ` cerrar'), ['`a`', '`"b c"`']);
  assertEquals(codeSpans('nada'), []);
});

Deno.test('the prompt names the languages and the code that never changes', () => {
  const [system, user] = translationMessages(REQUEST);

  assertStringIncludes(system.content, 'from Spanish (from Spain) to English');
  assertStringIncludes(system.content, '`countWords`, `text`');
  assertStringIncludes(user.content, '<texts>');
  assertStringIncludes(user.content, 'Contar palabras');
  // Without names, the prompt does not list any
  const [bare] = translationMessages({ ...REQUEST, functionName: '', parameters: [] });
  assertEquals(bare.content.includes('never change:'), false);
});

Deno.test('each problem has its correction', () => {
  assertStringIncludes(correctionMessage('invalid').content, 'JSON');
  assertStringIncludes(correctionMessage('code').content, 'backticks');
  assertStringIncludes(correctionMessage('topics').content, 'topic');
});

Deno.test('the request needs two different languages and the texts of the original', () => {
  assertEquals(requestSchema.safeParse(REQUEST).success, true);
  assertEquals(requestSchema.safeParse({ ...REQUEST, to: 'es' }).success, false);
  assertEquals(requestSchema.safeParse({ ...REQUEST, to: 'fr' }).success, false);
  assertEquals(
    requestSchema.safeParse({ ...REQUEST, texts: { ...REQUEST.texts, statement: '' } }).success,
    false,
  );
});
