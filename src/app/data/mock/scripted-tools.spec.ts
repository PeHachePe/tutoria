import type { ContentLocale } from '../localized-text';
import { TUTOR_SCRIPTS } from './fixtures/tutor-script';
import { scriptedTools } from './scripted-tools';

const PROGRESS = {
  name: 'getMyProgress',
  arguments: {},
  result: {
    subjects: [{ subject: 'Programación básica' }, { subject: 'Desarrollo web' }],
    total: { pending: 12, submitted: 3, assigned: 15 },
  },
};

describe('scriptedTools', () => {
  it('asks for the progress first, and answers with it', () => {
    expect(scriptedTools('¿Cuántos ejercicios me quedan?', undefined, 'es')).toEqual({
      queries: [{ name: 'getMyProgress', arguments: {} }],
    });
    expect(scriptedTools('¿Qué asignaturas tengo?', undefined, 'es')).toEqual({
      queries: [{ name: 'getMyProgress', arguments: {} }],
    });
    expect(scriptedTools('¿Cuántos me quedan?', [PROGRESS], 'es')).toEqual({
      text: 'Estás en Programación básica, Desarrollo web. Te quedan 12 de 15 ejercicios: ya has entregado 3. ¡A por el siguiente!',
      actions: [],
    });
  });

  it('asks for the stats of the exercise about errors and attempts, and answers with them', () => {
    expect(scriptedTools('¿Cuántos errores llevo?', undefined, 'es')).toEqual({
      queries: [{ name: 'getExerciseStats', arguments: {} }],
    });
    const stats = {
      name: 'getExerciseStats',
      arguments: {},
      result: { runs: 4, failedRuns: 3, hints: 2 },
    };
    expect(scriptedTools('How many mistakes?', [stats], 'en')?.valueOf()).toEqual({
      text: 'In this exercise you have run the tests 4 times, 3 with some failure, and asked for 2 hints. Every failure taught you something.',
      actions: [],
    });
  });

  it('says it cannot look the data up when the query failed, never making them up', () => {
    const failed = { ...PROGRESS, result: { error: 'offline' } };
    expect(scriptedTools('¿Cuántos me quedan?', [failed], 'ca')).toEqual({
      text: 'Ara mateix no puc consultar les teves dades. Prova-ho d’aquí a una estona.',
      actions: [],
    });
    expect(scriptedTools('¿Cuántos me quedan?', [{ ...PROGRESS, result: null }], 'es')).toEqual(
      expect.objectContaining({ actions: [] }),
    );
  });

  it('offers the next exercise, or searches one by its topic and offers it', () => {
    expect(scriptedTools('Llévame al siguiente', undefined, 'es')).toEqual({
      text: 'Te dejo el botón para ir al siguiente que te queda.',
      actions: [{ name: 'openExercise', arguments: { exercise: 'next' } }],
    });
    expect(scriptedTools('Ponme otro ejercicio de bucles', undefined, 'es')).toEqual({
      queries: [{ name: 'searchExercises', arguments: { text: 'bucles', status: 'pending' } }],
    });
    expect(scriptedTools('Open another exercise', undefined, 'en')).toEqual({
      queries: [{ name: 'searchExercises', arguments: { status: 'pending' } }],
    });
    const found = {
      name: 'searchExercises',
      arguments: {},
      result: { exercises: [{ id: 'a-2', title: 'Contar los pares' }] },
    };
    expect(scriptedTools('Ponme otro de bucles', [found], 'es')).toEqual({
      text: 'He encontrado «Contar los pares». Pulsa el botón cuando quieras abrirlo.',
      actions: [{ name: 'openExercise', arguments: { exercise: 'a-2' } }],
    });
    const none = { ...found, result: { exercises: [] } };
    expect(scriptedTools('Ponme otro de química', [none], 'es')).toEqual({
      text: 'No he encontrado ningún ejercicio así entre los tuyos. ¿Lo buscamos con otras palabras?',
      actions: [],
    });
  });

  it('changes the theme and offers the change of language', () => {
    expect(scriptedTools('Pon el modo oscuro', undefined, 'es')).toEqual({
      text: 'Hecho: he cambiado el tema. Si no te convence, puedes deshacerlo.',
      actions: [{ name: 'updateSettings', arguments: { theme: 'dark' } }],
    });
    expect(scriptedTools('Light mode, please', undefined, 'en')?.valueOf()).toEqual(
      expect.objectContaining({
        actions: [{ name: 'updateSettings', arguments: { theme: 'light' } }],
      }),
    );
    expect(scriptedTools('Ponlo en inglés', undefined, 'es')).toEqual({
      text: 'Para cambiar el idioma, pulsa el botón: la página se volverá a cargar.',
      actions: [{ name: 'updateSettings', arguments: { language: 'en' } }],
    });
  });

  it('marks the line asked for, the first without one', () => {
    expect(scriptedTools('Resalta la línea 3', undefined, 'es')).toEqual({
      text: 'Te he marcado la línea 3 en el editor: ¿qué hace exactamente?',
      actions: [
        { name: 'highlightLines', arguments: { lines: [{ line: 3, note: 'Revisa esta línea' }] } },
      ],
    });
    expect(scriptedTools('Highlight it', undefined, 'en')).toEqual(
      expect.objectContaining({
        actions: [
          { name: 'highlightLines', arguments: { lines: [{ line: 1, note: 'Check this line' }] } },
        ],
      }),
    );
  });

  it('offers the settings, and does nothing with anything else', () => {
    expect(scriptedTools('Llévame a los ajustes', undefined, 'es')).toEqual({
      text: 'Te dejo el botón para ir a los ajustes.',
      actions: [{ name: 'navigate', arguments: { to: 'settings' } }],
    });
    expect(scriptedTools('¿Qué es un bucle?', undefined, 'es')).toBeNull();
  });

  describe('what only our tutor does (2.5f)', () => {
    const code = (text: string, status: 'in_progress' | 'passed' = 'in_progress') => ({
      code: text,
      functionName: 'sum',
      status,
    });
    const SLIP = 'function sum(v) {\n  retrun 0;\n}';

    it('proposes the fix of a slip of writing, never of the logic', () => {
      expect(scriptedTools('Arréglame el código', undefined, 'es', code(SLIP))).toEqual({
        text: 'En la línea 2 hay un despiste de escritura. Pulsa «Aplicar» y lo corrijo; fíjate en qué cambia.',
        actions: [{ name: 'proposeFix', arguments: { line: 2, code: '  return 0;' } }],
      });
      const logic = scriptedTools(
        'fix my code',
        undefined,
        'en',
        code('function sum(v) {\n  return 1;\n}'),
      );
      expect(logic).toEqual({ text: TUTOR_SCRIPTS.en.tools.noFix, actions: [] });
    });

    it('offers to format, to run and to submit, only what passed', () => {
      expect(scriptedTools('Formatea mi código', undefined, 'es', code(SLIP))).toEqual({
        text: TUTOR_SCRIPTS.es.tools.format,
        actions: [{ name: 'formatCode', arguments: {} }],
      });
      expect(scriptedTools('Ejecuta las pruebas', undefined, 'es', code(SLIP))).toEqual({
        text: TUTOR_SCRIPTS.es.tools.run,
        actions: [{ name: 'runTests', arguments: {} }],
      });
      expect(scriptedTools('Entrégalo', undefined, 'es', code(SLIP, 'passed'))).toEqual({
        text: TUTOR_SCRIPTS.es.tools.submit,
        actions: [{ name: 'submitAttempt', arguments: {} }],
      });
      expect(scriptedTools('submit it', undefined, 'en', code(SLIP))).toEqual({
        text: TUTOR_SCRIPTS.en.tools.notPassed,
        actions: [{ name: 'runTests', arguments: {} }],
      });
    });

    it('has nothing to fix without the code', () => {
      expect(scriptedTools('corrígelo', undefined, 'ca')).toEqual({
        text: TUTOR_SCRIPTS.ca.tools.noFix,
        actions: [],
      });
    });
  });

  it('says it all in the three languages', () => {
    for (const language of ['es', 'en', 'ca'] satisfies ContentLocale[]) {
      const progress = scriptedTools('¿Cuántos me quedan?', [PROGRESS], language);
      expect(progress && 'text' in progress && progress.text).toContain('12');
      const stats = scriptedTools(
        '¿Cuántos errores?',
        [{ name: 'getExerciseStats', arguments: {}, result: { runs: 1, failedRuns: 1, hints: 0 } }],
        language,
      );
      expect(stats && 'text' in stats && stats.text).toContain('1');
      const found = scriptedTools(
        'ponme otro',
        [
          {
            name: 'searchExercises',
            arguments: {},
            result: { exercises: [{ id: 'x', title: 'T' }] },
          },
        ],
        language,
      );
      expect(found && 'text' in found && found.text).toContain('T');
      const marked = scriptedTools('resalta la linea 2', undefined, language);
      expect(marked && 'text' in marked && marked.text).toContain('2');
      const fixed = scriptedTools('arregla', undefined, language, {
        code: 'function f() {\n  retrun 1;\n}',
        functionName: 'f',
        status: 'in_progress',
      });
      expect(fixed && 'text' in fixed && fixed.text).toContain('2');
    }
  });
});
