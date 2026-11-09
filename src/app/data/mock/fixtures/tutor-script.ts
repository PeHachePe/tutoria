import type { HintLevel } from '../../tutor';

/**
 * What the scripted tutor says (4.3): the past interactions of the fixtures and the mock tutor of the
 * workspace use the same texts. They are server data, written in Spanish like the prompt of 2.6, so
 * they are not translated: the real tutor will answer in the language of the request (D-033).
 */

/** Hints by level (2.6): a guiding question, the concept or the zone, and the concrete step. */
export const TUTOR_ANSWERS: Record<HintLevel, readonly string[]> = {
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
};

/** To a student who tries to get the solution: no solution, and a question that makes them think. */
export const ELUSION_ANSWER =
  'Buen intento 😉 La solución no te la puedo dar, pero sí ayudarte a llegar a ella. ¿Qué crees que debería devolver tu función en el caso que falla?';

/** The tutor steps in on its own (2.7). */
export const PROACTIVE_MESSAGE =
  'Llevas un rato con la misma prueba. ¿Repasamos juntos qué devuelve tu función en ese caso?';

/** A question with the code still empty. */
export const START_ANSWER =
  'Empieza por escribir la función con su nombre y lo que recibe. Después, piensa: con el primer ejemplo de la tabla, ¿qué tendría que devolver?';

/** A question about the statement. */
export const STATEMENT_ANSWER =
  'Vamos por partes: ¿qué recibe tu función y qué tiene que devolver? Mira el primer ejemplo de la tabla e intenta explicarlo con tus palabras.';

/** A question once every test passes. */
export const PASSED_ANSWER =
  '¡Tu código ya supera todas las pruebas! 🎉 ¿Se te ocurre algún caso que no comprueben? Si lo tienes claro, ya puedes entregarlo.';
