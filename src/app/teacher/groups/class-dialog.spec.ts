import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { SchoolClassEntry } from '../../data/group-service';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { CLASSES } from '../../data/mock/fixtures/users';
import { ClassDialog, type ClassDialogData } from './class-dialog';

/** The classes of the seed; 1.º DAW A has basic programming and its split, 1.º DAM B nothing. */
const ENTRIES: SchoolClassEntry[] = CLASSES.map((schoolClass, index) => ({
  schoolClass,
  groups:
    index === 0
      ? [
          { subjectId: BASIC_PROGRAMMING_ID, label: null, teacherName: 'Marta Ibáñez Soler' },
          {
            subjectId: BASIC_PROGRAMMING_ID,
            label: 'Desdoble inglés',
            teacherName: 'Javier Ortega Ruiz',
          },
          { subjectId: 'other', label: null, teacherName: 'Marta Ibáñez Soler' },
        ]
      : [],
}));

function open(data: Partial<ClassDialogData>, save = vi.fn<ClassDialogData['save']>()) {
  const ref = TestBed.inject(MatDialog).open<ClassDialog, ClassDialogData, SchoolClassEntry | true>(
    ClassDialog,
    {
      data: { schoolClass: null, classes: ENTRIES, schoolYear: '2026/27', save, ...data },
    },
  );
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

describe('ClassDialog', () => {
  it('creates a class of this year by default, for its subjects to be chosen next', async () => {
    const { save, closed } = open({});
    const dialog = await opened('Añadir una clase');
    expect(
      within(dialog)
        .getByRole('radio', { name: 'Este curso (2026/27)' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    expect(within(dialog).getByText(/Como 1.º DAW A. La comparten/)).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );

    expect(save).toHaveBeenCalledWith({ name: '2.º DAW A', schoolYear: '2026/27' });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('creates a class for the next year, never typing it', async () => {
    const { save } = open({});
    const dialog = await opened('Añadir una clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'El que viene (2027/28)' }));
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );
    expect(save).toHaveBeenCalledWith({ name: '2.º DAW A', schoolYear: '2027/28' });
  });

  it('asks for the name', async () => {
    const { save } = open({});
    const dialog = await opened('Añadir una clase');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );
    expect(within(dialog).getByText('Escribe el nombre de la clase')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('suggests the classes of the year, and joins the one chosen without saving', async () => {
    const { save, closed } = open({});
    const dialog = await opened('Añadir una clase');
    const name = within(dialog).getByRole('combobox', { name: 'Nombre' });

    await userEvent.type(name, 'daw');
    const suggestions = await screen.findAllByRole('option');
    expect(suggestions.map((option) => option.textContent?.trim())).toEqual(['1.º DAW A']);
    await userEvent.click(suggestions[0]);
    expect(name).toHaveProperty('value', '1.º DAW A');
    // Each teacher once
    expect(
      within(dialog).getByText(
        'Esta clase ya existe (la dan Marta Ibáñez Soler, Javier Ortega Ruiz): únete con tus asignaturas.',
      ),
    ).toBeTruthy();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Unirme y elegir asignaturas' }),
    );
    expect(save).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(ENTRIES[0]));
  });

  it('says that a class without subjects exists too', async () => {
    open({});
    const dialog = await opened('Añadir una clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '1.º dam b');
    await userEvent.keyboard('{Escape}');
    expect(
      within(dialog).getByText('Esta clase ya existe, sin asignaturas: únete con las tuyas.'),
    ).toBeTruthy();
  });

  it('suggests nothing of another year', async () => {
    open({});
    const dialog = await opened('Añadir una clase');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'El que viene (2027/28)' }));
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '1.º DAW A');
    expect(screen.queryByRole('option')).toBeNull();
    expect(within(dialog).queryByText(/Esta clase ya existe/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' })).toBeTruthy();
  });

  it('says why it failed, and stays open', async () => {
    let fail!: (error: unknown) => void;
    const { closed } = open(
      {},
      vi.fn<ClassDialogData['save']>(() => new Promise((_, reject) => (fail = reject))),
    );
    const dialog = await opened('Añadir una clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );
    expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(closed).not.toHaveBeenCalled();
  });

  it('edits only the name of a class, which keeps its year', async () => {
    const { save, closed } = open({ schoolClass: CLASSES[0], classes: [] });
    const dialog = await opened('Editar la clase');
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).queryByText(/La comparten/)).toBeNull();
    expect(within(dialog).getByText(/Curso 2026\/27: no cambia/)).toBeTruthy();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveProperty('value', '1.º DAW A');

    await userEvent.clear(name);
    await userEvent.tab();
    expect(within(dialog).getByText('Escribe el nombre de la clase')).toBeTruthy();
    await userEvent.type(name, '1.º DAW Z');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(save).toHaveBeenCalledWith({ name: '1.º DAW Z', schoolYear: '2026/27' });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });
});
