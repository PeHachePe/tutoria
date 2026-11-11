import type { ClassSession, Difficulty, Exercise, ExerciseAssignment, Test } from '../../exercise';
import type { ExerciseText } from '../../exercise-text';
import { fixtureId } from './fixture-id';
import { DAM_GROUP_ID, DAW_GROUP_ID, TEACHER_ID } from './users';

const CREATED_AT = '2026-09-28T16:00:00.000Z';

/** The seed is written in Spanish, its source language (D-023, D-045). */
const SOURCE_LOCALE = 'es';

interface ExerciseFixture {
  readonly title: string;
  readonly difficulty: Difficulty;
  /** The contents column of 2.5. */
  readonly topics: readonly string[];
  readonly functionName: string;
  /** Names the function and what it returns as they are, the same in every language. */
  readonly statement: string;
  /**
   * The texts in the other languages of the interface, required so that `npm run check` fails if
   * an exercise of the seed is left without one (D-045).
   */
  readonly translations: Readonly<Record<'en' | 'ca', ExerciseText>>;
  /** Visible tests, the edge case among them: `[input, expectedOutput]`. */
  readonly visible: readonly (readonly [readonly unknown[], unknown])[];
  /**
   * Two hidden tests, after the visible ones: the student only sees whether they passed. One more
   * edge case each, so returning a fixed value cannot pass them by chance.
   */
  readonly hidden: readonly (readonly [readonly unknown[], unknown])[];
}

function timesTable(n: number): string {
  return Array.from({ length: 10 }, (_, i) => `${n} x ${i + 1} = ${n * (i + 1)}`).join('\n');
}

/** The initial set of 2.5, in the order of the table. */
const EXERCISE_FIXTURES: readonly ExerciseFixture[] = [
  {
    title: 'Contar números pares',
    difficulty: 'initial',
    topics: ['Bucles', 'rangos', 'condicionales'],
    functionName: 'countEvens',
    statement:
      'Escribe una función `countEvens` que reciba un número entero `n` y devuelva cuántos números pares hay entre 1 y `n`, ambos incluidos. Si `n` es menor que 2, la función debe devolver 0.',
    translations: {
      en: {
        title: 'Count even numbers',
        topics: ['Loops', 'ranges', 'conditionals'],
        statement:
          'Write a function `countEvens` that takes an integer `n` and returns how many even numbers there are between 1 and `n`, both included. If `n` is less than 2, the function must return 0.',
      },
      ca: {
        title: 'Comptar nombres parells',
        topics: ['Bucles', 'rangs', 'condicionals'],
        statement:
          'Escriu una funció `countEvens` que rebi un nombre enter `n` i retorni quants nombres parells hi ha entre 1 i `n`, tots dos inclosos. Si `n` és més petit que 2, la funció ha de retornar 0.',
      },
    },
    visible: [
      [[10], 5],
      [[7], 3],
      [[1], 0],
    ],
    hidden: [
      [[25], 12],
      [[-4], 0],
    ],
  },
  {
    title: 'Tabla de multiplicar',
    difficulty: 'initial',
    topics: ['Bucles', 'salida formateada'],
    functionName: 'multiplicationTable',
    statement:
      'Escribe una función `multiplicationTable` que reciba un número entero `n` y devuelva su tabla de multiplicar del 1 al 10 como un único texto. Cada línea sigue el formato `n x i = resultado` y las líneas se separan con un salto de línea (`\\n`), sin salto al final. Si `n` es 0, todas las líneas dan 0.',
    translations: {
      en: {
        title: 'Multiplication table',
        topics: ['Loops', 'formatted output'],
        statement:
          'Write a function `multiplicationTable` that takes an integer `n` and returns its multiplication table from 1 to 10 as a single text. Each line follows the format `n x i = result` and the lines are separated by a line break (`\\n`), with no break at the end. If `n` is 0, every line gives 0.',
      },
      ca: {
        title: 'Taula de multiplicar',
        topics: ['Bucles', 'sortida amb format'],
        statement:
          "Escriu una funció `multiplicationTable` que rebi un nombre enter `n` i retorni la seva taula de multiplicar de l'1 al 10 com un únic text. Cada línia segueix el format `n x i = resultat` i les línies se separen amb un salt de línia (`\\n`), sense salt al final. Si `n` és 0, totes les línies donen 0.",
      },
    },
    visible: [
      [[2], timesTable(2)],
      [[7], timesTable(7)],
      [[0], timesTable(0)],
    ],
    hidden: [
      [[-3], timesTable(-3)],
      [[10], timesTable(10)],
    ],
  },
  {
    title: 'Suma de los elementos de un vector',
    difficulty: 'medium',
    topics: ['Vectores', 'acumulador', 'vector vacío'],
    functionName: 'sum',
    statement:
      'Escribe una función `sum` que reciba un vector de números enteros y devuelva la suma de todos sus elementos. Si el vector está vacío, la función debe devolver 0.',
    translations: {
      en: {
        title: 'Sum of the elements of an array',
        topics: ['Arrays', 'accumulator', 'empty array'],
        statement:
          'Write a function `sum` that takes an array of integers and returns the sum of all its elements. If the array is empty, the function must return 0.',
      },
      ca: {
        title: "Suma dels elements d'un vector",
        topics: ['Vectors', 'acumulador', 'vector buit'],
        statement:
          'Escriu una funció `sum` que rebi un vector de nombres enters i retorni la suma de tots els seus elements. Si el vector és buit, la funció ha de retornar 0.',
      },
    },
    visible: [
      [[[1, 2, 3]], 6],
      [[[5]], 5],
      [[[]], 0],
      [[[-2, 2, 10]], 10],
    ],
    hidden: [
      [[[7, -3, 1]], 5],
      [[[-4, -6]], -10],
    ],
  },
  {
    title: 'Máximo de un vector',
    difficulty: 'medium',
    topics: ['Vectores', 'comparación', 'casos límite'],
    functionName: 'maximum',
    statement:
      'Escribe una función `maximum` que reciba un vector de números y devuelva el mayor de sus elementos. Ten en cuenta que todos pueden ser negativos. Si el vector está vacío, la función debe devolver `null`.',
    translations: {
      en: {
        title: 'Maximum of an array',
        topics: ['Arrays', 'comparison', 'edge cases'],
        statement:
          'Write a function `maximum` that takes an array of numbers and returns its largest element. Bear in mind that they can all be negative. If the array is empty, the function must return `null`.',
      },
      ca: {
        title: "Màxim d'un vector",
        topics: ['Vectors', 'comparació', 'casos límit'],
        statement:
          'Escriu una funció `maximum` que rebi un vector de nombres i retorni el més gran dels seus elements. Tingues en compte que tots poden ser negatius. Si el vector és buit, la funció ha de retornar `null`.',
      },
    },
    visible: [
      [[[3, 9, 2]], 9],
      [[[-5, -2, -8]], -2],
      [[[4]], 4],
      [[[]], null],
    ],
    hidden: [
      [[[1, 7, 7, 3]], 7],
      [[[-3, 0, -1]], 0],
    ],
  },
  {
    title: 'Invertir un vector',
    difficulty: 'advanced',
    topics: ['Vectores', 'índices', 'intercambio'],
    functionName: 'reverseArray',
    statement:
      'Escribe una función `reverseArray` que reciba un vector y devuelva un vector nuevo con los mismos elementos en orden inverso. Resuélvelo recorriendo el vector con índices, sin usar `reverse()`. Si el vector está vacío, devuelve un vector vacío.',
    translations: {
      en: {
        title: 'Reverse an array',
        topics: ['Arrays', 'indices', 'swapping'],
        statement:
          'Write a function `reverseArray` that takes an array and returns a new array with the same elements in reverse order. Solve it by going through the array with indices, without using `reverse()`. If the array is empty, return an empty array.',
      },
      ca: {
        title: 'Invertir un vector',
        topics: ['Vectors', 'índexs', 'intercanvi'],
        statement:
          'Escriu una funció `reverseArray` que rebi un vector i retorni un vector nou amb els mateixos elements en ordre invers. Resol-ho recorrent el vector amb índexs, sense fer servir `reverse()`. Si el vector és buit, retorna un vector buit.',
      },
    },
    visible: [
      [[[1, 2, 3]], [3, 2, 1]],
      [[[4, -1, 0, 9]], [9, 0, -1, 4]],
      [[[7]], [7]],
      [[[]], []],
    ],
    hidden: [
      [[[1, 2, 3, 4, 5, 6]], [6, 5, 4, 3, 2, 1]],
      [[[2, 2, 5]], [5, 2, 2]],
    ],
  },
  {
    title: 'Contar vocales en una cadena',
    difficulty: 'extension',
    topics: ['Cadenas', 'recorrido y conteo'],
    functionName: 'countVowels',
    statement:
      'Escribe una función `countVowels` que reciba un texto y devuelva cuántas vocales contiene, sin distinguir mayúsculas de minúsculas. Las vocales con tilde (á, é, í, ó, ú) también cuentan. Si el texto está vacío, la función debe devolver 0.',
    translations: {
      en: {
        title: 'Count the vowels in a string',
        topics: ['Strings', 'traversal and counting'],
        statement:
          'Write a function `countVowels` that takes a text and returns how many vowels it contains, ignoring case. Vowels with an accent (á, é, í, ó, ú) count too. If the text is empty, the function must return 0.',
      },
      ca: {
        title: 'Comptar vocals en una cadena',
        topics: ['Cadenes', 'recorregut i recompte'],
        statement:
          'Escriu una funció `countVowels` que rebi un text i retorni quantes vocals conté, sense distingir majúscules de minúscules. Les vocals amb accent agut (á, é, í, ó, ú) també compten. Si el text és buit, la funció ha de retornar 0.',
      },
    },
    visible: [
      [['hola'], 2],
      [['PROGRAMAR'], 3],
      [['Canción'], 3],
      [[''], 0],
    ],
    hidden: [
      [['Murciélago'], 5],
      [['Él y ÚLTIMO'], 4],
    ],
  },
  {
    title: 'Media de un vector con dos decimales',
    difficulty: 'extension',
    topics: ['Acumuladores', 'formato de salida'],
    functionName: 'average',
    statement:
      'Escribe una función `average` que reciba un vector de números y devuelva su media como texto con exactamente dos decimales, por ejemplo `"2.50"`. Si el vector está vacío, la función debe devolver `"0.00"`.',
    translations: {
      en: {
        title: 'Average of an array with two decimals',
        topics: ['Accumulators', 'output format'],
        statement:
          'Write a function `average` that takes an array of numbers and returns its average as a text with exactly two decimals, for example `"2.50"`. If the array is empty, the function must return `"0.00"`.',
      },
      ca: {
        title: "Mitjana d'un vector amb dos decimals",
        topics: ['Acumuladors', 'format de sortida'],
        statement:
          'Escriu una funció `average` que rebi un vector de nombres i retorni la seva mitjana com a text amb exactament dos decimals, per exemple `"2.50"`. Si el vector és buit, la funció ha de retornar `"0.00"`.',
      },
    },
    visible: [
      [[[1, 2, 3, 4]], '2.50'],
      [[[5]], '5.00'],
      [[[1, 2]], '1.50'],
      [[[]], '0.00'],
    ],
    hidden: [
      [[[1, 1, 2]], '1.33'],
      [[[2, 3, 3]], '2.67'],
    ],
  },
  {
    title: 'Buscar la primera aparición de un valor',
    difficulty: 'extension',
    topics: ['Búsqueda secuencial', 'condición compuesta'],
    functionName: 'firstIndexOf',
    statement:
      'Escribe una función `firstIndexOf` que reciba un vector y un valor, y devuelva la posición de la primera vez que aparece ese valor, contando desde 0. Si el valor aparece varias veces, cuenta solo la primera. Si no aparece, la función debe devolver -1.',
    translations: {
      en: {
        title: 'Find the first occurrence of a value',
        topics: ['Sequential search', 'compound condition'],
        statement:
          'Write a function `firstIndexOf` that takes an array and a value, and returns the position of the first time that value appears, counting from 0. If the value appears several times, only the first one counts. If it does not appear, the function must return -1.',
      },
      ca: {
        title: "Buscar la primera aparició d'un valor",
        topics: ['Cerca seqüencial', 'condició composta'],
        statement:
          'Escriu una funció `firstIndexOf` que rebi un vector i un valor, i retorni la posició de la primera vegada que hi apareix aquest valor, comptant des de 0. Si el valor apareix diverses vegades, només compta la primera. Si no hi apareix, la funció ha de retornar -1.',
      },
    },
    visible: [
      [[[4, 8, 15], 8], 1],
      [[[4, 8, 8], 8], 1],
      [[[1, 2, 3], 9], -1],
      [[[], 5], -1],
    ],
    hidden: [
      [[[5, 3, 5], 5], 0],
      [[[1, 2, 3], 3], 2],
    ],
  },
];

/** Id of exercise `n` (1 to 8) of the table in 2.5. */
export function exerciseId(n: number): string {
  return fixtureId('exercise', n);
}

/** Id of the test at `position` (0-based) of exercise `n`. */
export function testId(n: number, position: number): string {
  return fixtureId('test', n * 10 + position + 1);
}

export const EXERCISES: readonly Exercise[] = EXERCISE_FIXTURES.map((fixture, index) => ({
  id: exerciseId(index + 1),
  title: fixture.title,
  statement: fixture.statement,
  difficulty: fixture.difficulty,
  topics: fixture.topics,
  sourceLocale: SOURCE_LOCALE,
  translations: fixture.translations,
  language: 'javascript',
  functionName: fixture.functionName,
  maxRepeatedFailures: 3,
  maxIdleMinutes: 4,
  createdBy: TEACHER_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}));

export const TESTS: readonly Test[] = EXERCISE_FIXTURES.flatMap((fixture, index) =>
  [...fixture.visible, ...fixture.hidden].map(([input, expectedOutput], position) => ({
    id: testId(index + 1, position),
    exerciseId: exerciseId(index + 1),
    input,
    expectedOutput,
    isHidden: position >= fixture.visible.length,
    position,
  })),
);

/** Session of each exercise (1 to 8) in 1.º DAW A, as in 2.5. */
export const DAW_SESSIONS: readonly number[] = [1, 1, 2, 2, 3, 4, 4, 4];
/** 1.º DAM B has only reached session 2, with the first four exercises. */
export const DAM_SESSIONS: readonly number[] = [1, 1, 2, 2];

/** Titles of the sessions of each group: one is left without a title to show the fallback. */
const SESSION_TITLES: readonly (readonly [groupId: string, titles: readonly (string | null)[]])[] =
  [
    [
      DAW_GROUP_ID,
      ['Bucles y condicionales', 'Vectores', 'Recorridos de vectores', 'Cadenas y formato'],
    ],
    [DAM_GROUP_ID, ['Primeros bucles', null]],
  ];

export const CLASS_SESSIONS: readonly ClassSession[] = SESSION_TITLES.flatMap(([groupId, titles]) =>
  titles.map((title, index) => ({ groupId, number: index + 1, title })),
).map((session, index) => ({ id: fixtureId('session', index + 1), ...session }));

export function assignmentId(groupId: string, exerciseNumber: number): string {
  return fixtureId('assignment', (groupId === DAW_GROUP_ID ? 0 : 100) + exerciseNumber);
}

export const ASSIGNMENTS: readonly ExerciseAssignment[] = [
  ...DAW_SESSIONS.map((session, index) => ({ groupId: DAW_GROUP_ID, n: index + 1, session })),
  ...DAM_SESSIONS.map((session, index) => ({ groupId: DAM_GROUP_ID, n: index + 1, session })),
].map(({ groupId, n, session }) => ({
  id: assignmentId(groupId, n),
  groupId,
  exerciseId: exerciseId(n),
  session,
}));
