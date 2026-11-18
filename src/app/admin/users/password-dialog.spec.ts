import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { firstValueFrom } from 'rxjs';

import { DataError } from '../../data/data-error';
import { PasswordDialog, type PasswordDialogData } from './password-dialog';

describe('PasswordDialog', () => {
  let save: ReturnType<typeof vi.fn<PasswordDialogData['save']>>;
  let announce: ReturnType<typeof vi.spyOn>;

  async function open() {
    save = vi.fn<PasswordDialogData['save']>(() => Promise.resolve());
    const ref = TestBed.inject(MatDialog).open<PasswordDialog, PasswordDialogData, boolean>(
      PasswordDialog,
      { data: { name: 'Lucía Martín Gómez', save } },
    );
    announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
    const dialog = await screen.findByRole('dialog', { name: 'Restablecer la contraseña' });
    return {
      ref,
      dialog,
      field: within(dialog).getByLabelText('Contraseña nueva') as HTMLInputElement,
    };
  }

  it('generates a password and shows it, to read it and hand it over', async () => {
    const { dialog, field } = await open();
    expect(field.type).toBe('password');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Generar' }));

    expect(field.value).toHaveLength(12);
    expect(field.type).toBe('text');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ocultar la contraseña' }));
    expect(field.type).toBe('password');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mostrar la contraseña' }));
    expect(field.type).toBe('text');
  });

  it('copies the password and says so, until it changes', async () => {
    const { dialog, field } = await open();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const button = within(dialog).getByRole('button', { name: 'Copiar la contraseña' });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(field, 'contraseña');
    await userEvent.click(button);

    expect(copy).toHaveBeenCalledWith('contraseña');
    expect(announce).toHaveBeenCalledWith('Contraseña copiada');
    expect(button.textContent).toContain('check');
    await userEvent.type(field, 'x');
    expect(button.textContent).toContain('content_copy');
  });

  it('says when it could not copy it', async () => {
    const { dialog, field } = await open();
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);

    await userEvent.type(field, 'contraseña');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar la contraseña' }));

    expect(announce).toHaveBeenCalledWith('No se ha podido copiar: selecciónala y cópiala a mano');
  });

  it('asks for a password long enough', async () => {
    const { dialog, field } = await open();

    await userEvent.type(field, 'corta');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar la contraseña' }));

    expect(await within(dialog).findByText('Al menos 8 caracteres')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves it and closes, or stays open with the error', async () => {
    const { ref, dialog, field } = await open();
    let fail!: (error: unknown) => void;
    save.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));

    await userEvent.type(field, 'contraseña nueva');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar la contraseña' }));
    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('invalid'));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Esa contraseña no se admite',
    );

    const closed = firstValueFrom(ref.afterClosed());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar la contraseña' }));
    await expect(closed).resolves.toBe(true);
    expect(save).toHaveBeenLastCalledWith('contraseña nueva');
  });
});
