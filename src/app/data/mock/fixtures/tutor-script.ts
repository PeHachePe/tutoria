import type { ExerciseLocale } from '../../exercise-text';
import type { HintLevel } from '../../tutor';

/**
 * What the scripted tutor says (4.3), in each language of the interface: it answers in the language
 * of the request, like the real one (D-033, D-045). The past interactions of the fixtures use the
 * Spanish texts: they are conversations that already took place in Spanish.
 */
export interface TutorScript {
  /** Hints by level (2.6): a guiding question, the concept or the zone, and the concrete step. */
  readonly hints: Readonly<Record<HintLevel, readonly string[]>>;
  /** To a student who tries to get the solution: no solution, and a question that makes them think. */
  readonly elusion: string;
  /** The tutor steps in on its own (2.7). */
  readonly proactive: string;
  /** A question with the code still empty. */
  readonly start: string;
  /** A question about the statement. */
  readonly statement: string;
  /** A question once every test passes. */
  readonly passed: string;
}

export const TUTOR_SCRIPTS: Readonly<Record<ExerciseLocale, TutorScript>> = {
  es: {
    hints: {
      1: [
        '¿Qué valor tiene tu variable antes de entrar en el bucle?',
        '¿Qué ocurre con tu código cuando el vector está vacío?',
        '¿Desde qué número empieza a contar tu bucle? ¿Y dónde termina?',
      ],
      2: [
        'Fíjate en la condición del bucle: decide qué valores se recorren y cuáles se quedan fuera.',
        'Revisa el valor inicial del acumulador: ahí está la clave de la prueba que falla.',
        'El caso límite del enunciado necesita un tratamiento propio antes del recorrido.',
      ],
      3: [
        'Cambia el límite del bucle para que incluya también el último valor y vuelve a ejecutar las pruebas.',
        'Empieza el acumulador en el valor neutro de la operación y comprueba de nuevo el resultado.',
        'Comprueba primero si el vector está vacío y, en ese caso, devuelve lo que pide el enunciado.',
      ],
    },
    elusion:
      'Buen intento 😉 La solución no te la puedo dar, pero sí ayudarte a llegar a ella. ¿Qué crees que debería devolver tu función en el caso que falla?',
    proactive:
      'Llevas un rato con la misma prueba. ¿Repasamos juntos qué devuelve tu función en ese caso?',
    start:
      'Empieza por escribir la función con su nombre y lo que recibe. Después, piensa: con el primer ejemplo de la tabla, ¿qué tendría que devolver?',
    statement:
      'Vamos por partes: ¿qué recibe tu función y qué tiene que devolver? Mira el primer ejemplo de la tabla e intenta explicarlo con tus palabras.',
    passed:
      '¡Tu código ya supera todas las pruebas! 🎉 ¿Se te ocurre algún caso que no comprueben? Si lo tienes claro, ya puedes entregarlo.',
  },
  en: {
    hints: {
      1: [
        'What value does your variable have before entering the loop?',
        'What happens with your code when the array is empty?',
        'Which number does your loop start counting from? And where does it end?',
      ],
      2: [
        'Look at the condition of the loop: it decides which values are visited and which are left out.',
        'Check the initial value of the accumulator: that is the key to the failing test.',
        'The edge case of the statement needs its own handling before the loop.',
      ],
      3: [
        'Change the limit of the loop so that it also includes the last value, and run the tests again.',
        'Start the accumulator at the neutral value of the operation and check the result again.',
        'First check whether the array is empty and, if so, return what the statement asks for.',
      ],
    },
    elusion:
      "Nice try 😉 I can't give you the solution, but I can help you get there. What do you think your function should return in the failing case?",
    proactive:
      "You've been on the same test for a while. Shall we go over together what your function returns in that case?",
    start:
      'Start by writing the function with its name and what it takes. Then think: with the first example of the table, what should it return?',
    statement:
      'One thing at a time: what does your function take and what must it return? Look at the first example of the table and try to explain it in your own words.',
    passed:
      'Your code already passes every test! 🎉 Can you think of a case they do not check? If it is clear to you, you can submit it now.',
  },
  ca: {
    hints: {
      1: [
        'Quin valor té la teva variable abans d’entrar al bucle?',
        'Què passa amb el teu codi quan el vector és buit?',
        'Des de quin nombre comença a comptar el teu bucle? I on acaba?',
      ],
      2: [
        'Fixa’t en la condició del bucle: decideix quins valors es recorren i quins es queden fora.',
        'Revisa el valor inicial de l’acumulador: aquí hi ha la clau de la prova que falla.',
        'El cas límit de l’enunciat necessita un tractament propi abans del recorregut.',
      ],
      3: [
        'Canvia el límit del bucle perquè inclogui també l’últim valor i torna a executar les proves.',
        'Comença l’acumulador amb el valor neutre de l’operació i comprova de nou el resultat.',
        'Comprova primer si el vector és buit i, en aquest cas, retorna el que demana l’enunciat.',
      ],
    },
    elusion:
      'Bon intent 😉 La solució no te la puc donar, però sí ajudar-te a arribar-hi. Què creus que hauria de retornar la teva funció en el cas que falla?',
    proactive:
      'Fa una estona que ets amb la mateixa prova. Repassem junts què retorna la teva funció en aquest cas?',
    start:
      'Comença per escriure la funció amb el seu nom i el que rep. Després, pensa: amb el primer exemple de la taula, què hauria de retornar?',
    statement:
      'Anem per parts: què rep la teva funció i què ha de retornar? Mira el primer exemple de la taula i intenta explicar-lo amb les teves paraules.',
    passed:
      'El teu codi ja supera totes les proves! 🎉 Se t’acut algun cas que no comprovin? Si ho tens clar, ja el pots lliurar.',
  },
};

/** The script of the past interactions of the fixtures, which took place in Spanish. */
export const PAST_SCRIPT = TUTOR_SCRIPTS.es;
