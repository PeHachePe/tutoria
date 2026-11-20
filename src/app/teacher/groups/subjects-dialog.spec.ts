import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { ClassSubject } from '../../data/group-service';
import {
  ADVANCED_PROGRAMMING_ID,
  BASIC_PROGRAMMING_ID,
  SUBJECTS,
} from '../../data/mock/fixtures/subjects';
import { OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { SubjectsDialog, type SubjectsDialogData } from './subjects-dialog';

const CLASS_NAME = '1.º DAW A · 2026/27';
const TITLE = `Añadir asignaturas a ${CLASS_NAME}`;
const BASIC = 'Programación básica';
const ADVANCED = 'Programación avanzada';

/** 1.º DAW A: basic programming for the whole class, with a split in English. */
const WHOLE: ClassSubject = { subjectId: BASIC_PROGRAMMING_ID, label: null, teacherName: 'Marta' };
const ENGLISH: ClassSubject = {
  subjectId: BASIC_PROGRAMMING_ID,
  label: 'Desdoble inglés',
  teacherName: 'Javier',
};

const TEACHERS = [
  { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' },
  { id: OTHER_TEACHER_ID, name: 'Javier', email: 'javier@tutoria.test' },
];

/** The first three subjects of the seed: few enough to see them all. */
const FEW = SUBJECTS.slice(0, 3);

function open(data: Partial<SubjectsDialogData>, add = vi.fn<SubjectsDialogData['add']>()) {
  const ref = TestBed.inject(MatDialog).open<SubjectsDialog, SubjectsDialogData, boolean>(
    SubjectsDialog,
    {
      data: {
        className: CLASS_NAME,
        classSubjects: [WHOLE, ENGLISH],
        subjects: FEW,
        teachers: null,
        teacherId: TEACHER_ID,
        userName: () => 'Marta',
        add,
        ...data,
      },
    },
  );
  const closed = vi.fn();
  ref.afterClosed().subscribe(closed);
  return { add, closed };
}

async function opened(): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name: TITLE });
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

/** The checkbox of a subject in the list of the school. */
function subject(dialog: HTMLElement, name: string): HTMLElement {
  return within(within(dialog).getByRole('list', { name: 'Asignaturas' })).getByRole('checkbox', {
    name: new RegExp(`^${name}`),
  });
}

/** The row of a chosen subject. */
function chosen(dialog: HTMLElement, name: string): HTMLElement {
  const list = within(dialog).getByRole('list', { name: 'Elegidas' });
  return within(list)
    .getAllByRole('listitem')
    .find((row) => row.textContent?.includes(name))!;
}

function kind(row: HTMLElement, name: 'Toda la clase' | 'Desdoble'): HTMLElement {
  return within(row).getByRole('radio', { name });
}

function splitName(row: HTMLElement): HTMLElement | null {
  return within(row).queryByRole('textbox');
}

describe('SubjectsDialog', () => {
  it('adds groups of the whole class and splits at once, without a field for the teacher', async () => {
    const { add, closed } = open({});
    const dialog = await opened();
    expect(within(dialog).getByText('Asignaturas del centro (3)')).toBeTruthy();
    expect(within(dialog).queryByRole('combobox', { name: 'Docente' })).toBeNull();
    expect(within(dialog).getByText('La da Marta · solo como desdoble')).toBeTruthy();
    expect(within(dialog).queryByRole('list', { name: 'Elegidas' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Añadir (0)' })).toBeTruthy();

    // A new subject: the group of the whole class, which needs no name
    await userEvent.click(subject(dialog, ADVANCED));
    expect(within(dialog).getByText('Elegidas (1)')).toBeTruthy();
    expect(kind(chosen(dialog, ADVANCED), 'Toda la clase').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(splitName(chosen(dialog, ADVANCED))).toBeNull();
    // One the class has for the whole class: only a split, with the next name
    await userEvent.click(subject(dialog, BASIC));
    const basic = chosen(dialog, BASIC);
    expect(splitName(basic)).toHaveProperty('value', 'Desdoble 2');
    expect(splitName(basic)?.getAttribute('aria-label')).toBe(
      'Nombre del desdoble de Programación básica',
    );
    expect(kind(basic, 'Toda la clase').hasAttribute('disabled')).toBe(true);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (2)' }));

    expect(add.mock.calls).toEqual([
      [{ subjectId: BASIC_PROGRAMMING_ID, label: 'Desdoble 2', teacherId: TEACHER_ID }],
      [{ subjectId: ADVANCED_PROGRAMMING_ID, label: null, teacherId: TEACHER_ID }],
    ]);
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('makes a new subject a split, with its name, and back the group of the whole class', async () => {
    const { add } = open({});
    const dialog = await opened();
    await userEvent.click(subject(dialog, ADVANCED));

    await userEvent.click(kind(chosen(dialog, ADVANCED), 'Desdoble'));
    const name = splitName(chosen(dialog, ADVANCED))!;
    expect(name).toHaveProperty('value', 'Desdoble 1');
    await userEvent.clear(name);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (1)' }));
    expect(within(dialog).getByText('Ponle un nombre al desdoble')).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
    await userEvent.type(name, 'Desdoble inglés');

    // The name stays while it is a split; the group of the whole class has none
    await userEvent.click(kind(chosen(dialog, ADVANCED), 'Toda la clase'));
    expect(splitName(chosen(dialog, ADVANCED))).toBeNull();
    await userEvent.click(kind(chosen(dialog, ADVANCED), 'Desdoble'));
    expect(splitName(chosen(dialog, ADVANCED))).toHaveProperty('value', 'Desdoble 1');

    // Unchosen in the list, it starts again
    await userEvent.click(subject(dialog, ADVANCED));
    expect(within(dialog).queryByRole('list', { name: 'Elegidas' })).toBeNull();
    await userEvent.click(subject(dialog, ADVANCED));
    expect(kind(chosen(dialog, ADVANCED), 'Toda la clase').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('takes a chosen one out with its button, or all of them', async () => {
    open({});
    const dialog = await opened();
    await userEvent.click(subject(dialog, ADVANCED));
    await userEvent.click(subject(dialog, BASIC));

    await userEvent.click(within(dialog).getByRole('button', { name: `Quitar ${ADVANCED}` }));
    expect(subject(dialog, ADVANCED)).toHaveProperty('checked', false);
    expect(within(dialog).getByText('Elegidas (1)')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar todas' }));
    expect(subject(dialog, BASIC)).toHaveProperty('checked', false);
    expect(within(dialog).queryByRole('list', { name: 'Elegidas' })).toBeNull();
  });

  it('finds the subjects by name', async () => {
    open({ subjects: SUBJECTS });
    const dialog = await opened();
    const filter = within(dialog).getByRole('searchbox', { name: 'Filtrar' });

    await userEvent.type(filter, 'datos');
    const list = within(dialog).getByRole('list', { name: 'Asignaturas' });
    expect(
      within(list)
        .getAllByRole('checkbox')
        .map((box) => box.closest('li')?.textContent?.trim()),
    ).toEqual(['Bases de datos', 'Acceso a datos']);

    await userEvent.clear(filter);
    await userEvent.type(filter, 'nada así');
    expect(within(dialog).getByText('Ninguna asignatura coincide')).toBeTruthy();
  });

  it('offers the group of the whole class of a subject that only has a split', async () => {
    const { add } = open({ classSubjects: [ENGLISH] });
    const dialog = await opened();
    expect(within(dialog).getByText('Ya tiene un desdoble')).toBeTruthy();

    await userEvent.click(subject(dialog, BASIC));
    expect(kind(chosen(dialog, BASIC), 'Toda la clase').hasAttribute('disabled')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (1)' }));
    expect(add).toHaveBeenCalledWith({
      subjectId: BASIC_PROGRAMMING_ID,
      label: null,
      teacherId: TEACHER_ID,
    });
  });

  it('says that a subject is missing, and the teacher for an administrator', async () => {
    const { add } = open({ teachers: TEACHERS, teacherId: undefined });
    const dialog = await opened();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (0)' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('Elige alguna asignatura');
    expect(within(dialog).getByText('Elige el docente')).toBeTruthy();
    expect(add).not.toHaveBeenCalled();

    await userEvent.click(subject(dialog, ADVANCED));
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (1)' }));
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ teacherId: OTHER_TEACHER_ID }));
  });

  it('keeps what is left when one fails, and those added leave the chosen', async () => {
    const add = vi
      .fn<SubjectsDialogData['add']>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new DataError('network'));
    const { closed } = open({ classSubjects: [], teachers: TEACHERS, teacherId: TEACHER_ID }, add);
    const dialog = await opened();
    await userEvent.click(subject(dialog, BASIC));
    await userEvent.click(subject(dialog, ADVANCED));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (2)' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(closed).not.toHaveBeenCalled();
    // Basic programming is in the class now, with the teacher chosen: not chosen again
    expect(subject(dialog, BASIC)).toHaveProperty('checked', false);
    expect(within(dialog).getByText('La da Marta · solo como desdoble')).toBeTruthy();
    expect(subject(dialog, ADVANCED)).toHaveProperty('checked', true);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (1)' }));
    expect(add).toHaveBeenLastCalledWith({
      subjectId: ADVANCED_PROGRAMMING_ID,
      label: null,
      teacherId: TEACHER_ID,
    });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('says it is saving while it adds', async () => {
    let done!: () => void;
    const { closed } = open(
      {},
      vi.fn<SubjectsDialogData['add']>(() => new Promise<void>((resolve) => (done = resolve))),
    );
    const dialog = await opened();
    await userEvent.click(subject(dialog, ADVANCED));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (1)' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    done();
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('names a teacher who adds as the one who teaches it', async () => {
    const add = vi
      .fn<SubjectsDialogData['add']>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new DataError('network'));
    open({ classSubjects: [], userName: () => 'Lucas' }, add);
    const dialog = await opened();
    await userEvent.click(subject(dialog, BASIC));
    await userEvent.click(subject(dialog, ADVANCED));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir (2)' }));

    expect(await within(dialog).findByText('La da Lucas · solo como desdoble')).toBeTruthy();
  });
});
