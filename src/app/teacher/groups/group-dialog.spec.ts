import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS, WEB_CLIENT_ID } from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { GroupDialog, type GroupDialogData } from './group-dialog';

const DAW: ManagedGroup = {
  group: GROUPS[0],
  subject: SUBJECTS[0],
  teacherName: 'Carmen',
  studentCount: 26,
  started: true,
};

const TEACHERS = [
  { id: TEACHER_ID, name: 'Carmen', email: 'carmen@tutoria.test' },
  { id: OTHER_TEACHER_ID, name: 'Javier', email: 'javier@tutoria.test' },
];

function open(data: Partial<GroupDialogData>, save = vi.fn<GroupDialogData['save']>()) {
  TestBed.inject(MatDialog).open<GroupDialog, GroupDialogData, boolean>(GroupDialog, {
    data: {
      managed: null,
      subjects: SUBJECTS,
      teachers: null,
      defaults: { schoolYear: '2026/27', subjectId: '', teacherId: TEACHER_ID },
      save,
      ...data,
    },
  });
  return save;
}

/** The dialog moves the focus in once open: typing before that loses the keys after the move. */
async function focused(dialog: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
}

describe('GroupDialog', () => {
  it('creates a group of the teacher, without a field for its teacher', async () => {
    const save = open({});
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo grupo' });
    await focused(dialog);
    expect(within(dialog).queryByRole('combobox', { name: 'Docente' })).toBeNull();

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), '2.º DAW A');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: SUBJECTS[2].name }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));

    expect(save).toHaveBeenCalledWith({
      name: '2.º DAW A',
      schoolYear: '2026/27',
      subjectId: WEB_CLIENT_ID,
      teacherId: TEACHER_ID,
    });
  });

  it('says what is missing, the teacher too for an administrator', async () => {
    const save = open({
      teachers: TEACHERS,
      defaults: { schoolYear: '', subjectId: '', teacherId: '' },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo grupo' });
    await focused(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));

    expect(within(dialog).getByText('Escribe el curso')).toBeTruthy();
    expect(within(dialog).getByText('Elige el docente')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('reads the subject of an existing group, and lets an administrator change its teacher', async () => {
    let fail!: (error: unknown) => void;
    const save = open(
      { managed: DAW, teachers: TEACHERS },
      vi.fn<GroupDialogData['save']>(() => new Promise((_, reject) => (fail = reject))),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Editar el grupo' });
    await focused(dialog);
    const subject = within(dialog).getByRole('textbox', { name: 'Asignatura' });
    expect(subject.hasAttribute('readonly')).toBe(true);
    expect(within(dialog).getByText(/no cambia de asignatura/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ teacherId: OTHER_TEACHER_ID }));
  });
});
