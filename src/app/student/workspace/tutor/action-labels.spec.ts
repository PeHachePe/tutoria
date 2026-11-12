import type { ToolRequest } from '../../../data/tutor';
import type { ActionStatus } from '../tutor-store';
import { actionView, queriedText } from './action-labels';

const view = (call: ToolRequest, status: ActionStatus = 'done', result?: unknown) =>
  actionView({ call, status, result });
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
});
