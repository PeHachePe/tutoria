import { type ExerciseFixture, lines, type SampleCode } from './exercise-fixture';

/**
 * Exercises of advanced programming (2.5c), numbers 31 to 42 of the seed: with 6 to 8, which serve
 * both programming subjects, the subject has 15. Classic algorithms on arrays and strings. Each one
 * comes with its sample code: a typical mistake and a solution.
 */
export const ADVANCED_EXERCISE_FIXTURES: readonly (ExerciseFixture & {
  readonly code: SampleCode;
})[] = [
  {
    title: 'Quitar los repetidos',
    difficulty: 'medium',
    topics: ['Vectores', 'conjuntos'],
    functionName: 'removeDuplicates',
    statement:
      'Escribe una función `removeDuplicates` que reciba un vector y devuelva otro sin elementos repetidos, en el orden en que aparece cada uno por primera vez.',
    translations: {
      en: {
        title: 'Remove the duplicates',
        topics: ['Arrays', 'sets'],
        statement:
          'Write a function `removeDuplicates` that takes an array and returns another one without repeated elements, in the order in which each one first appears.',
      },
      ca: {
        title: 'Treure els repetits',
        topics: ['Vectors', 'conjunts'],
        statement:
          "Escriu una funció `removeDuplicates` que rebi un vector i en retorni un altre sense elements repetits, en l'ordre en què apareix cadascun per primera vegada.",
      },
    },
    visible: [
      [[[1, 2, 2, 3, 1]], [1, 2, 3]],
      [[['a', 'a']], ['a']],
      [[[]], []],
    ],
    hidden: [
      [[[5, 5, 5, 5]], [5]],
      [[[3, 1, 3, 2, 1]], [3, 1, 2]],
    ],
    code: {
      partial: lines(
        'function removeDuplicates(items) {',
        '  return items.filter((item) => items.indexOf(item) === items.lastIndexOf(item));',
        '}',
      ),
      solved: lines('function removeDuplicates(items) {', '  return [...new Set(items)];', '}'),
    },
  },
  {
    title: 'Palíndromo',
    difficulty: 'medium',
    topics: ['Cadenas', 'recorrido inverso'],
    functionName: 'isPalindrome',
    statement:
      'Escribe una función `isPalindrome` que reciba un texto y devuelva `true` si se lee igual al derecho que al revés, sin tener en cuenta los espacios ni las mayúsculas: `"Yo hago yoga hoy"` lo es. Un texto vacío también lo es.',
    translations: {
      en: {
        title: 'Palindrome',
        topics: ['Strings', 'reverse traversal'],
        statement:
          'Write a function `isPalindrome` that takes a text and returns `true` if it reads the same forwards and backwards, ignoring spaces and upper case: `"Yo hago yoga hoy"` is one. An empty text is one too.',
      },
      ca: {
        title: 'Palíndrom',
        topics: ['Cadenes', 'recorregut invers'],
        statement:
          'Escriu una funció `isPalindrome` que rebi un text i retorni `true` si es llegeix igual del dret que del revés, sense tenir en compte els espais ni les majúscules: `"Yo hago yoga hoy"` ho és. Un text buit també ho és.',
      },
    },
    visible: [
      [['Anilina'], true],
      [['hola'], false],
      [['Yo hago yoga hoy'], true],
    ],
    hidden: [
      [[''], true],
      [['ab'], false],
    ],
    code: {
      partial: lines(
        'function isPalindrome(text) {',
        "  return text === text.split('').reverse().join('');",
        '}',
      ),
      solved: lines(
        'function isPalindrome(text) {',
        "  const clean = text.toLowerCase().split(' ').join('');",
        "  return clean === clean.split('').reverse().join('');",
        '}',
      ),
    },
  },
  {
    title: 'El elemento más frecuente',
    difficulty: 'advanced',
    topics: ['Vectores', 'conteo', 'casos límite'],
    functionName: 'mostFrequent',
    statement:
      'Escribe una función `mostFrequent` que reciba un vector y devuelva el elemento que más se repite. Si empatan varios, el que aparece antes. Con un vector vacío, devuelve `null`.',
    translations: {
      en: {
        title: 'The most frequent element',
        topics: ['Arrays', 'counting', 'edge cases'],
        statement:
          'Write a function `mostFrequent` that takes an array and returns the element that repeats the most. If several tie, the one that appears first. With an empty array, it returns `null`.',
      },
      ca: {
        title: "L'element més freqüent",
        topics: ['Vectors', 'recompte', 'casos límit'],
        statement:
          "Escriu una funció `mostFrequent` que rebi un vector i retorni l'element que es repeteix més. Si n'empaten diversos, el que apareix abans. Amb un vector buit, retorna `null`.",
      },
    },
    visible: [
      [[['a', 'b', 'a']], 'a'],
      [[[3, 1, 3, 1, 1]], 1],
      [[['x']], 'x'],
    ],
    hidden: [
      [[[2, 2, 3, 3]], 2],
      [[[]], null],
    ],
    code: {
      partial: lines('function mostFrequent(items) {', '  return items[0] ?? null;', '}'),
      solved: lines(
        'function mostFrequent(items) {',
        '  let best = null;',
        '  let bestCount = 0;',
        '  for (const item of items) {',
        '    const count = items.filter((other) => other === item).length;',
        '    if (count > bestCount) {',
        '      best = item;',
        '      bestCount = count;',
        '    }',
        '  }',
        '  return best;',
        '}',
      ),
    },
  },
  {
    title: 'Aplanar un nivel',
    difficulty: 'medium',
    topics: ['Vectores anidados'],
    functionName: 'flattenOnce',
    statement:
      'Escribe una función `flattenOnce` que reciba un vector de vectores y devuelva un solo vector con sus elementos, en orden. Solo se aplana un nivel: un vector que esté más adentro se queda como está.',
    translations: {
      en: {
        title: 'Flatten one level',
        topics: ['Nested arrays'],
        statement:
          'Write a function `flattenOnce` that takes an array of arrays and returns a single array with their elements, in order. Only one level is flattened: an array deeper inside stays as it is.',
      },
      ca: {
        title: 'Aplanar un nivell',
        topics: ['Vectors niats'],
        statement:
          "Escriu una funció `flattenOnce` que rebi un vector de vectors i retorni un sol vector amb els seus elements, en ordre. Només s'aplana un nivell: un vector que sigui més endins es queda com està.",
      },
    },
    visible: [
      [[[[1, 2], [3], []]], [1, 2, 3]],
      [[[['a'], ['b', 'c']]], ['a', 'b', 'c']],
      [[[]], []],
    ],
    hidden: [
      [[[[[1]], [2]]], [[1], 2]],
      [[[[], []]], []],
    ],
    code: {
      partial: lines(
        'function flattenOnce(nested) {',
        '  return nested.map((inner) => inner[0]);',
        '}',
      ),
      solved: lines('function flattenOnce(nested) {', '  return nested.flat();', '}'),
    },
  },
  {
    title: 'Partir en trozos',
    difficulty: 'advanced',
    topics: ['Vectores', 'índices'],
    functionName: 'chunk',
    statement:
      'Escribe una función `chunk` que reciba un vector y un tamaño, y devuelva el vector partido en trozos de ese tamaño, en orden; el último puede ser más corto. `chunk([1, 2, 3, 4, 5], 2)` es `[[1, 2], [3, 4], [5]]`.',
    translations: {
      en: {
        title: 'Split into chunks',
        topics: ['Arrays', 'indexes'],
        statement:
          'Write a function `chunk` that takes an array and a size, and returns the array split into chunks of that size, in order; the last one can be shorter. `chunk([1, 2, 3, 4, 5], 2)` is `[[1, 2], [3, 4], [5]]`.',
      },
      ca: {
        title: 'Partir en trossos',
        topics: ['Vectors', 'índexs'],
        statement:
          "Escriu una funció `chunk` que rebi un vector i una mida, i retorni el vector partit en trossos d'aquesta mida, en ordre; l'últim pot ser més curt. `chunk([1, 2, 3, 4, 5], 2)` és `[[1, 2], [3, 4], [5]]`.",
      },
    },
    visible: [
      [
        [[1, 2, 3, 4, 5], 2],
        [[1, 2], [3, 4], [5]],
      ],
      [[[1, 2, 3], 3], [[1, 2, 3]]],
      [[[], 2], []],
    ],
    hidden: [
      [
        [[1, 2, 3], 1],
        [[1], [2], [3]],
      ],
      [[[1, 2], 5], [[1, 2]]],
    ],
    code: {
      partial: lines(
        'function chunk(items, size) {',
        '  const chunks = [];',
        '  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, size));',
        '  return chunks;',
        '}',
      ),
      solved: lines(
        'function chunk(items, size) {',
        '  const chunks = [];',
        '  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));',
        '  return chunks;',
        '}',
      ),
    },
  },
  {
    title: 'Búsqueda binaria',
    difficulty: 'advanced',
    topics: ['Búsqueda binaria', 'vectores ordenados'],
    functionName: 'binarySearch',
    statement:
      'Escribe una función `binarySearch` que reciba un vector de números ordenado de menor a mayor y un valor, y devuelva su posición con una búsqueda binaria: mira el elemento del medio y sigue solo por la mitad donde puede estar. Si no está, devuelve -1.',
    translations: {
      en: {
        title: 'Binary search',
        topics: ['Binary search', 'sorted arrays'],
        statement:
          'Write a function `binarySearch` that takes an array of numbers sorted from lowest to highest and a value, and returns its position with a binary search: look at the middle element and go on only with the half where it can be. If it is not there, it returns -1.',
      },
      ca: {
        title: 'Cerca binària',
        topics: ['Cerca binària', 'vectors ordenats'],
        statement:
          "Escriu una funció `binarySearch` que rebi un vector de nombres ordenat de menor a major i un valor, i retorni la seva posició amb una cerca binària: mira l'element del mig i continua només per la meitat on pot ser. Si no hi és, retorna -1.",
      },
    },
    visible: [
      [[[1, 3, 5, 7, 9], 7], 3],
      [[[1, 3, 5], 1], 0],
      [[[], 4], -1],
      [[[2, 4, 6], 5], -1],
    ],
    hidden: [
      [[[1, 2, 3, 4, 5, 6, 7, 8], 8], 7],
      [[[10], 10], 0],
    ],
    code: {
      partial: lines(
        'function binarySearch(sorted, value) {',
        '  let low = 0;',
        '  let high = sorted.length - 1;',
        '  while (low < high) {',
        '    const middle = Math.floor((low + high) / 2);',
        '    if (sorted[middle] === value) return middle;',
        '    if (sorted[middle] < value) low = middle + 1;',
        '    else high = middle - 1;',
        '  }',
        '  return -1;',
        '}',
      ),
      solved: lines(
        'function binarySearch(sorted, value) {',
        '  let low = 0;',
        '  let high = sorted.length - 1;',
        '  while (low <= high) {',
        '    const middle = Math.floor((low + high) / 2);',
        '    if (sorted[middle] === value) return middle;',
        '    if (sorted[middle] < value) low = middle + 1;',
        '    else high = middle - 1;',
        '  }',
        '  return -1;',
        '}',
      ),
    },
  },
  {
    title: 'Ordenar números',
    difficulty: 'medium',
    topics: ['Ordenación', 'funciones de comparación'],
    functionName: 'sortNumbers',
    statement:
      'Escribe una función `sortNumbers` que reciba un vector de números y devuelva otro con los mismos números ordenados de menor a mayor, sin cambiar el original. Ojo: sin función de comparación, `sort` ordena como si fueran textos.',
    translations: {
      en: {
        title: 'Sort numbers',
        topics: ['Sorting', 'compare functions'],
        statement:
          'Write a function `sortNumbers` that takes an array of numbers and returns another one with the same numbers sorted from lowest to highest, without changing the original. Careful: without a compare function, `sort` sorts as if they were texts.',
      },
      ca: {
        title: 'Ordenar nombres',
        topics: ['Ordenació', 'funcions de comparació'],
        statement:
          "Escriu una funció `sortNumbers` que rebi un vector de nombres i en retorni un altre amb els mateixos nombres ordenats de menor a major, sense canviar l'original. Compte: sense funció de comparació, `sort` ordena com si fossin textos.",
      },
    },
    visible: [
      [[[3, 1, 2]], [1, 2, 3]],
      [[[5, -1, 0]], [-1, 0, 5]],
      [[[]], []],
    ],
    hidden: [
      [[[10, 9, 8, 7]], [7, 8, 9, 10]],
      [[[2, 2, 1]], [1, 2, 2]],
    ],
    code: {
      partial: lines('function sortNumbers(numbers) {', '  return [...numbers].sort();', '}'),
      solved: lines(
        'function sortNumbers(numbers) {',
        '  return [...numbers].sort((a, b) => a - b);',
        '}',
      ),
    },
  },
  {
    title: 'Máximo común divisor',
    difficulty: 'medium',
    topics: ['Algoritmo de Euclides', 'bucles'],
    functionName: 'gcd',
    statement:
      'Escribe una función `gcd` que reciba dos números enteros, mayores o iguales que 0 y no los dos 0, y devuelva su máximo común divisor. El algoritmo de Euclides lo calcula rápido: el mcd de `a` y `b` es el de `b` y el resto de dividir `a` entre `b`, hasta que `b` es 0.',
    translations: {
      en: {
        title: 'Greatest common divisor',
        topics: ['Euclidean algorithm', 'loops'],
        statement:
          'Write a function `gcd` that takes two integers, greater than or equal to 0 and not both 0, and returns their greatest common divisor. The Euclidean algorithm computes it fast: the gcd of `a` and `b` is that of `b` and the remainder of dividing `a` by `b`, until `b` is 0.',
      },
      ca: {
        title: 'Màxim comú divisor',
        topics: ["Algorisme d'Euclides", 'bucles'],
        statement:
          "Escriu una funció `gcd` que rebi dos nombres enters, més grans o iguals que 0 i no tots dos 0, i retorni el seu màxim comú divisor. L'algorisme d'Euclides el calcula ràpidament: el mcd d'`a` i `b` és el de `b` i el residu de dividir `a` entre `b`, fins que `b` és 0.",
      },
    },
    visible: [
      [[12, 18], 6],
      [[7, 13], 1],
      [[10, 0], 10],
    ],
    hidden: [
      [[0, 5], 5],
      [[48, 36], 12],
    ],
    code: {
      partial: lines(
        'function gcd(a, b) {',
        '  for (let d = Math.min(a, b); d > 0; d--) {',
        '    if (a % d === 0 && b % d === 0) return d;',
        '  }',
        '}',
      ),
      solved: lines(
        'function gcd(a, b) {',
        '  while (b !== 0) {',
        '    [a, b] = [b, a % b];',
        '  }',
        '  return a;',
        '}',
      ),
    },
  },
  {
    title: 'Números romanos',
    difficulty: 'extension',
    topics: ['Cadenas', 'objetos como tablas', 'casos especiales'],
    functionName: 'romanToInt',
    statement:
      'Escribe una función `romanToInt` que reciba un número romano (`I` = 1, `V` = 5, `X` = 10, `L` = 50, `C` = 100, `D` = 500, `M` = 1000) y devuelva su valor. Una letra que va delante de otra de más valor resta en lugar de sumar: `IX` es 9 y `XL`, 40.',
    translations: {
      en: {
        title: 'Roman numerals',
        topics: ['Strings', 'objects as tables', 'special cases'],
        statement:
          'Write a function `romanToInt` that takes a Roman numeral (`I` = 1, `V` = 5, `X` = 10, `L` = 50, `C` = 100, `D` = 500, `M` = 1000) and returns its value. A letter before another of higher value subtracts instead of adding: `IX` is 9 and `XL`, 40.',
      },
      ca: {
        title: 'Nombres romans',
        topics: ['Cadenes', 'objectes com a taules', 'casos especials'],
        statement:
          "Escriu una funció `romanToInt` que rebi un nombre romà (`I` = 1, `V` = 5, `X` = 10, `L` = 50, `C` = 100, `D` = 500, `M` = 1000) i retorni el seu valor. Una lletra que va davant d'una altra de més valor resta en lloc de sumar: `IX` és 9 i `XL`, 40.",
      },
    },
    visible: [
      [['III'], 3],
      [['IX'], 9],
      [['LVIII'], 58],
      [['MCMXCIV'], 1994],
    ],
    hidden: [
      [['XL'], 40],
      [['MMXXVI'], 2026],
    ],
    code: {
      partial: lines(
        'function romanToInt(roman) {',
        '  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };',
        '  let total = 0;',
        '  for (const letter of roman) total += values[letter];',
        '  return total;',
        '}',
      ),
      solved: lines(
        'function romanToInt(roman) {',
        '  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };',
        '  let total = 0;',
        '  for (let i = 0; i < roman.length; i++) {',
        '    const value = values[roman[i]];',
        '    const next = values[roman[i + 1]] ?? 0;',
        '    total += value < next ? -value : value;',
        '  }',
        '  return total;',
        '}',
      ),
    },
  },
  {
    title: 'Trasponer una matriz',
    difficulty: 'advanced',
    topics: ['Matrices', 'bucles anidados'],
    functionName: 'transpose',
    statement:
      'Escribe una función `transpose` que reciba una matriz (un vector de filas, todas de la misma longitud) y devuelva su traspuesta: las filas pasan a ser columnas. Una matriz vacía da una matriz vacía.',
    translations: {
      en: {
        title: 'Transpose a matrix',
        topics: ['Matrices', 'nested loops'],
        statement:
          'Write a function `transpose` that takes a matrix (an array of rows, all of the same length) and returns its transpose: the rows become columns. An empty matrix gives an empty matrix.',
      },
      ca: {
        title: 'Transposar una matriu',
        topics: ['Matrius', 'bucles niats'],
        statement:
          'Escriu una funció `transpose` que rebi una matriu (un vector de files, totes de la mateixa longitud) i retorni la seva transposada: les files passen a ser columnes. Una matriu buida dona una matriu buida.',
      },
    },
    visible: [
      [
        [
          [
            [1, 2, 3],
            [4, 5, 6],
          ],
        ],
        [
          [1, 4],
          [2, 5],
          [3, 6],
        ],
      ],
      [[[[1]]], [[1]]],
      [[[]], []],
    ],
    hidden: [
      [[[[1, 2]]], [[1], [2]]],
      [[[[1], [2]]], [[1, 2]]],
    ],
    code: {
      partial: lines(
        'function transpose(matrix) {',
        '  return matrix.map((row) => [...row].reverse());',
        '}',
      ),
      solved: lines(
        'function transpose(matrix) {',
        '  if (matrix.length === 0) return [];',
        '  return matrix[0].map((_, column) => matrix.map((row) => row[column]));',
        '}',
      ),
    },
  },
  {
    title: 'Mezclar dos vectores ordenados',
    difficulty: 'advanced',
    topics: ['Vectores ordenados', 'dos índices'],
    functionName: 'mergeSorted',
    statement:
      'Escribe una función `mergeSorted` que reciba dos vectores de números, cada uno ordenado de menor a mayor, y devuelva uno solo con todos sus números, también ordenado. Recórrelos a la vez con un índice para cada uno, sin volver a ordenar.',
    translations: {
      en: {
        title: 'Merge two sorted arrays',
        topics: ['Sorted arrays', 'two indexes'],
        statement:
          'Write a function `mergeSorted` that takes two arrays of numbers, each sorted from lowest to highest, and returns a single one with all their numbers, also sorted. Go through both at once with an index for each one, without sorting again.',
      },
      ca: {
        title: 'Barrejar dos vectors ordenats',
        topics: ['Vectors ordenats', 'dos índexs'],
        statement:
          "Escriu una funció `mergeSorted` que rebi dos vectors de nombres, cadascun ordenat de menor a major, i en retorni un de sol amb tots els seus nombres, també ordenat. Recorre'ls alhora amb un índex per a cadascun, sense tornar a ordenar.",
      },
    },
    visible: [
      [
        [
          [1, 4],
          [2, 3],
        ],
        [1, 2, 3, 4],
      ],
      [[[], [1]], [1]],
      [
        [[1, 1], [1]],
        [1, 1, 1],
      ],
    ],
    hidden: [
      [
        [
          [5, 6],
          [1, 2],
        ],
        [1, 2, 5, 6],
      ],
      [[[], []], []],
    ],
    code: {
      partial: lines(
        'function mergeSorted(first, second) {',
        '  return first.concat(second);',
        '}',
      ),
      solved: lines(
        'function mergeSorted(first, second) {',
        '  const merged = [];',
        '  let i = 0;',
        '  let j = 0;',
        '  while (i < first.length && j < second.length) {',
        '    merged.push(first[i] <= second[j] ? first[i++] : second[j++]);',
        '  }',
        '  return merged.concat(first.slice(i), second.slice(j));',
        '}',
      ),
    },
  },
  {
    title: 'Sucesión de Fibonacci',
    difficulty: 'medium',
    topics: ['Bucles', 'vectores', 'sucesiones'],
    functionName: 'fibonacci',
    statement:
      'Escribe una función `fibonacci` que reciba un número `n` y devuelva un vector con los `n` primeros términos de la sucesión de Fibonacci, que empieza por 0 y 1 y en la que cada término es la suma de los dos anteriores. Si `n` es 0, el vector está vacío.',
    translations: {
      en: {
        title: 'Fibonacci sequence',
        topics: ['Loops', 'arrays', 'sequences'],
        statement:
          'Write a function `fibonacci` that takes a number `n` and returns an array with the first `n` terms of the Fibonacci sequence, which starts with 0 and 1 and in which each term is the sum of the two before it. If `n` is 0, the array is empty.',
      },
      ca: {
        title: 'Successió de Fibonacci',
        topics: ['Bucles', 'vectors', 'successions'],
        statement:
          'Escriu una funció `fibonacci` que rebi un nombre `n` i retorni un vector amb els `n` primers termes de la successió de Fibonacci, que comença per 0 i 1 i en què cada terme és la suma dels dos anteriors. Si `n` és 0, el vector és buit.',
      },
    },
    visible: [
      [[5], [0, 1, 1, 2, 3]],
      [[1], [0]],
      [[0], []],
    ],
    hidden: [
      [[2], [0, 1]],
      [[10], [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]],
    ],
    code: {
      partial: lines(
        'function fibonacci(n) {',
        '  const terms = [];',
        '  for (let i = 0; i < n; i++) terms.push(i < 2 ? 1 : terms[i - 1] + terms[i - 2]);',
        '  return terms;',
        '}',
      ),
      solved: lines(
        'function fibonacci(n) {',
        '  const terms = [];',
        '  for (let i = 0; i < n; i++) terms.push(i < 2 ? i : terms[i - 1] + terms[i - 2]);',
        '  return terms;',
        '}',
      ),
    },
  },
];
