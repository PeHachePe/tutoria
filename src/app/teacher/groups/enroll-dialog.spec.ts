import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import { MAX_ENROLLMENT_BATCH, type UserRef } from '../../data/group-service';
import { EnrollDialog, type EnrollDialogData } from './enroll-dialog';

const STUDENTS: UserRef[] = [
  { id: 'a', name: 'Ana Ruiz', email: 'ana@tutoria.test' },
  { id: 'b', name: 'Bruno Sanz', email: 'bruno@tutoria.test' },
];

function open(overrides: Partial<EnrollDialogData> = {}) {
  const data: EnrollDialogData = {
    groupName: '1.º DAW A',
    enrolledIds: new Set(),
    sources: [],
    studentsOf: () => Promise.resolve([]),
    search: vi.fn(() => Promise.resolve(STUDENTS)),
    enroll: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  TestBed.inject(MatDialog).open<EnrollDialog, EnrollDialogData, boolean>(EnrollDialog, { data });
  return data;
}

async function typeSearch(text: string): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name: 'Matricular en 1.º DAW A' });
  // The dialog moves the focus in once open: typing before that loses the keys after the move
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  if (text) await userEvent.type(within(dialog).getByRole('searchbox'), text);
  return dialog;
}

describe('EnrollDialog', () => {
  it('does not search below the minimum', async () => {
    const data = open();
    const dialog = await typeSearch('a');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(data.search).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Escribe al menos dos letras')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Matricular (0)' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('chooses and removes, and enrolls the two chosen', async () => {
    let fail!: (error: unknown) => void;
    const data = open({
      enroll: vi.fn(() => new Promise<void>((_, reject) => (fail = reject))),
    });
    const dialog = await typeSearch('an');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar a Bruno Sanz' }));
    expect(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ })).toHaveProperty(
      'checked',
      false,
    );
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (2)' }));

    expect(data.search).toHaveBeenCalledWith('an');
    expect(data.enroll).toHaveBeenCalledWith([STUDENTS[0], STUDENTS[1]]);
    expect(await within(dialog).findByText('Matriculando…')).toBeTruthy();
    fail(new DataError('invalid'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('vuelve a buscarlo');
  });

  it('says nobody matches, and that the search failed', async () => {
    let calls = 0;
    open({
      search: () => (calls++ === 0 ? Promise.resolve([]) : Promise.reject(new Error('boom'))),
    });
    const dialog = await typeSearch('zz');
    // The visible text, not the count announced to screen readers, which starts the same
    expect(
      await within(dialog).findByText(
        'Ningún alumno coincide. Las cuentas las crea la administración.',
      ),
    ).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'z');
    expect(await within(dialog).findByText(/No se ha podido buscar/)).toBeTruthy();
  });

  it('chooses no more than a batch', async () => {
    const many = Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, (_, index) => ({
      id: `s${index}`,
      name: `Alumno ${index}`,
      email: `s${index}@tutoria.test`,
    }));
    open({ search: () => Promise.resolve(many) });
    const dialog = await typeSearch('al');
    const boxes = await within(dialog).findAllByRole('checkbox');
    for (const box of boxes.slice(0, MAX_ENROLLMENT_BATCH)) await userEvent.click(box);
    expect(within(dialog).getByText(/Como mucho 50 de una vez/)).toBeTruthy();
    expect(boxes[MAX_ENROLLMENT_BATCH]).toHaveProperty('disabled', true);
  }, 30_000);

  it('chooses the students of another group who are not in this one, or says it could not', async () => {
    let calls = 0;
    open({
      enrolledIds: new Set(['a']),
      sources: [{ id: 'web', label: '1.º DAW A · Web' }],
      studentsOf: () =>
        calls++ === 0 ? Promise.resolve(STUDENTS) : Promise.reject(new Error('boom')),
    });
    const dialog = await typeSearch('');
    const copy = async () => {
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Añadir los de otro grupo' }),
      );
      await userEvent.click(await screen.findByRole('menuitem', { name: '1.º DAW A · Web' }));
    };

    await copy();
    expect(await within(dialog).findByRole('button', { name: 'Matricular (1)' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Quitar a Bruno Sanz' })).toBeTruthy();

    await copy();
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'No se ha podido leer ese grupo',
    );
  });
});
