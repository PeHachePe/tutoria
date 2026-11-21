import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { firstValueFrom } from 'rxjs';

import { MAX_CREATE_BATCH } from '../../data/admin/user-rules';
import { AdminService, type CreateStudentsResult, type NewStudent } from '../../data/admin-service';
import { DataError } from '../../data/data-error';
import { GroupService, type ManagedClass, MAX_PASTED_LINES } from '../../data/group-service';
import type { AppUser, SchoolClass } from '../../data/user';
import { PRINTING_CLASS } from './credentials-sheet';
import { NewStudentsDialog, type NewStudentsDialogData } from './new-students-dialog';

const NOW = '2026-11-21T08:00:00Z';

function account(email: string, status: AppUser['status'] = 'active'): AppUser {
  return {
    id: `id-${email}`,
    name: `Cuenta ${email}`,
    email,
    role: 'student',
    status,
    privacyNoticeSeenAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function managed(id: string, name: string, schoolYear: string, open = true): ManagedClass {
  const schoolClass: SchoolClass = {
    id,
    name,
    schoolYear,
    createdBy: null,
    createdAt: NOW,
    reopened: false,
  };
  return { schoolClass, groups: [], canEdit: true, open };
}

/** Classes of the year of the tests and the next, one closed and one of a past year. */
const CLASSES = [
  managed('daw', '1.º DAW A', '2026/27'),
  managed('next', '1.º DAM A', '2027/28'),
  managed('dam', '1.º DAM A', '2026/27'),
  managed('past', '2.º DAW A', '2025/26', false),
  managed('reopened', '2.º DAM A', '2025/26'),
];

/** Lucía has an account, Raúl a disabled one. */
const USERS = [account('lucia@x.es'), account('raul@x.es', 'disabled')];

/** What the function answers: every student created, as a student. */
function createdAll(students: readonly NewStudent[]): Promise<CreateStudentsResult> {
  return Promise.resolve({
    created: students.map(({ name, email }) => ({ ...account(email), id: `id-${email}`, name })),
    existing: [],
    failed: [],
  });
}

describe('NewStudentsDialog', () => {
  let createStudents: ReturnType<typeof vi.fn<AdminService['createStudents']>>;
  let listClasses: ReturnType<typeof vi.fn<GroupService['listClasses']>>;
  let enrollInClass: ReturnType<typeof vi.fn<GroupService['enrollInClass']>>;

  beforeEach(() => {
    createStudents = vi.fn<AdminService['createStudents']>(createdAll);
    listClasses = vi.fn<GroupService['listClasses']>(() => Promise.resolve(CLASSES));
    enrollInClass = vi.fn<GroupService['enrollInClass']>(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: { createStudents } },
        { provide: GroupService, useValue: { listClasses, enrollInClass } },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function open() {
    const ref = TestBed.inject(MatDialog).open<NewStudentsDialog, NewStudentsDialogData, number>(
      NewStudentsDialog,
      { data: { users: USERS } },
    );
    const dialog = await screen.findByRole('dialog', { name: 'Alta de varios alumnos' });
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return { ref, dialog, closed: firstValueFrom(ref.afterClosed()) };
  }

  async function paste(dialog: HTMLElement, text: string): Promise<void> {
    const box = within(dialog).getByRole('textbox', { name: 'Nombre y correo, uno por línea' });
    await userEvent.click(box);
    await userEvent.paste(text);
  }

  function button(dialog: HTMLElement, name: string | RegExp): HTMLButtonElement {
    return within(dialog).getByRole('button', { name });
  }

  async function check(dialog: HTMLElement, text: string): Promise<void> {
    await paste(dialog, text);
    await userEvent.click(button(dialog, 'Comprobar la lista'));
  }

  function lines(count: number): string {
    return Array.from({ length: count }, (_, n) => `Alumno ${n};alumno${n}@x.es`).join('\n');
  }

  it('checks the list before creating anything: what is created and why the rest is not', async () => {
    const { dialog } = await open();
    expect(button(dialog, 'Comprobar la lista').disabled).toBe(true);

    await check(
      dialog,
      [
        'Nombre;Correo',
        'GARCÍA LÓPEZ, ANA;ana@x.es',
        'Lucía;lucia@x.es',
        'Raúl;raul@x.es',
        'Ana otra vez;ANA@x.es',
      ].join('\n'),
    );

    expect(within(dialog).getByRole('status').textContent).toMatch(
      /Se crea 1 cuenta de alumno\s*·\s*4 líneas se quedan fuera/,
    );
    const skipped = within(dialog).getByRole('region', { name: 'No se crean' });
    expect(skipped.textContent).toContain('Nombre;Correo');
    expect(skipped.textContent).toContain('Línea 1 · Sin un correo válido');
    expect(skipped.textContent).toContain('Lucía · lucia@x.es');
    expect(skipped.textContent).toContain('Ya tiene una cuenta');
    expect(skipped.textContent).toContain('Tiene una cuenta desactivada: actívala en la lista');
    expect(skipped.textContent).toContain('Repetido en la lista');
    const created = within(dialog).getByRole('region', { name: 'Se crean' });
    expect(created.textContent).toContain('Ana García López');
    expect(createStudents).not.toHaveBeenCalled();

    // Back to the text, as it was
    await userEvent.click(button(dialog, 'Volver a la lista'));
    expect(
      (within(dialog).getByRole('textbox', { name: /Nombre y correo/ }) as HTMLTextAreaElement)
        .value,
    ).toContain('GARCÍA LÓPEZ');
  });

  it('creates nothing when no line can be created, and says nothing is left out', async () => {
    const { dialog } = await open();

    await check(dialog, 'Lucía;lucia@x.es');
    expect(within(dialog).getByRole('status').textContent).toMatch(
      /No se crea ninguna cuenta\s*·\s*1 línea se queda fuera/,
    );
    expect(button(dialog, /Crear/).disabled).toBe(true);
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    await userEvent.click(button(dialog, 'Volver a la lista'));
    await userEvent.clear(within(dialog).getByRole('textbox', { name: /Nombre y correo/ }));
    await check(dialog, 'Ana;ana@x.es\nBea;bea@x.es');
    expect(within(dialog).getByRole('status').textContent?.trim()).toBe(
      'Se crean 2 cuentas de alumno',
    );
    expect(within(dialog).queryByRole('region', { name: 'No se crean' })).toBeNull();
  });

  it('takes no more lines than a list may have', async () => {
    const { dialog } = await open();

    await paste(dialog, lines(MAX_PASTED_LINES + 1));

    expect(within(dialog).getByRole('alert').textContent).toContain(
      `Como mucho ${MAX_PASTED_LINES} líneas`,
    );
    expect(button(dialog, 'Comprobar la lista').disabled).toBe(true);
  });

  it('creates the accounts in parts, enrolls them in the class chosen and shows the passwords', async () => {
    let release!: () => void;
    createStudents.mockImplementationOnce(
      (students) => new Promise((resolve) => (release = () => void resolve(createdAll(students)))),
    );
    const { dialog, closed } = await open();
    await check(dialog, lines(MAX_CREATE_BATCH + 1));

    // Open classes of this year or later, by year and name
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Matricular en una clase' }),
    );
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Sin matricular',
      '1.º DAM A · 2026/27',
      '1.º DAW A · 2026/27',
      '1.º DAM A · 2027/28',
    ]);
    await userEvent.click(options[2]);
    await userEvent.click(button(dialog, `Crear ${MAX_CREATE_BATCH + 1} cuentas`));

    expect(
      (await within(dialog).findByText(/Creando las cuentas/)).textContent?.replace(/\s+/g, ' '),
    ).toContain(`0 de ${MAX_CREATE_BATCH + 1}`);
    expect(button(dialog, 'Creando…').disabled).toBe(true);
    release();

    expect(
      (await within(dialog).findByText(/cuentas creadas/)).parentElement?.textContent?.replace(
        /\s+/g,
        ' ',
      ),
    ).toContain(`${MAX_CREATE_BATCH + 1} cuentas creadas y matriculadas en 1.º DAW A · 2026/27`);
    expect(createStudents.mock.calls.map(([part]) => part.length)).toEqual([MAX_CREATE_BATCH, 1]);
    const sent = createStudents.mock.calls.flatMap(([part]) => part);
    expect(sent[0]).toMatchObject({ name: 'Alumno 0', email: 'alumno0@x.es' });
    expect(new Set(sent.map(({ password }) => password)).size).toBe(sent.length);
    expect(enrollInClass).toHaveBeenCalledWith(
      'daw',
      sent.map(({ email }) => `id-${email}`),
    );
    const list = within(dialog).getByRole('list', { name: 'Cuentas creadas' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(MAX_CREATE_BATCH + 1);
    expect(list.textContent).toContain(sent[0].password);

    // Saved once, it closes without asking, with how many it created
    vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await userEvent.click(button(dialog, 'Imprimir las tiras'));
    expect(document.documentElement.classList.contains(PRINTING_CLASS)).toBe(true);
    expect(document.title).toBe('Credenciales 1.º DAW A 2026-27');
    window.dispatchEvent(new Event('afterprint'));
    await userEvent.click(button(dialog, 'Cerrar'));
    await expect(closed).resolves.toBe(MAX_CREATE_BATCH + 1);
  });

  it('downloads the passwords as a CSV named after the day without a class', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
    );
    const { dialog, closed } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));

    expect((await within(dialog).findByText(/1 cuenta creada/)).textContent).not.toContain(
      'matriculadas',
    );
    await userEvent.click(button(dialog, 'Descargar CSV'));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe(`Credenciales ${new Date().toISOString().slice(0, 10)}.csv`);
    expect(enrollInClass).not.toHaveBeenCalled();
    await userEvent.click(button(dialog, 'Cerrar'));
    await expect(closed).resolves.toBe(1);
    vi.unstubAllGlobals();
  });

  it('asks before closing without saving the passwords, also with Escape or outside', async () => {
    const { dialog, closed } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));
    await within(dialog).findByText(/1 cuenta creada/);

    await userEvent.keyboard('{Escape}');
    let confirm = await screen.findByRole('dialog', {
      name: '¿Cerrar sin guardar las contraseñas?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await vi.waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));

    // Another key does nothing
    await userEvent.keyboard('a');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    confirm = await screen.findByRole('dialog', { name: '¿Cerrar sin guardar las contraseñas?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cerrar sin guardarlas' }));
    await expect(closed).resolves.toBe(1);
  });

  it('closes at once with nothing created, and not while it creates', async () => {
    let release!: () => void;
    createStudents.mockImplementationOnce(
      (students) => new Promise((resolve) => (release = () => void resolve(createdAll(students)))),
    );
    const first = await open();
    await userEvent.click(button(first.dialog, 'Cancelar'));
    await expect(first.closed).resolves.toBe(0);

    const { dialog, closed } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));
    await within(dialog).findByText(/Creando las cuentas/);
    await userEvent.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    release();
    expect(await within(dialog).findByText(/1 cuenta creada/)).toBeTruthy();
    void closed;
  });

  it('keeps what was created when a part fails, and retries the rest', async () => {
    createStudents
      .mockImplementationOnce(createdAll)
      .mockRejectedValueOnce(new DataError('network'));
    const { dialog } = await open();
    await check(dialog, lines(MAX_CREATE_BATCH + 2));
    await userEvent.click(button(dialog, `Crear ${MAX_CREATE_BATCH + 2} cuentas`));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Sin conexión');
    expect(alert.textContent).toContain('Faltan 2 por crear.');
    expect(within(dialog).getByText(`${MAX_CREATE_BATCH} cuentas creadas`)).toBeTruthy();

    createStudents.mockImplementationOnce((students) =>
      Promise.resolve({
        created: [],
        existing: [students[0].email],
        failed: [students[1].email],
      }),
    );
    await userEvent.click(button(dialog, 'Reintentar los que faltan'));
    expect(
      await within(dialog).findByText(/Ya tenían cuenta, no se ha cambiado nada: alumno25@x.es/),
    ).toBeTruthy();
    expect(within(dialog).getByText(/No se pudieron crear: alumno26@x.es/)).toBeTruthy();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('says when a single account is left to create', async () => {
    createStudents.mockRejectedValueOnce(new DataError('network'));
    const { dialog } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Falta 1 por crear.');
    expect(within(dialog).queryByRole('button', { name: 'Descargar CSV' })).toBeNull();
  });

  it('enrolls again when enrolling failed', async () => {
    enrollInClass.mockRejectedValueOnce(new DataError('network'));
    const { dialog } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Matricular en una clase' }),
    );
    await userEvent.click(await screen.findByRole('option', { name: '1.º DAW A · 2026/27' }));
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'no se pudieron matricular en 1.º DAW A',
    );
    await userEvent.click(button(dialog, 'Volver a matricular'));
    expect(
      (await within(dialog).findByText(/matriculada en/)).textContent?.replace(/\s+/g, ' '),
    ).toContain('1.º DAW A · 2026/27');
    expect(enrollInClass).toHaveBeenCalledTimes(2);
  });

  it('enrolls nobody when every account already existed', async () => {
    createStudents.mockImplementationOnce((students) =>
      Promise.resolve({ created: [], existing: students.map(({ email }) => email), failed: [] }),
    );
    const { dialog, closed } = await open();
    await check(dialog, 'Ana;ana@x.es');
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Matricular en una clase' }),
    );
    await userEvent.click(await screen.findByRole('option', { name: '1.º DAW A · 2026/27' }));
    await userEvent.click(button(dialog, 'Crear 1 cuenta'));

    expect(await within(dialog).findByText(/Ya tenían cuenta/)).toBeTruthy();
    expect(enrollInClass).not.toHaveBeenCalled();
    // Nothing to save: it closes without asking
    await userEvent.click(button(dialog, 'Cerrar'));
    await expect(closed).resolves.toBe(0);
  });

  it('offers no class when they cannot be read', async () => {
    listClasses.mockRejectedValueOnce(new DataError('network'));
    const { dialog } = await open();

    await check(dialog, 'Ana;ana@x.es');

    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(button(dialog, 'Crear 1 cuenta').disabled).toBe(false);
  });
});
