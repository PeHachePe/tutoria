/**
 * Examples of the general syntax of JavaScript that the tutor may show (2.5d): a student who asks
 * «¿cómo es la sintaxis del for?» or «ponme un ejemplo de Math.floor» needs to see it, not to hear it
 * in words. The model never writes them: it names the topics (`syntax`) and the server adds these
 * examples, fixed and unrelated to any exercise, so the logic of an exercise cannot slip in. Shared
 * by the Edge Function `tutor` and the scripted tutor, so it must not import anything (D-042).
 */

/** The topics of the catalog, in the order their examples are shown. */
export const SYNTAX_TOPICS = [
  'function',
  'for',
  'for-of',
  'while',
  'if',
  'variable',
  'array',
  'string',
  'math',
  'operators',
] as const;

export type SyntaxTopic = (typeof SYNTAX_TOPICS)[number];

/** An answer shows one or two examples: more would bury the answer. */
export const MAX_SYNTAX_EXAMPLES = 2;

/**
 * One short example of each topic, with what each line gives in a comment. In English, like the code
 * of the exercises (D-045), and never with an accumulator, the usual core of an exercise.
 */
export const SYNTAX_EXAMPLES: Readonly<Record<SyntaxTopic, string>> = {
  function: [
    'function greet(name) {',
    "  return 'Hi ' + name;",
    '}',
    "greet('Ana'); // 'Hi Ana'",
  ].join('\n'),
  for: ['// 0, then 1, then 2', 'for (let i = 0; i < 3; i++) {', '  console.log(i);', '}'].join(
    '\n',
  ),
  'for-of': [
    "const pets = ['cat', 'dog'];",
    "// 'cat', then 'dog'",
    'for (const pet of pets) {',
    '  console.log(pet);',
    '}',
  ].join('\n'),
  while: [
    '// 3, then 2, then 1',
    'let n = 3;',
    'while (n > 0) {',
    '  console.log(n);',
    '  n--;',
    '}',
  ].join('\n'),
  if: [
    'if (age >= 18) {',
    "  console.log('adult');",
    '} else if (age >= 13) {',
    "  console.log('teen');",
    '} else {',
    "  console.log('child');",
    '}',
  ].join('\n'),
  variable: [
    '// let: it can change',
    'let points = 0;',
    'points = 5;',
    '// const: it cannot',
    "const city = 'Lugo';",
  ].join('\n'),
  array: [
    "const abc = ['a', 'b'];",
    "abc[0]; // 'a'",
    'abc.length; // 2',
    "abc.push('c');",
    "// ['a', 'b', 'c']",
  ].join('\n'),
  string: [
    "const word = 'Hello';",
    'word.length; // 5',
    "word[1]; // 'e'",
    'word.toUpperCase();',
    "// 'HELLO'",
    "word.includes('ell');",
    '// true',
  ].join('\n'),
  math: [
    'Math.floor(7.8); // 7',
    'Math.ceil(7.2); // 8',
    'Math.round(7.5); // 8',
    'Math.abs(-4); // 4',
    '(7.456).toFixed(2);',
    "// '7.46'",
  ].join('\n'),
  operators: [
    '7 % 3; // 1 (remainder)',
    '5 === 5; // true',
    "5 !== '5'; // true",
    '3 < 5 && 5 < 9; // true',
    '3 > 5 || 5 < 9; // true',
  ].join('\n'),
};

/**
 * Ways of asking how something is written: «sintaxis», «ejemplo», «¿cómo se escribe…?», «no me
 * acuerdo de cómo…», in the three languages of the interface, in lower case and without accents.
 */
const SYNTAX_QUESTION =
  /sintaxi|syntax|ejemplo|example|exemple|como (?:se )?(?:escribe|pone|usa|hace|declara|recorre|era)|\bcomo es\b|how (?:do|to|does|can) (?:i |you )?(?:write|use|declare|loop)|show me|com (?:s'|es )?(?:escriu|fa|declara|usa)|no (?:me acuerdo|recuerdo|se) (?:de )?como/;

/** What each topic is called in a question, in lower case and without accents. */
const TOPIC_PATTERNS: Readonly<Record<SyntaxTopic, RegExp>> = {
  function: /\bfunci(?:on|o)(?:n?e?s)?\b|\bfunction\b/,
  for: /\b(?:el|del|un|bucle|loop|a|the|de)\s+for\b|\bfor\s+(?:loop|bucle)\b|\bfor\s*\(/,
  'for-of': /\bfor\s*(?:\.\.\.\s*)?of\b|\bfor-of\b/,
  while: /\bwhile\b/,
  if: /\bif\b|\belse\b|\bcondicional/,
  variable: /\bvariables?\b|\blet\b|\bconst\b/,
  array: /\bvector|\barray|\barreglo|\bpush\b/,
  string: /\bcadena|\bstring|\btexto?\b|\bmayuscul|\buppercase|\bcaracter/,
  math: /\bmath\b|\bredonde|\bround\b|\bfloor\b|\bceil\b|\bdecimal/,
  operators: /\bmodulo\b|\bresto\b|\bremainder\b|\boperador|\boperator|%/,
};

/**
 * The topics of the catalog a message asks how to write, in the order of the catalog and no more
 * than an answer shows; none if it is not a question about syntax. The server tells the model, as
 * the cheap model follows what the request says better than the general instruction (D-049).
 */
export function syntaxTopicsIn(message: string | null | undefined): SyntaxTopic[] {
  const text = normalized(message ?? '');
  if (!SYNTAX_QUESTION.test(text)) return [];
  const topics = SYNTAX_TOPICS.filter((topic) => TOPIC_PATTERNS[topic].test(text));
  // «for of» is not the plain «for»
  const plain = topics.includes('for-of') ? topics.filter((topic) => topic !== 'for') : topics;
  return plain.slice(0, MAX_SYNTAX_EXAMPLES);
}

/**
 * The examples of the topics asked for, each in its block, in their order and once; a topic outside
 * the catalog is left out, and nothing is written without any.
 */
export function syntaxBlocks(topics: readonly string[]): string {
  return [...new Set(topics)]
    .filter((topic): topic is SyntaxTopic => (SYNTAX_TOPICS as readonly string[]).includes(topic))
    .slice(0, MAX_SYNTAX_EXAMPLES)
    .map((topic) => ['```js', SYNTAX_EXAMPLES[topic], '```'].join('\n'))
    .join('\n');
}

function normalized(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u00b4`]/g, "'");
}
