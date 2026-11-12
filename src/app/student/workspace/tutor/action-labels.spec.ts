import type { ToolRequest } from '../../../data/tutor';
import type { ActionStatus } from '../tutor-store';
import { actionView, queriedText } from './action-labels';

const view = (call: ToolRequest, status: ActionStatus = 'done', result?: unknown, code?: string) =>
  actionView({ call, status, result }, code);
const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  arguments: args,
});

describe('queriedText', () => {
  it('says what the tutor looked up, leaving out what it does not know', () => {
    expect(queriedText(['getMyProgress', 'searchExercises', 'unknown'])).toBe(
      'Ha consultado tu progreso, tus ejercicios',
    );
    expect(queriedText(['getExerciseStats', 'getSettings'])).toBe(
      'Ha consultado tus intentos, tus ajustes',
    );
    expect(queriedText([])).toBe('');
  });
});

describe('actionView', () => {
  it('says what the tutor marked or pointed at', () => {
    const marks = (lines: number[]) =>
      call('highlightLines', { lines: lines.map((line) => ({ line })) });
    expect(view(marks([3]))).toEqual({
      kind: 'note',
      icon: 'check',
      text: 'He marcado la línea 3 del código',
      undo: false,
    });
    expect(view(marks([3, 5])).kind === 'note' && view(marks([3, 5]))).toEqual(
      expect.objectContaining({ text: 'He marcado las líneas 3, 5 del código' }),
    );
    expect(view(marks([]))).toEqual(
      expect.objectContaining({ text: 'He quitado las marcas del código' }),
    );
    expect(view(call('pointAt', { target: 'example', example: 2 }))).toEqual(
      expect.objectContaining({ text: 'Te señalo el ejemplo 2' }),
    );
    expect(view(call('pointAt', { target: 'failingTest' }))).toEqual(
      expect.objectContaining({ text: 'Te señalo la prueba que falla' }),
    );
    expect(view(call('pointAt', { target: 'hiddenTests' }))).toEqual(
      expect.objectContaining({ text: 'Te señalo las comprobaciones ocultas' }),
    );
    expect(view(call('setLayout', { codeExpanded: true }))).toEqual(
      expect.objectContaining({ text: 'He cambiado la disposición de la pantalla' }),
    );
  });

  it('names the theme it changed, and offers to undo it', () => {
    const theme = call('updateSettings', { theme: 'dark' });
    expect(
      view(theme, 'done', { changed: { theme: 'dark' }, previous: { theme: 'light' } }),
    ).toEqual({ kind: 'note', icon: 'check', text: 'Tema oscuro', undo: true });
    expect(view(call('updateSettings', { theme: 'light' }), 'done', { changed: {} })).toEqual({
      kind: 'note',
      icon: 'check',
      text: 'Ya lo tenías así',
      undo: false,
    });
    expect(view(call('updateSettings', { theme: 'system' }), 'done')).toEqual(
      expect.objectContaining({ text: 'Tema del sistema' }),
    );
    expect(view(call('updateSettings', { theme: 'dark', proactive: false }), 'done')).toEqual(
      expect.objectContaining({ text: 'He cambiado tus ajustes' }),
    );
    expect(view(theme, 'undone')).toEqual({
      kind: 'note',
      icon: 'undo',
      text: 'Ajustes como estaban',
      undo: false,
    });
  });

  it('offers a button for what changes the page, while it waits', () => {
    expect(view(call('openExercise', { exercise: 'next' }), 'pending')).toEqual({
      kind: 'button',
      icon: 'arrow_forward',
      text: 'Abrir el siguiente ejercicio',
    });
    expect(
      view(call('openExercise', { exercise: '60000000-0000-4000-8000-000000000114' }), 'running'),
    ).toEqual(expect.objectContaining({ text: 'Abrir el ejercicio' }));
    expect(view(call('openExercise', { exercise: 'bucles' }), 'pending')).toEqual(
      expect.objectContaining({ text: 'Abrir «bucles»' }),
    );
    expect(view(call('navigate', { to: 'settings' }), 'pending')).toEqual({
      kind: 'button',
      icon: 'settings',
      text: 'Ir a los ajustes',
    });
    expect(view(call('updateSettings', { language: 'en' }), 'pending')).toEqual({
      kind: 'button',
      icon: 'translate',
      text: 'Cambiar el idioma a inglés',
      hint: 'La página se vuelve a cargar',
    });
    expect(view(call('pointAt', { target: 'hiddenTests' }), 'pending')).toEqual({
      kind: 'button',
      icon: 'play_arrow',
      text: 'Te señalo las comprobaciones ocultas',
    });
  });

  it('says what it did once done, what failed, and what it offered in an earlier visit', () => {
    expect(view(call('openExercise', { exercise: 'next' }))).toEqual(
      expect.objectContaining({ text: 'Ejercicio abierto' }),
    );
    expect(view(call('navigate', { to: 'data' }))).toEqual(
      expect.objectContaining({ text: 'Ver mis datos registrados' }),
    );
    expect(view(call('openExercise', { exercise: 'next' }), 'failed')).toEqual(
      expect.objectContaining({ text: 'No se ha podido hacer: Abrir el siguiente ejercicio' }),
    );
    expect(view(call('highlightLines', { lines: [] }), 'failed')).toEqual(
      expect.objectContaining({ text: 'No se ha podido hacer: He quitado las marcas del código' }),
    );
    expect(view(call('navigate', { to: 'catalog' }), 'failed')).toEqual({
      kind: 'failed',
      text: 'No se ha podido hacer: Ir a los ejercicios',
    });
    expect(view(call('navigate', { to: 'catalog' }), 'past')).toEqual({
      kind: 'note',
      icon: 'history',
      text: 'Te propuso: Ir a los ejercicios',
    });
    expect(view(call('highlightLines', { lines: [{ line: 1 }] }), 'past')).toEqual(
      expect.objectContaining({ icon: 'check', text: 'He marcado la línea 1 del código' }),
    );
    expect(view(call('somethingElse', {}))).toEqual(
      expect.objectContaining({ text: 'somethingElse' }),
    );
  });

  describe('what only our tutor does (2.5f)', () => {
    const SLIP = 'function f(a) {\n  retrun a\n}';
    const fix = (line: number, code: string, insert?: boolean) =>
      call('proposeFix', { line, code, ...(insert ? { insert } : {}) });

    it('offers a button for each, which says what it does', () => {
      expect(view(call('insertSkeleton', { parameters: ['a'] }), 'pending')).toEqual({
        kind: 'button',
        icon: 'add',
        text: 'Poner la función en el editor',
      });
      expect(view(call('formatCode', {}), 'pending')).toEqual(
        expect.objectContaining({ text: 'Formatear el código' }),
      );
      expect(view(call('runTests', {}), 'running')).toEqual(
        expect.objectContaining({ text: 'Ejecutar las pruebas' }),
      );
      expect(view(call('submitAttempt', {}), 'pending')).toEqual(
        expect.objectContaining({ icon: 'send', text: 'Entregar el ejercicio' }),
      );
    });

    it('shows what a fix changes, so the student sees the slip', () => {
      expect(view(fix(2, '  return a'), 'pending', undefined, SLIP)).toEqual({
        kind: 'button',
        icon: 'auto_fix_high',
        text: 'Aplicar la corrección',
        hint: 'Línea 2: retrun → return',
      });
      expect(view(fix(2, '  retrun a;'), 'pending', undefined, SLIP)).toEqual(
        expect.objectContaining({ hint: 'Línea 2: falta ;' }),
      );
      expect(view(fix(3, ''), 'running', undefined, SLIP)).toEqual(
        expect.objectContaining({ hint: 'Línea 3: sobra }' }),
      );
      expect(view(fix(4, '}', true), 'running', undefined, SLIP)).toEqual(
        expect.objectContaining({ hint: 'Línea 4: falta }' }),
      );
      // Running, a line no longer there shows just the button
      expect(view(fix(9, '}'), 'running', undefined, SLIP)).toEqual({
        kind: 'button',
        icon: 'auto_fix_high',
        text: 'Aplicar la corrección',
      });
    });

    it('says when the student fixed it already, or changed the code since', () => {
      const fixed = SLIP.replace('retrun', 'return');
      expect(view(fix(2, '  return a'), 'pending', undefined, fixed)).toEqual({
        kind: 'note',
        icon: 'check',
        text: 'Ya lo has corregido tú',
      });
      expect(view(fix(9, '}'), 'pending', undefined, SLIP)).toEqual({
        kind: 'note',
        icon: 'info',
        text: 'Tu código ha cambiado: esta corrección ya no encaja',
      });
    });

    it('says what each did once done', () => {
      expect(view(call('insertSkeleton', { parameters: [] }))).toEqual(
        expect.objectContaining({ text: 'Función puesta en el editor' }),
      );
      expect(view(call('formatCode', {}), 'done', { formatted: true })).toEqual(
        expect.objectContaining({ text: 'Código formateado' }),
      );
      expect(view(call('formatCode', {}), 'done', { formatted: false })).toEqual(
        expect.objectContaining({ text: 'Tu código ya estaba ordenado' }),
      );
      expect(view(call('runTests', {}), 'done', { passed: 3, total: 5 })).toEqual(
        expect.objectContaining({ text: 'Pruebas ejecutadas: 3 de 5 superadas' }),
      );
      expect(view(call('runTests', {}), 'done', { loaded: false })).toEqual(
        expect.objectContaining({
          text: 'Pruebas ejecutadas: el código no se ha podido ejecutar',
        }),
      );
      expect(view(call('runTests', {}))).toEqual(
        expect.objectContaining({ text: 'Pruebas ejecutadas' }),
      );
      expect(view(call('submitAttempt', {}), 'done', { submitted: true })).toEqual(
        expect.objectContaining({ text: 'Ejercicio entregado' }),
      );
      expect(view(call('submitAttempt', {}), 'done', { submitted: false })).toEqual(
        expect.objectContaining({ text: 'Has seguido revisando: no se ha entregado' }),
      );
      expect(view(fix(2, '  return a'), 'done', { line: 2 })).toEqual(
        expect.objectContaining({ icon: 'check', text: 'Línea 2 corregida' }),
      );
      expect(view(fix(2, '  return a'), 'failed', undefined, SLIP)).toEqual({
        kind: 'failed',
        text: 'No se ha podido hacer: Aplicar la corrección',
      });
      expect(view(call('runTests', {}), 'past')).toEqual(
        expect.objectContaining({ text: 'Te propuso: Ejecutar las pruebas' }),
      );
    });
  });
});
