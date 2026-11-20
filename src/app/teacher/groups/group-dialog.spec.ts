import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { classSubjectsOf } from './class-list';
import { GroupDialog, type GroupDialogData } from './group-dialog';

const CLASS_NAME = '1.º DAW A · 2026/27';
const TITLE = `Editar ${CLASS_NAME} · Programación básica`;

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
      managed: BASIC,
      classSubjects: classSubjectsOf([ENGLISH, WEB]),
      teachers: null,
      save,
      ...data,
    },
  });
  const closed = vi.fn();
  ref.afterClosed().subscribe(closed);
  return { save, closed };
}

async function opened(): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name: TITLE });
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

describe('GroupDialog', () => {
  it('names a split, reading its subject, without a field for the teacher', async () => {
    const { save, closed } = open({ managed: ENGLISH, classSubjects: classSubjectsOf([BASIC]) });
    const dialog = await opened();
    const subject = within(dialog).getByRole('textbox', { name: 'Asignatura' });
    expect(subject).toHaveProperty('value', 'Programación básica');
    expect(subject.hasAttribute('readonly')).toBe(true);
    expect(within(dialog).getByText(/no cambia de asignatura/)).toBeTruthy();
    expect(within(dialog).queryByRole('combobox', { name: 'Docente' })).toBeNull();

    const label = within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' });
    expect(label).toHaveProperty('value', 'Desdoble inglés');
    await userEvent.clear(label);
    await userEvent.tab();
    expect(within(dialog).getByText(/ponle un nombre al desdoble/)).toBeTruthy();
    await userEvent.type(label, 'Desdoble tarde');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(save).toHaveBeenCalledWith({ label: 'Desdoble tarde', teacherId: OTHER_TEACHER_ID });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('lets an administrator hand a group over, and says why it failed', async () => {
    let fail!: (error: unknown) => void;
    const { save, closed } = open(
      { teachers: TEACHERS },
      vi.fn<GroupDialogData['save']>(() => new Promise((_, reject) => (fail = reject))),
    );
    const dialog = await opened();
    expect(within(dialog).getByText(/Opcional: para distinguir un desdoble/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(save).toHaveBeenCalledWith({ label: '', teacherId: OTHER_TEACHER_ID });
    expect(closed).not.toHaveBeenCalled();
  });

  it('shows the disabled teacher of a split, which cannot be chosen again', async () => {
    open({
      managed: ENGLISH,
      classSubjects: classSubjectsOf([BASIC, WEB]),
      teachers: [TEACHERS[0]],
    });
    const dialog = await opened();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    const disabled = await screen.findByRole('option', { name: 'Javier (cuenta desactivada)' });
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
  });
});
