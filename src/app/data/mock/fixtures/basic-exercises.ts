import { type ExerciseFixture, lines, type SampleCode } from './exercise-fixture';

/**
 * More exercises of basic programming (2.5c), numbers 11 to 17 of the seed: with 1 to 8, the subject
 * has 15. Each one comes with its sample code: a typical mistake and a solution.
 */
export const BASIC_EXERCISE_FIXTURES: readonly (ExerciseFixture & { readonly code: SampleCode })[] =
  [
    {
      title: 'Año bisiesto',
      difficulty: 'initial',
      topics: ['Condicionales', 'operadores lógicos'],
      functionName: 'isLeapYear',
      statement:
        'Escribe una función `isLeapYear` que reciba un año y devuelva `true` si es bisiesto y `false` si no. Un año es bisiesto si es divisible entre 4, salvo los divisibles entre 100, que solo lo son si además son divisibles entre 400.',
      translations: {
        en: {
          title: 'Leap year',
          topics: ['Conditionals', 'logical operators'],
          statement:
            'Write a function `isLeapYear` that takes a year and returns `true` if it is a leap year and `false` if not. A year is a leap year if it is divisible by 4, except those divisible by 100, which only are if they are also divisible by 400.',
        },
        ca: {
          title: 'Any de traspàs',
          topics: ['Condicionals', 'operadors lògics'],
          statement:
            'Escriu una funció `isLeapYear` que rebi un any i retorni `true` si és de traspàs i `false` si no. Un any és de traspàs si és divisible entre 4, excepte els divisibles entre 100, que només ho són si a més són divisibles entre 400.',
        },
      },
      visible: [
        [[2024], true],
        [[2023], false],
        [[1900], false],
        [[2000], true],
      ],
      hidden: [
        [[2100], false],
        [[1996], true],
      ],
      code: {
        partial: lines('function isLeapYear(year) {', '  return year % 4 === 0;', '}'),
        solved: lines(
          'function isLeapYear(year) {',
          '  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;',
          '}',
        ),
      },
    },
    {
      title: 'Factorial de un número',
      difficulty: 'medium',
      topics: ['Bucles', 'acumulador'],
      functionName: 'factorial',
      statement:
        'Escribe una función `factorial` que reciba un número entero `n`, mayor o igual que 0, y devuelva su factorial: el producto de todos los enteros de 1 a `n`. El factorial de 0 es 1.',
      translations: {
        en: {
          title: 'Factorial of a number',
          topics: ['Loops', 'accumulator'],
          statement:
            'Write a function `factorial` that takes an integer `n`, greater than or equal to 0, and returns its factorial: the product of every integer from 1 to `n`. The factorial of 0 is 1.',
        },
        ca: {
          title: "Factorial d'un nombre",
          topics: ['Bucles', 'acumulador'],
          statement:
            'Escriu una funció `factorial` que rebi un nombre enter `n`, més gran o igual que 0, i retorni el seu factorial: el producte de tots els enters de 1 a `n`. El factorial de 0 és 1.',
        },
      },
      visible: [
        [[5], 120],
        [[1], 1],
        [[0], 1],
        [[3], 6],
      ],
      hidden: [
        [[10], 3628800],
        [[7], 5040],
      ],
      code: {
        partial: lines(
          'function factorial(n) {',
          '  let result = 1;',
          '  for (let i = 1; i < n; i++) result *= i;',
          '  return result;',
          '}',
        ),
        solved: lines(
          'function factorial(n) {',
          '  let result = 1;',
          '  for (let i = 2; i <= n; i++) result *= i;',
          '  return result;',
          '}',
        ),
      },
    },
    {
      title: 'FizzBuzz',
      difficulty: 'medium',
      topics: ['Bucles', 'condicionales', 'vectores'],
      functionName: 'fizzBuzz',
      statement:
        'Escribe una función `fizzBuzz` que reciba un número `n` y devuelva un vector con los textos de 1 a `n`: cada número como texto, salvo los múltiplos de 3, que son `"Fizz"`, los de 5, `"Buzz"`, y los de 3 y 5 a la vez, `"FizzBuzz"`. Si `n` es 0, el vector está vacío.',
      translations: {
        en: {
          title: 'FizzBuzz',
          topics: ['Loops', 'conditionals', 'arrays'],
          statement:
            'Write a function `fizzBuzz` that takes a number `n` and returns an array with the texts from 1 to `n`: each number as text, except multiples of 3, which are `"Fizz"`, those of 5, `"Buzz"`, and those of both 3 and 5, `"FizzBuzz"`. If `n` is 0, the array is empty.',
        },
        ca: {
          title: 'FizzBuzz',
          topics: ['Bucles', 'condicionals', 'vectors'],
          statement:
            'Escriu una funció `fizzBuzz` que rebi un nombre `n` i retorni un vector amb els textos de 1 a `n`: cada nombre com a text, excepte els múltiples de 3, que són `"Fizz"`, els de 5, `"Buzz"`, i els de 3 i 5 alhora, `"FizzBuzz"`. Si `n` és 0, el vector és buit.',
        },
      },
      visible: [
        [[5], ['1', '2', 'Fizz', '4', 'Buzz']],
        [[3], ['1', '2', 'Fizz']],
        [[0], []],
      ],
      hidden: [
        [
          [15],
          [
            '1',
            '2',
            'Fizz',
            '4',
            'Buzz',
            'Fizz',
            '7',
            '8',
            'Fizz',
            'Buzz',
            '11',
            'Fizz',
            '13',
            '14',
            'FizzBuzz',
          ],
        ],
        [[1], ['1']],
      ],
      code: {
        partial: lines(
          'function fizzBuzz(n) {',
          '  const result = [];',
          '  for (let i = 1; i <= n; i++) {',
          "    if (i % 3 === 0) result.push('Fizz');",
          "    else if (i % 5 === 0) result.push('Buzz');",
          "    else if (i % 15 === 0) result.push('FizzBuzz');",
          '    else result.push(String(i));',
          '  }',
          '  return result;',
          '}',
        ),
        solved: lines(
          'function fizzBuzz(n) {',
          '  const result = [];',
          '  for (let i = 1; i <= n; i++) {',
          "    if (i % 15 === 0) result.push('FizzBuzz');",
          "    else if (i % 3 === 0) result.push('Fizz');",
          "    else if (i % 5 === 0) result.push('Buzz');",
          '    else result.push(String(i));',
          '  }',
          '  return result;',
          '}',
        ),
      },
    },
    {
      title: 'De grados Celsius a Fahrenheit',
      difficulty: 'initial',
      topics: ['Expresiones', 'operadores aritméticos'],
      functionName: 'celsiusToFahrenheit',
      statement:
        'Escribe una función `celsiusToFahrenheit` que reciba una temperatura en grados Celsius y devuelva su valor en grados Fahrenheit, con la fórmula F = C × 9 / 5 + 32.',
      translations: {
        en: {
          title: 'From Celsius to Fahrenheit',
          topics: ['Expressions', 'arithmetic operators'],
          statement:
            'Write a function `celsiusToFahrenheit` that takes a temperature in degrees Celsius and returns its value in degrees Fahrenheit, with the formula F = C × 9 / 5 + 32.',
        },
        ca: {
          title: 'De graus Celsius a Fahrenheit',
          topics: ['Expressions', 'operadors aritmètics'],
          statement:
            'Escriu una funció `celsiusToFahrenheit` que rebi una temperatura en graus Celsius i retorni el seu valor en graus Fahrenheit, amb la fórmula F = C × 9 / 5 + 32.',
        },
      },
      visible: [
        [[0], 32],
        [[100], 212],
        [[25], 77],
        [[-40], -40],
      ],
      hidden: [
        [[-10], 14],
        [[30], 86],
      ],
      code: {
        partial: lines(
          'function celsiusToFahrenheit(celsius) {',
          '  return (celsius * 5) / 9 + 32;',
          '}',
        ),
        solved: lines(
          'function celsiusToFahrenheit(celsius) {',
          '  return (celsius * 9) / 5 + 32;',
          '}',
        ),
      },
    },
    {
      title: 'Contar las cifras de un número',
      difficulty: 'medium',
      topics: ['Números', 'casos límite'],
      functionName: 'countDigits',
      statement:
        'Escribe una función `countDigits` que reciba un número entero y devuelva cuántas cifras tiene, sin contar el signo. El 0 tiene una cifra.',
      translations: {
        en: {
          title: 'Count the digits of a number',
          topics: ['Numbers', 'edge cases'],
          statement:
            'Write a function `countDigits` that takes an integer and returns how many digits it has, without counting the sign. 0 has one digit.',
        },
        ca: {
          title: "Comptar les xifres d'un nombre",
          topics: ['Nombres', 'casos límit'],
          statement:
            'Escriu una funció `countDigits` que rebi un nombre enter i retorni quantes xifres té, sense comptar el signe. El 0 té una xifra.',
        },
      },
      visible: [
        [[12345], 5],
        [[7], 1],
        [[0], 1],
        [[-908], 3],
      ],
      hidden: [
        [[1000000], 7],
        [[-5], 1],
      ],
      code: {
        partial: lines('function countDigits(n) {', '  return String(n).length;', '}'),
        solved: lines('function countDigits(n) {', '  return String(Math.abs(n)).length;', '}'),
      },
    },
    {
      title: 'Primera letra en mayúscula',
      difficulty: 'initial',
      topics: ['Cadenas', 'mayúsculas y minúsculas'],
      functionName: 'capitalize',
      statement:
        'Escribe una función `capitalize` que reciba una palabra y la devuelva con la primera letra en mayúscula y el resto en minúscula. Con un texto vacío, devuelve un texto vacío.',
      translations: {
        en: {
          title: 'First letter in upper case',
          topics: ['Strings', 'upper and lower case'],
          statement:
            'Write a function `capitalize` that takes a word and returns it with the first letter in upper case and the rest in lower case. With an empty text, it returns an empty text.',
        },
        ca: {
          title: 'Primera lletra en majúscula',
          topics: ['Cadenes', 'majúscules i minúscules'],
          statement:
            'Escriu una funció `capitalize` que rebi una paraula i la retorni amb la primera lletra en majúscula i la resta en minúscula. Amb un text buit, retorna un text buit.',
        },
      },
      visible: [
        [['hola'], 'Hola'],
        [['MUNDO'], 'Mundo'],
        [[''], ''],
      ],
      hidden: [
        [['a'], 'A'],
        [['jAVAsCRIPT'], 'Javascript'],
      ],
      code: {
        partial: lines(
          'function capitalize(word) {',
          '  return word.charAt(0).toUpperCase() + word.slice(1);',
          '}',
        ),
        solved: lines(
          'function capitalize(word) {',
          '  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();',
          '}',
        ),
      },
    },
    {
      title: 'Número primo',
      difficulty: 'advanced',
      topics: ['Bucles', 'divisibilidad', 'casos límite'],
      functionName: 'isPrime',
      statement:
        'Escribe una función `isPrime` que reciba un número entero y devuelva `true` si es primo y `false` si no. Un número es primo si es mayor que 1 y solo es divisible entre 1 y entre sí mismo.',
      translations: {
        en: {
          title: 'Prime number',
          topics: ['Loops', 'divisibility', 'edge cases'],
          statement:
            'Write a function `isPrime` that takes an integer and returns `true` if it is prime and `false` if not. A number is prime if it is greater than 1 and only divisible by 1 and by itself.',
        },
        ca: {
          title: 'Nombre primer',
          topics: ['Bucles', 'divisibilitat', 'casos límit'],
          statement:
            'Escriu una funció `isPrime` que rebi un nombre enter i retorni `true` si és primer i `false` si no. Un nombre és primer si és més gran que 1 i només és divisible entre 1 i entre ell mateix.',
        },
      },
      visible: [
        [[7], true],
        [[1], false],
        [[2], true],
        [[9], false],
      ],
      hidden: [
        [[97], true],
        [[0], false],
      ],
      code: {
        partial: lines(
          'function isPrime(n) {',
          '  for (let i = 2; i < n; i++) {',
          '    if (n % i === 0) return false;',
          '  }',
          '  return true;',
          '}',
        ),
        solved: lines(
          'function isPrime(n) {',
          '  if (n < 2) return false;',
          '  for (let i = 2; i * i <= n; i++) {',
          '    if (n % i === 0) return false;',
          '  }',
          '  return true;',
          '}',
        ),
      },
    },
  ];
