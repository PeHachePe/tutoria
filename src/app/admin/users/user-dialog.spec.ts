import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import { UserDialog, type UserDialogData } from './user-dialog';

describe('UserDialog', () => {
  it('creates an account, and stays open with what the server did not accept', async () => {
    let fail!: (error: unknown) => void;
    const save = vi.fn<UserDialogData['save']>(() => new Promise((_, reject) => (fail = reject)));
    TestBed.inject(MatDialog).open<UserDialog, UserDialogData, boolean>(UserDialog, {
      data: { user: null, takenEmails: () => new Set(), roleLock: null, save },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Nombre y apellidos' }),
      'Clara',
    );
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Correo' }), 'clara@b.es');
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), 'contraseña');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la cuenta' }));

    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('invalid'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('No se ha creado');
    expect(save).toHaveBeenCalledWith({
      name: 'Clara',
      email: 'clara@b.es',
      role: 'student',
      password: 'contraseña',
    });
  });
});
