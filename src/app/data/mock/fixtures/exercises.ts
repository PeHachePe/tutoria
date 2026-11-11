import type { ClassBlock, Exercise, ExerciseAssignment, Test } from '../../exercise';
import type { ExerciseSubject } from '../../subject';
import { ADVANCED_EXERCISE_FIXTURES } from './advanced-exercises';
import { BASIC_EXERCISE_FIXTURES } from './basic-exercises';
import type { ExerciseFixture, SampleCode } from './exercise-fixture';
import { fixtureId } from './fixture-id';
import { WEB_EXERCISE_FIXTURES } from './web-exercises';
import { ADVANCED_PROGRAMMING_ID, BASIC_PROGRAMMING_ID, WEB_CLIENT_ID } from './subjects';
import {
  DAM_ADVANCED_GROUP_ID,
  DAM_GROUP_ID,
  DAW_GROUP_ID,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from './users';

const CREATED_AT = '2026-09-28T16:00:00.000Z';

/** The seed is written in Spanish, its source language (D-023, D-045). */
const SOURCE_LOCALE = 'es';

function timesTable(n: number): string {
  return Array.from({ length: 10 }, (_, i) => `${n} x ${i + 1} = ${n * (i + 1)}`).join('\n');
}

/** The initial set of 2.5, in the order of the table, and two of web development on the client (2.5c). */
const BASE_EXERCISE_FIXTURES: readonly ExerciseFixture[] = [
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
  {
    title: 'Validar un correo electrónico',
    difficulty: 'initial',
    topics: ['Cadenas', 'validación de formularios'],
    functionName: 'isValidEmail',
    statement:
      'Escribe una función `isValidEmail` que reciba un texto y devuelva `true` si parece una dirección de correo válida y `false` si no. Para este ejercicio, es válida si no tiene espacios, tiene exactamente una `@` con al menos un carácter antes y, después de la `@`, un dominio con un punto que no esté ni al principio ni al final.',
    translations: {
      en: {
        title: 'Validate an email address',
        topics: ['Strings', 'form validation'],
        statement:
          'Write a function `isValidEmail` that takes a text and returns `true` if it looks like a valid email address and `false` if not. For this exercise, it is valid if it has no spaces, has exactly one `@` with at least one character before it and, after the `@`, a domain with a dot that is neither at its start nor at its end.',
      },
      ca: {
        title: 'Validar un correu electrònic',
        topics: ['Cadenes', 'validació de formularis'],
        statement:
          'Escriu una funció `isValidEmail` que rebi un text i retorni `true` si sembla una adreça de correu vàlida i `false` si no. Per a aquest exercici, és vàlida si no té espais, té exactament una `@` amb almenys un caràcter abans i, després de la `@`, un domini amb un punt que no sigui ni al principi ni al final.',
      },
    },
    visible: [
      [['ana@example.com'], true],
      [['ana.example.com'], false],
      [['ana@@example.com'], false],
      [['ana@example'], false],
    ],
    hidden: [
      [['@example.com'], false],
      [['ana lopez@example.com'], false],
    ],
  },
  {
    title: 'Construir una cadena de consulta',
    difficulty: 'medium',
    topics: ['Objetos', 'URL'],
    functionName: 'toQueryString',
    statement:
      'Escribe una función `toQueryString` que reciba un objeto con los parámetros de una búsqueda y devuelva la cadena de consulta de una URL, sin el `?` del principio: cada parámetro como `clave=valor`, en el orden del objeto y separados por `&`. Codifica claves y valores con `encodeURIComponent`, de modo que un espacio sea `%20`. Con un objeto vacío, devuelve una cadena vacía.',
    translations: {
      en: {
        title: 'Build a query string',
        topics: ['Objects', 'URL'],
        statement:
          'Write a function `toQueryString` that takes an object with the parameters of a search and returns the query string of a URL, without the leading `?`: each parameter as `key=value`, in the order of the object and separated by `&`. Encode keys and values with `encodeURIComponent`, so that a space becomes `%20`. With an empty object, return an empty string.',
      },
      ca: {
        title: 'Construir una cadena de consulta',
        topics: ['Objectes', 'URL'],
        statement:
          "Escriu una funció `toQueryString` que rebi un objecte amb els paràmetres d'una cerca i retorni la cadena de consulta d'una URL, sense el `?` del principi: cada paràmetre com a `clau=valor`, en l'ordre de l'objecte i separats per `&`. Codifica claus i valors amb `encodeURIComponent`, de manera que un espai sigui `%20`. Amb un objecte buit, retorna una cadena buida.",
      },
    },
    // The database keeps objects as jsonb, which sorts their keys (shorter first): the keys of
    // every test are already in that order, so the expected text does not depend on it.
    visible: [
      [[{ q: 'gatos', page: 2 }], 'q=gatos&page=2'],
      [[{ q: 'hola mundo' }], 'q=hola%20mundo'],
      [[{}], ''],
    ],
    hidden: [
      [[{ a: '1&2' }], 'a=1%262'],
      [[{ año: 2026 }], 'a%C3%B1o=2026'],
    ],
  },
];

/**
 * Every exercise of the seed, numbered from 1 in this order: 1 to 10 above, 11 to 17 of basic
 * programming, 18 to 30 of web development on the client and 31 to 42 of advanced programming
 * (2.5c), at least 15 per subject.
 */
const EXERCISE_FIXTURES: readonly ExerciseFixture[] = [
  ...BASE_EXERCISE_FIXTURES,
  ...BASIC_EXERCISE_FIXTURES,
  ...WEB_EXERCISE_FIXTURES,
  ...ADVANCED_EXERCISE_FIXTURES,
];

/** Sample code of the exercises from 11 on, by number: those up to 10 are in activity.ts. */
export const MORE_SAMPLE_CODE: Readonly<Record<number, SampleCode>> = Object.fromEntries(
  [...BASIC_EXERCISE_FIXTURES, ...WEB_EXERCISE_FIXTURES, ...ADVANCED_EXERCISE_FIXTURES].map(
    (fixture, index) => [BASE_EXERCISE_FIXTURES.length + index + 1, fixture.code],
  ),
);

/** Id of exercise `n` (1 to 42), in the order of EXERCISE_FIXTURES. */
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

/** From `first` to `last`, both included. */
function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** The exercises of each subject, 15 each: 6 to 8 serve both programming subjects. */
const SUBJECT_EXERCISES: readonly (readonly [subjectId: string, exercises: readonly number[]])[] = [
  [BASIC_PROGRAMMING_ID, [...range(1, 8), ...range(11, 17)]],
  [WEB_CLIENT_ID, [9, 10, ...range(18, 30)]],
  [ADVANCED_PROGRAMMING_ID, [6, 7, 8, ...range(31, 42)]],
];

export const EXERCISE_SUBJECTS: readonly ExerciseSubject[] = SUBJECT_EXERCISES.flatMap(
  ([subjectId, numbers]) => numbers.map((n) => ({ exerciseId: exerciseId(n), subjectId })),
);

/** Block of each exercise (1 to 8) in 1.º DAW A, as the sessions of 2.5. */
export const DAW_BLOCKS: readonly number[] = [1, 1, 2, 2, 3, 4, 4, 4];
/** 1.º DAM B has only reached its second block, with the first four exercises. */
export const DAM_BLOCKS: readonly number[] = [1, 1, 2, 2];

interface BlockFixture {
  readonly groupId: string;
  /** Order of the block in its group, from 1. */
  readonly position: number;
  readonly title: string;
  /** Required, as those of the exercises (D-045). */
  readonly translations: Readonly<Record<'en' | 'ca', { readonly title: string }>>;
  /** Exercises (1 to 10) of the block, in order. */
  readonly exercises: readonly number[];
  /** Exercises of the block the teacher has not shown yet. */
  readonly hiddenExercises?: readonly number[];
  readonly isHidden?: boolean;
}

function titles(en: string, ca: string): BlockFixture['translations'] {
  return { en: { title: en }, ca: { title: ca } };
}

/**
 * The blocks of each group, in order. 1.º DAW A has its four topics, the resit of topic 2 (the same
 * exercises again, with attempts of their own, and one more it has not shown yet) and a final review
 * it is still preparing, hidden. The same class has a second subject, with blocks of its own.
 */
const BLOCK_FIXTURES: readonly BlockFixture[] = [
  {
    groupId: DAW_GROUP_ID,
    position: 1,
    title: 'Tema 1: Bucles y condicionales',
    translations: titles('Topic 1: Loops and conditionals', 'Tema 1: Bucles i condicionals'),
    exercises: [1, 2],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 2,
    title: 'Tema 2: Vectores',
    translations: titles('Topic 2: Arrays', 'Tema 2: Vectors'),
    exercises: [3, 4],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 3,
    title: 'Tema 3: Recorridos de vectores',
    translations: titles('Topic 3: Traversing arrays', 'Tema 3: Recorreguts de vectors'),
    exercises: [5],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 4,
    title: 'Tema 4: Cadenas y formato',
    translations: titles('Topic 4: Strings and formatting', 'Tema 4: Cadenes i format'),
    exercises: [6, 7, 8],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 7,
    title: 'Recuperación del tema 2',
    translations: titles('Topic 2 resit', 'Recuperació del tema 2'),
    exercises: [3, 4, 2],
    hiddenExercises: [2],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 8,
    title: 'Repaso final',
    translations: titles('Final review', 'Repàs final'),
    exercises: [5, 8],
    isHidden: true,
  },
  {
    groupId: DAM_GROUP_ID,
    position: 1,
    title: 'Tema 1: Primeros bucles',
    translations: titles('Topic 1: First loops', 'Tema 1: Primers bucles'),
    exercises: [1, 2],
  },
  {
    groupId: DAM_GROUP_ID,
    position: 2,
    title: 'Tema 2: Vectores',
    translations: titles('Topic 2: Arrays', 'Tema 2: Vectors'),
    exercises: [3, 4],
  },
  {
    groupId: DAW_WEB_GROUP_ID,
    position: 1,
    title: 'Tema 1: Validación de formularios',
    translations: titles('Topic 1: Form validation', 'Tema 1: Validació de formularis'),
    exercises: [9, 21, 26],
  },
  {
    groupId: DAW_WEB_GROUP_ID,
    position: 2,
    title: 'Tema 2: URL y peticiones',
    translations: titles('Topic 2: URLs and requests', 'Tema 2: URL i peticions'),
    exercises: [10, 19, 28],
  },
  {
    groupId: DAM_ADVANCED_GROUP_ID,
    position: 1,
    title: 'Tema 1: Cadenas y acumuladores',
    translations: titles('Topic 1: Strings and accumulators', 'Tema 1: Cadenes i acumuladors'),
    exercises: [6, 7, 32, 33],
  },
  {
    groupId: DAM_ADVANCED_GROUP_ID,
    position: 2,
    title: 'Tema 2: Búsquedas',
    translations: titles('Topic 2: Searching', 'Tema 2: Cerques'),
    exercises: [8, 36],
  },
  // From here on, the blocks of the larger seed (2.5c): after the others, so their ids stay
  {
    groupId: DAW_GROUP_ID,
    position: 5,
    title: 'Tema 5: Funciones con números',
    translations: titles('Topic 5: Functions with numbers', 'Tema 5: Funcions amb nombres'),
    exercises: [11, 12, 14, 17],
  },
  {
    groupId: DAW_GROUP_ID,
    position: 6,
    title: 'Tema 6: Cadenas y listas',
    translations: titles('Topic 6: Strings and lists', 'Tema 6: Cadenes i llistes'),
    exercises: [13, 15, 16],
  },
  {
    groupId: DAM_GROUP_ID,
    position: 3,
    title: 'Tema 3: Recorridos y cadenas',
    translations: titles('Topic 3: Traversals and strings', 'Tema 3: Recorreguts i cadenes'),
    exercises: [5, 6, 7, 8],
  },
  {
    groupId: DAM_GROUP_ID,
    position: 4,
    title: 'Tema 4: Funciones con números',
    translations: titles('Topic 4: Functions with numbers', 'Tema 4: Funcions amb nombres'),
    exercises: [11, 12, 14, 17],
  },
  {
    groupId: DAM_GROUP_ID,
    position: 5,
    title: 'Tema 5: Cadenas y listas',
    translations: titles('Topic 5: Strings and lists', 'Tema 5: Cadenes i llistes'),
    exercises: [13, 15, 16],
  },
  {
    groupId: DAW_WEB_GROUP_ID,
    position: 3,
    title: 'Tema 3: Textos de la interfaz',
    translations: titles('Topic 3: Texts of the interface', 'Tema 3: Textos de la interfície'),
    exercises: [18, 20, 22, 23, 24, 25, 27],
  },
  {
    groupId: DAW_WEB_GROUP_ID,
    position: 4,
    title: 'Tema 4: Datos de la tienda',
    translations: titles('Topic 4: Shop data', 'Tema 4: Dades de la botiga'),
    exercises: [29, 30],
  },
  {
    groupId: DAM_ADVANCED_GROUP_ID,
    position: 3,
    title: 'Tema 3: Listas',
    translations: titles('Topic 3: Lists', 'Tema 3: Llistes'),
    exercises: [31, 34, 35, 40, 41],
  },
  {
    groupId: DAM_ADVANCED_GROUP_ID,
    position: 4,
    title: 'Tema 4: Algoritmos clásicos',
    translations: titles('Topic 4: Classic algorithms', 'Tema 4: Algorismes clàssics'),
    exercises: [37, 38, 39, 42],
  },
];

/** Number (1-based) in BLOCK_FIXTURES of the resit block of 1.º DAW A. */
export const DAW_RESIT_BLOCK = 5;
/** Number (1-based) in BLOCK_FIXTURES of the final review of 1.º DAW A, still hidden. */
export const DAW_HIDDEN_BLOCK = 6;
/** Number (1-based) in BLOCK_FIXTURES of the first block of 1.º DAM B. */
export const DAM_FIRST_BLOCK = 7;
/** Number (1-based) in BLOCK_FIXTURES of the first block of advanced programming in 1.º DAM B. */
export const DAM_ADVANCED_FIRST_BLOCK = 11;
/** Number (1-based) of the first block of the web client subject of 1.º DAW A. */
export const DAW_WEB_FIRST_BLOCK = 9;

export const CLASS_BLOCKS: readonly ClassBlock[] = BLOCK_FIXTURES.map((block, index) => ({
  id: fixtureId('block', index + 1),
  groupId: block.groupId,
  position: block.position,
  title: block.title,
  sourceLocale: SOURCE_LOCALE,
  translations: block.translations,
  isHidden: block.isHidden ?? false,
}));

/**
 * Id of the assignment of exercise `n` in block `blockNumber` (1-based) of BLOCK_FIXTURES. The first
 * assignment of each exercise in 1.º DAW A and 1.º DAM B keeps the id of step 2.1 (`n` and `100 + n`),
 * so the pgTAP tests still find them; the others go from `100 × blockNumber`.
 */
export function blockAssignmentId(blockNumber: number, n: number): string {
  const { groupId } = BLOCK_FIXTURES[blockNumber - 1];
  const first = BLOCK_FIXTURES.findIndex(
    (block) => block.groupId === groupId && block.exercises.includes(n),
  );
  const keepsOldId = groupId === DAW_GROUP_ID || groupId === DAM_GROUP_ID;
  if (first + 1 === blockNumber && keepsOldId) {
    return assignmentId(groupId, n);
  }
  return fixtureId('assignment', blockNumber * 100 + n);
}

/** Id of the first assignment of exercise `n` (1 to 8) in 1.º DAW A or 1.º DAM B. */
export function assignmentId(groupId: string, n: number): string {
  return fixtureId('assignment', (groupId === DAW_GROUP_ID ? 0 : 100) + n);
}

export const ASSIGNMENTS: readonly ExerciseAssignment[] = BLOCK_FIXTURES.flatMap((block, index) =>
  block.exercises.map((n) => ({
    id: blockAssignmentId(index + 1, n),
    groupId: block.groupId,
    blockId: fixtureId('block', index + 1),
    exerciseId: exerciseId(n),
    isHidden: block.hiddenExercises?.includes(n) ?? false,
  })),
);
