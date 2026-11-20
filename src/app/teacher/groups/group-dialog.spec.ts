import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { ManagedGroup } from '../../data/group-service';
import {
  ADVANCED_PROGRAMMING_ID,
  BASIC_PROGRAMMING_ID,
  SUBJECTS,
} from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { GroupDialog, type GroupDialogData } from './group-dialog';

const CLASS_NAME = '1.º DAW A · 2026/27';

function managed(index: number, subject = 0, teacherName = 'Marta'): ManagedGroup {
  return {
    group: GROUPS[index],
    subject: SUBJECTS[subject],
    teacherName,
    studentCount: 0,
    started: false,
    mine: true,
  };
}

/** The groups of 1.º DAW A: basic programming, its split in English and client web development. */
const BASIC = managed(0);
const WEB = managed(2, 2);
const ENGLISH = managed(4, 0, 'Javier');

const TEACHERS = [
  { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' },
  { id: OTHER_TEACHER_ID, name: 'Javier', email: 'javier@tutoria.test' },
];

function open(data: Partial<GroupDialogData>, save = vi.fn<GroupDialogData['save']>()) {
  const ref = TestBed.inject(MatDialog).open<GroupDialog, GroupDialogData, boolean>(GroupDialog, {
    data: {
      className: CLASS_NAME,
      managed: null,
      siblings: [BASIC, ENGLISH, WEB],
      subjects: SUBJECTS,
      teachers: null,
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

async function chooseSubject(dialog: HTMLElement, name: string): Promise<void> {
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
  await userEvent.click(await screen.findByRole('option', { name }));
}

describe('GroupDialog', () => {
  it('adds a subject the class does not have, without a label nor a field for its teacher', async () => {
    const { save, closed } = open({});
    const dialog = await opened(`Añadir una asignatura a ${CLASS_NAME}`);
    expect(within(dialog).queryByRole('combobox', { name: 'Docente' })).toBeNull();

    await chooseSubject(dialog, 'Programación avanzada');
    const label = within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' });
    expect(label).toHaveProperty('value', '');
    expect(within(dialog).getByText(/Opcional: para distinguir un desdoble/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));

    expect(save).toHaveBeenCalledWith({
      subjectId: ADVANCED_PROGRAMMING_ID,
      label: '',
      teacherId: TEACHER_ID,
    });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('starts a split of a subject the class has with the next label, and checks it', async () => {
    const { save } = open({});
    const dialog = await opened(`Añadir una asignatura a ${CLASS_NAME}`);

    await chooseSubject(dialog, 'Programación básica');
    const label = within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' });
    expect(label).toHaveProperty('value', 'Desdoble 3');
    expect(within(dialog).getByText(/La clase ya tiene esta asignatura. Sus alumnos/)).toBeTruthy();

    await userEvent.clear(label);
    await userEvent.tab();
    expect(within(dialog).getByText(/ponle un nombre al desdoble/)).toBeTruthy();
    await userEvent.type(label, 'Desdoble inglés');
    expect(within(dialog).getByText(/Ya hay un desdoble de esta asignatura/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    expect(save).not.toHaveBeenCalled();

    await userEvent.clear(label);
    await userEvent.type(label, 'Desdoble tarde');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    expect(save).toHaveBeenCalledWith({
      subjectId: BASIC_PROGRAMMING_ID,
      label: 'Desdoble tarde',
      teacherId: TEACHER_ID,
    });
  });

  it('says what is missing, the teacher too for an administrator', async () => {
    const { save } = open({ teachers: TEACHERS, teacherId: undefined });
    const dialog = await opened(`Añadir una asignatura a ${CLASS_NAME}`);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));

    expect(within(dialog).getByText('Elige la asignatura')).toBeTruthy();
    expect(within(dialog).getByText('Elige el docente')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('reads the subject of a group, and lets an administrator hand it over', async () => {
    let fail!: (error: unknown) => void;
    const { save, closed } = open(
      { managed: BASIC, siblings: [ENGLISH, WEB], teachers: TEACHERS },
      vi.fn<GroupDialogData['save']>(() => new Promise((_, reject) => (fail = reject))),
    );
    const dialog = await opened(`Editar ${CLASS_NAME} · Programación básica`);
    const subject = within(dialog).getByRole('textbox', { name: 'Asignatura' });
    expect(subject).toHaveProperty('value', 'Programación básica');
    expect(subject.hasAttribute('readonly')).toBe(true);
    expect(within(dialog).getByText(/no cambia de asignatura/)).toBeTruthy();
    // Editing is not a split: the hint of an optional label
    expect(within(dialog).getByText(/Opcional: para distinguir un desdoble/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(save).toHaveBeenCalledWith({
      subjectId: BASIC_PROGRAMMING_ID,
      label: '',
      teacherId: OTHER_TEACHER_ID,
    });
    expect(closed).not.toHaveBeenCalled();
  });

  it('shows the disabled teacher of a split, which cannot be chosen again', async () => {
    open({ managed: ENGLISH, siblings: [BASIC, WEB], teachers: [TEACHERS[0]] });
    const dialog = await opened(`Editar ${CLASS_NAME} · Programación básica`);
    expect(within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' })).toHaveProperty(
      'value',
      'Desdoble inglés',
    );

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    const disabled = await screen.findByRole('option', { name: 'Javier (cuenta desactivada)' });
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
  });
});
