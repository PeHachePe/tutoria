import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID } from '../../data/mock/fixtures/users';
import { DuplicateDialog, type DuplicateDialogData } from './duplicate-dialog';

const DAW: ManagedGroup = {
  group: GROUPS[0],
  subject: SUBJECTS[0],
  teacherName: 'Marta',
  studentCount: 1,
  started: true,
};

/** The teacher of the group is no longer active: an administrator chooses another. */
const JAVIER = { id: OTHER_TEACHER_ID, name: 'Javier', email: 'javier@tutoria.test' };

function open(save: DuplicateDialogData['save']): void {
  TestBed.inject(MatDialog).open<DuplicateDialog, DuplicateDialogData, boolean>(DuplicateDialog, {
    data: {
      source: DAW,
      classGroups: [DAW],
      teachers: [JAVIER],
      teacherId: undefined,
      today: new Date(2026, 10, 19),
      save,
    },
  });
}

describe('DuplicateDialog', () => {
  it('lets an administrator choose the teacher, says what is missing and what it is doing', async () => {
    const save = vi.fn<DuplicateDialogData['save']>(() => new Promise(() => undefined));
    open(save);
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(within(dialog).getByText('(1 alumno)')).toBeTruthy();

    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Nombre' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    expect(within(dialog).getByText('Escribe el nombre del grupo')).toBeTruthy();
    expect(within(dialog).getByText('Elige el docente')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), '1.º DAW B');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));

    expect(await within(dialog).findByText('Duplicando…')).toBeTruthy();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ name: '1.º DAW B', schoolYear: '2027/28', teacherId: JAVIER.id }),
    );
  });
});
