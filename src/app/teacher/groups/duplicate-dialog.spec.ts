import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CLASSES, GROUPS } from '../../data/mock/fixtures/users';
import { DuplicateDialog, type DuplicateDialogData } from './duplicate-dialog';

function managed(index: number, subject: number, studentCount: number): ManagedGroup {
  return {
    group: GROUPS[index],
    subject: SUBJECTS[subject],
    teacherName: 'Marta',
    studentCount,
    started: false,
    mine: true,
  };
}

/** Basic programming with its class, its split in English with one student, and web with none. */
const BASIC = managed(0, 0, 24);
const ENGLISH = managed(4, 0, 1);
const WEB = managed(2, 2, 0);

function open(save: DuplicateDialogData['save']) {
  const ref = TestBed.inject(MatDialog).open<DuplicateDialog, DuplicateDialogData, boolean>(
    DuplicateDialog,
    {
      data: {
        source: CLASSES[0],
        groups: [BASIC, ENGLISH, WEB],
        today: new Date(2026, 10, 19),
        save,
      },
    },
  );
  const closed = vi.fn();
  ref.afterClosed().subscribe(closed);
  return closed;
}

async function opened(): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name: 'Duplicar 1.º DAW A · 2026/27' });
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('DuplicateDialog', () => {
  it('copies every subject of the user into the next year, with its blocks and dates', async () => {
    const save = vi.fn<DuplicateDialogData['save']>(() => Promise.resolve());
    const closed = open(save);
    const dialog = await opened();

    expect(within(dialog).getByRole('textbox', { name: 'Nombre' })).toHaveProperty(
      'value',
      '1.º DAW A',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Curso' })).toHaveProperty(
      'value',
      '2027/28',
    );
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    expect(
      within(subjects)
        .getAllByRole('checkbox')
        .map((box) => [text(box.closest('mat-checkbox')), (box as HTMLInputElement).checked]),
    ).toEqual([
      ['Programación básica (24 alumnos)', true],
      ['Programación básica · Desdoble inglés (1 alumno)', true],
      ['Desarrollo web en entorno cliente (sin alumnos)', true],
    ]);
    expect(
      within(dialog).getByText(
        'Las fechas de apertura y entrega pasan a 2027/28, el mismo día de la semana.',
      ),
    ).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 3 asignaturas' }));

    expect(save).toHaveBeenCalledWith({
      name: '1.º DAW A',
      schoolYear: '2027/28',
      groupIds: [BASIC.group.id, ENGLISH.group.id, WEB.group.id],
      blocks: true,
      dates: true,
      students: false,
    });
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
  });

  it('asks for a subject at least, and keeps the order of the class', async () => {
    const save = vi.fn<DuplicateDialogData['save']>(() => Promise.resolve());
    open(save);
    const dialog = await opened();
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    const [basic, english, web] = within(subjects).getAllByRole('checkbox');

    for (const box of [basic, english, web]) await userEvent.click(box);
    expect(within(dialog).getByRole('alert').textContent).toContain(
      'Elige al menos una asignatura',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duplicar' }));
    expect(save).not.toHaveBeenCalled();

    await userEvent.click(web);
    await userEvent.click(basic);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 2 asignaturas' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ groupIds: [BASIC.group.id, WEB.group.id] }),
    );
  });

  it('says where the dates fall, and that they only go with the blocks', async () => {
    const save = vi.fn<DuplicateDialogData['save']>(() => Promise.resolve());
    open(save);
    const dialog = await opened();
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    await userEvent.click(within(subjects).getAllByRole('checkbox')[2]);

    const year = within(dialog).getByRole('textbox', { name: 'Curso' });
    await userEvent.clear(year);
    await userEvent.type(year, '2026');
    expect(within(dialog).getByText('Como 2026/27')).toBeTruthy();
    await userEvent.type(year, '/27');
    expect(within(dialog).queryByText('Como 2026/27')).toBeNull();
    expect(within(dialog).getByText('Las mismas fechas de apertura y entrega.')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Con sus fechas' }));
    expect(within(dialog).getByText(/sin fechas de apertura ni de entrega/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Sus bloques/ }));
    expect(within(dialog).getByRole('checkbox', { name: 'Con sus fechas' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(dialog).getByText('Solo con los bloques.')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Su alumnado/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 2 asignaturas' }));

    expect(save).toHaveBeenCalledWith({
      name: '1.º DAW A',
      schoolYear: '2026/27',
      groupIds: [BASIC.group.id, ENGLISH.group.id],
      blocks: false,
      dates: false,
      students: true,
    });
  });

  it('says what is missing, what it is doing and why it failed, and stays open', async () => {
    let fail!: (error: unknown) => void;
    const save = vi.fn<DuplicateDialogData['save']>(
      () => new Promise((_, reject) => (fail = reject)),
    );
    const closed = open(save);
    const dialog = await opened();

    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 3 asignaturas' }));
    expect(within(dialog).getByText('Escribe el nombre de la clase')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();

    await userEvent.type(name, '1.º DAW B');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 3 asignaturas' }));
    expect(await within(dialog).findByText('Duplicando…')).toBeTruthy();
    fail(new DataError('network'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '1.º DAW B' }));
    expect(closed).not.toHaveBeenCalled();
  });
});
