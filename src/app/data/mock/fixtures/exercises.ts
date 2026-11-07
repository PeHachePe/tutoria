import type { Difficulty, Exercise, ExerciseAssignment, Test } from '../../exercise';
import { fixtureId } from './fixture-id';
import { DAM_GROUP_ID, DAW_GROUP_ID, TEACHER_ID } from './users';

const CREATED_AT = '2026-09-28T16:00:00.000Z';

interface ExerciseFixture {
  readonly title: string;
  readonly difficulty: Difficulty;
  /** The contents column of 2.5. */
  readonly topics: readonly string[];
  readonly functionName: string;
  readonly statement: string;
  /** Visible tests, the edge case among them: `[input, expectedOutput]`. */
  readonly visible: readonly (readonly [readonly unknown[], unknown])[];
  /** The hidden test: the student only sees whether it passed. */
  readonly hidden: readonly [readonly unknown[], unknown];
}

function multiplicationTable(n: number): string {
  return Array.from({ length: 10 }, (_, i) => `${n} x ${i + 1} = ${n * (i + 1)}`).join('\n');
}

/** The initial set of 2.5, in the order of the table. */
const EXERCISE_FIXTURES: readonly ExerciseFixture[] = [
  {
    title: 'Contar números pares',
    difficulty: 'initial',
    topics: ['Bucles', 'rangos', 'condicionales'],
    functionName: 'contarPares',
    statement:
      'Escribe una función `contarPares` que reciba un número entero `n` y devuelva cuántos números pares hay entre 1 y `n`, ambos incluidos. Si `n` es menor que 2, la función debe devolver 0.',
    visible: [
      [[10], 5],
      [[7], 3],
      [[1], 0],
    ],
    hidden: [[25], 12],
  },
  {
    title: 'Tabla de multiplicar',
    difficulty: 'initial',
    topics: ['Bucles anidados', 'salida formateada'],
    functionName: 'tablaMultiplicar',
    statement:
      'Escribe una función `tablaMultiplicar` que reciba un número entero `n` y devuelva su tabla de multiplicar del 1 al 10 como un único texto. Cada línea sigue el formato `n x i = resultado` y las líneas se separan con un salto de línea (`\\n`), sin salto al final. Si `n` es 0, todas las líneas dan 0.',
    visible: [
      [[2], multiplicationTable(2)],
      [[7], multiplicationTable(7)],
      [[0], multiplicationTable(0)],
    ],
    hidden: [[-3], multiplicationTable(-3)],
  },
  {
    title: 'Suma de los elementos de un vector',
    difficulty: 'medium',
    topics: ['Vectores', 'acumulador', 'vector vacío'],
    functionName: 'suma',
    statement:
      'Escribe una función `suma` que reciba un vector de números enteros y devuelva la suma de todos sus elementos. Si el vector está vacío, la función debe devolver 0.',
    visible: [
      [[[1, 2, 3]], 6],
      [[[5]], 5],
      [[[]], 0],
      [[[-2, 2, 10]], 10],
    ],
    hidden: [[[7, -3, 1]], 5],
  },
  {
    title: 'Máximo de un vector',
    difficulty: 'medium',
    topics: ['Vectores', 'comparación', 'casos límite'],
    functionName: 'maximo',
    statement:
      'Escribe una función `maximo` que reciba un vector de números y devuelva el mayor de sus elementos. Ten en cuenta que todos pueden ser negativos. Si el vector está vacío, la función debe devolver `null`.',
    visible: [
      [[[3, 9, 2]], 9],
      [[[-5, -2, -8]], -2],
      [[[4]], 4],
      [[[]], null],
    ],
    hidden: [[[1, 7, 7, 3]], 7],
  },
  {
    title: 'Invertir un vector',
    difficulty: 'advanced',
    topics: ['Vectores', 'índices', 'intercambio'],
    functionName: 'invertir',
    statement:
      'Escribe una función `invertir` que reciba un vector y devuelva un vector nuevo con los mismos elementos en orden inverso. Resuélvelo recorriendo el vector con índices, sin usar `reverse()`. Si el vector está vacío, devuelve un vector vacío.',
    visible: [
      [[[1, 2, 3]], [3, 2, 1]],
      [[[4, -1, 0, 9]], [9, 0, -1, 4]],
      [[[7]], [7]],
      [[[]], []],
    ],
    hidden: [[[1, 2, 3, 4, 5, 6]], [6, 5, 4, 3, 2, 1]],
  },
  {
    title: 'Contar vocales en una cadena',
    difficulty: 'extension',
    topics: ['Cadenas', 'recorrido y conteo'],
    functionName: 'contarVocales',
    statement:
      'Escribe una función `contarVocales` que reciba un texto y devuelva cuántas vocales contiene, sin distinguir mayúsculas de minúsculas. Las vocales con tilde (á, é, í, ó, ú) también cuentan. Si el texto está vacío, la función debe devolver 0.',
    visible: [
      [['hola'], 2],
      [['PROGRAMAR'], 3],
      [['Canción'], 3],
      [[''], 0],
    ],
    hidden: [['Murciélago'], 5],
  },
  {
    title: 'Media de un vector con dos decimales',
    difficulty: 'extension',
    topics: ['Acumuladores', 'formato de salida'],
    functionName: 'media',
    statement:
      'Escribe una función `media` que reciba un vector de números y devuelva su media como texto con exactamente dos decimales, por ejemplo `"2.50"`. Si el vector está vacío, la función debe devolver `"0.00"`.',
    visible: [
      [[[1, 2, 3, 4]], '2.50'],
      [[[5]], '5.00'],
      [[[1, 2]], '1.50'],
      [[[]], '0.00'],
    ],
    hidden: [[[1, 1, 2]], '1.33'],
  },
  {
    title: 'Buscar un valor con parada temprana',
    difficulty: 'extension',
    topics: ['Condición compuesta', 'bandera'],
    functionName: 'buscar',
    statement:
      'Escribe una función `buscar` que reciba un vector y un valor, y devuelva la posición de la primera vez que aparece ese valor, dejando de recorrer el vector en cuanto lo encuentre. Si el valor no aparece, la función debe devolver -1.',
    visible: [
      [[[4, 8, 15], 8], 1],
      [[[4, 8, 8], 8], 1],
      [[[1, 2, 3], 9], -1],
      [[[], 5], -1],
    ],
    hidden: [[[5, 3, 5], 5], 0],
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
  language: 'javascript',
  functionName: fixture.functionName,
  maxRepeatedFailures: 3,
  maxIdleMinutes: 4,
  createdBy: TEACHER_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}));

export const TESTS: readonly Test[] = EXERCISE_FIXTURES.flatMap((fixture, index) =>
  [...fixture.visible, fixture.hidden].map(([input, expectedOutput], position) => ({
    id: testId(index + 1, position),
    exerciseId: exerciseId(index + 1),
    input,
    expectedOutput,
    isHidden: position === fixture.visible.length,
    position,
  })),
);

/** Session of each exercise (1 to 8) in 1.º DAW A, as in 2.5. */
export const DAW_SESSIONS: readonly number[] = [1, 1, 2, 2, 3, 4, 4, 4];
/** 1.º DAM B has only reached session 2, with the first four exercises. */
export const DAM_SESSIONS: readonly number[] = [1, 1, 2, 2];

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
