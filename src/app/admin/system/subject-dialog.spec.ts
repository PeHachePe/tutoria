import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { Subject } from '../../data/subject';
import { SubjectDialog, type SubjectDialogData } from './subject-dialog';

async function openDialog(data: SubjectDialogData, name: string) {
  const ref = TestBed.inject(MatDialog).open<SubjectDialog, SubjectDialogData, boolean>(
    SubjectDialog,
    { data },
  );
  const dialog = await screen.findByRole('dialog', { name });
  // The dialog moves the focus in once open: typing before that loses the keys after the move
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return { ref, dialog };
}

const WEB: Subject = { id: 's', name: 'Web', sourceLocale: 'es', translations: {} };

describe('SubjectDialog', () => {
  it('creates a subject with a translation, and stays open if it fails', async () => {
    let fail!: (error: unknown) => void;
    const save = vi.fn<SubjectDialogData['save']>(
      () => new Promise((_, reject) => (fail = reject)),
    );
    const { dialog } = await openDialog(
      { subject: null, subjects: [WEB], locale: 'es', save },
      'Nueva asignatura',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la asignatura' }));
    expect(save).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Escribe el nombre de la asignatura')).toBeTruthy();

    // A name another subject has, with other capitals, is not saved either
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    await userEvent.type(name, 'web');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la asignatura' }));
    expect(save).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Ya hay una asignatura con ese nombre')).toBeTruthy();
    await userEvent.clear(name);

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Bases de datos');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Nombre en inglés' }),
      'Databases',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la asignatura' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('unavailable'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('No se ha podido');
    expect(save).toHaveBeenCalledWith({
      name: 'Bases de datos',
      sourceLocale: 'es',
      translations: { en: { name: 'Databases' } },
    });
  });

  it('edits a subject and closes', async () => {
    const save = vi.fn<SubjectDialogData['save']>(() => Promise.resolve());
    const { ref, dialog } = await openDialog(
      {
        subject: WEB,
        // Its own name is not taken
        subjects: [WEB],
        locale: 'en',
        save,
      },
      'Editar la asignatura',
    );
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), ' 1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
    expect(save).toHaveBeenCalledWith({
      id: 's',
      name: 'Web 1',
      sourceLocale: 'es',
      translations: {},
    });
  });
});
