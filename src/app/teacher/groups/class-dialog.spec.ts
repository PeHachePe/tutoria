import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import {
  ADVANCED_PROGRAMMING_ID,
  SUBJECTS,
  WEB_CLIENT_ID,
} from '../../data/mock/fixtures/subjects';
import { CLASSES, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { ClassDialog, type ClassDialogData } from './class-dialog';

const TEACHERS = [
  { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' },
  { id: OTHER_TEACHER_ID, name: 'Javier', email: 'javier@tutoria.test' },
];

function open(data: Partial<ClassDialogData>, save = vi.fn<ClassDialogData['save']>()) {
  const ref = TestBed.inject(MatDialog).open<ClassDialog, ClassDialogData, boolean>(ClassDialog, {
    data: {
      schoolClass: null,
      classes: CLASSES,
      subjects: SUBJECTS,
      teachers: null,
      schoolYear: '2026/27',
      teacherId: TEACHER_ID,
      save,
      ...data,
    },
  });
  const closed = vi.fn();
  ref.afterClosed().subscribe(closed);
  return { save, closed };
}

/** The dialog, once it moved the focus in: typing before that loses the keys after the move. */
async function opened(name: string): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name });
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

/** Chooses subjects in the list, which stays open until Escape. */
async function pickSubjects(dialog: HTMLElement, ...names: string[]): Promise<void> {
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Tus asignaturas en ella' }));
  for (const name of names) await userEvent.click(await screen.findByRole('option', { name }));
  await userEvent.keyboard('{Escape}');
}

describe('ClassDialog', () => {
  it('creates a class with the subjects of the teacher, without a field for the teacher', async () => {
    const { save, closed } = open({});
    const dialog = await opened('Nueva clase');
    expect(within(dialog).getByText(/Un grupo en cada una/)).toBeTruthy();
    expect(within(dialog).queryByRole('combobox', { name: 'Docente' })).toBeNull();

    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    expect(within(dialog).getByText(/Como 1.º DAW A. La comparten/)).toBeTruthy();
    await pickSubjects(dialog, 'Programación avanzada', 'Desarrollo web en entorno cliente');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));

    expect(save).toHaveBeenCalledWith({
      name: '2.º DAW A',
      schoolYear: '2026/27',
      subjectIds: [ADVANCED_PROGRAMMING_ID, WEB_CLIENT_ID],
      teacherId: TEACHER_ID,
    });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('suggests the classes of the year, and joins the one chosen with a subject at least', async () => {
    const { save } = open({});
    const dialog = await opened('Nueva clase');
    const name = within(dialog).getByRole('combobox', { name: 'Nombre' });

    await userEvent.type(name, 'daw');
    const suggestions = await screen.findAllByRole('option');
    expect(suggestions.map((option) => option.textContent?.trim())).toEqual(['1.º DAW A']);
    await userEvent.click(suggestions[0]);
    expect(name).toHaveProperty('value', '1.º DAW A');
    expect(within(dialog).getByText(/Esta clase ya existe/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir mis asignaturas' }));
    expect(within(dialog).getByText('Elige las asignaturas que das en ella')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();

    await pickSubjects(dialog, 'Programación avanzada');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir mis asignaturas' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ name: '1.º DAW A', subjectIds: [ADVANCED_PROGRAMMING_ID] }),
    );
  });

  it('suggests nothing of another year', async () => {
    open({ schoolYear: '2027/28' });
    const dialog = await opened('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '1.º DAW A');
    expect(screen.queryByRole('option')).toBeNull();
    expect(within(dialog).queryByText(/Esta clase ya existe/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Crear la clase' })).toBeTruthy();
  });

  it('lets an administrator choose the teacher of the subjects, and says why it failed', async () => {
    let fail!: (error: unknown) => void;
    const { save, closed } = open(
      { teachers: TEACHERS, teacherId: undefined },
      vi.fn<ClassDialogData['save']>(() => new Promise((_, reject) => (fail = reject))),
    );
    const dialog = await opened('Nueva clase');

    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    await pickSubjects(dialog, 'Programación avanzada');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));
    expect(within(dialog).getByText('Elige el docente')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));
    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ teacherId: OTHER_TEACHER_ID }));
    expect(closed).not.toHaveBeenCalled();
  });

  it('edits the name and year of a class, without subjects nor suggestions', async () => {
    const { save, closed } = open({
      schoolClass: CLASSES[0],
      classes: [],
      subjects: [],
      teacherId: undefined,
    });
    const dialog = await opened('Editar la clase');
    expect(within(dialog).queryByRole('combobox', { name: 'Tus asignaturas en ella' })).toBeNull();
    expect(within(dialog).queryByText(/La comparten/)).toBeNull();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveProperty('value', '1.º DAW A');

    await userEvent.clear(name);
    await userEvent.tab();
    expect(within(dialog).getByText('Escribe el nombre de la clase')).toBeTruthy();
    const year = within(dialog).getByRole('textbox', { name: 'Curso' });
    await userEvent.clear(year);
    expect(within(dialog).getByText('Como 2026/27')).toBeTruthy();
    await userEvent.type(year, '2026/27');
    expect(within(dialog).queryByText('Como 2026/27')).toBeNull();
    await userEvent.type(name, '1.º DAW Z');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(save).toHaveBeenCalledWith({
      name: '1.º DAW Z',
      schoolYear: '2026/27',
      subjectIds: [],
      teacherId: '',
    });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });
});
