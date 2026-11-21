import { TestBed } from '@angular/core/testing';
import { withoutHistory } from '../../data/mock/fixtures/history';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { provideLocalizedPaginator } from '../../core/i18n/localized-paginator-intl';
import { AdminService } from '../../data/admin-service';
import { DataError } from '../../data/data-error';
import {
  ADMIN_ID,
  DAW_CLASS_ID,
  DAW_STUDENT_IDS,
  DISABLED_STUDENT_ID,
  USERS,
} from '../../data/mock/fixtures/users';
import { MockAdminService } from '../../data/mock/mock-admin-service';
import { MockDb } from '../../data/mock/mock-db';
import { MockNetwork } from '../../data/mock/mock-network';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { UsersPage } from './users-page';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Every account of the seed but Raúl, who is disabled. */
const ACTIVE = USERS.length - 1;

/** The first student of 1.º DAW A, enrolled in its two groups. */
const LUCIA = USERS[3];

/** Her row alone: by name she is not on the first page. */
const LUCIA_URL = '/admin/usuarios?buscar=lucia';

describe('UsersPage', () => {
  let service: MockAdminService;

  async function renderUsers(
    url = '/admin/usuarios',
    prepare: (db: MockDb) => void = () => undefined,
  ) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'admin/usuarios', component: UsersPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideLocalizedPaginator(),
        provideSessionOf('admin', { id: ADMIN_ID }),
        MockAdminService,
        { provide: AdminService, useExisting: MockAdminService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(ADMIN_ID);
    // This year alone: the classes and students of the years before are not what these test
    withoutHistory(TestBed.inject(MockDb));
    prepare(TestBed.inject(MockDb));
    service = TestBed.inject(MockAdminService);
    await restoreSession();
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);
    return harness;
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  /** The rows of the table, without its header. */
  function rows(): HTMLElement[] {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }

  function rowOf(name: string): HTMLElement {
    const row = rows().find((candidate) => text(candidate).includes(name));
    if (!row) throw new Error(`No row for ${name}`);
    return row;
  }

  async function openAction(name: string, action: string): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: `Acciones de ${name}` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: new RegExp(action) }));
  }

  async function openedDialog(): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return dialog;
  }

  async function closed(): Promise<void> {
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }

  afterEach(() => localStorage.clear());

  it('lists a page of the active accounts by name, with their role and groups', async () => {
    await renderUsers();

    expect(screen.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeTruthy();
    expect(screen.getByText(`${ACTIVE} cuentas`)).toBeTruthy();
    expect(rows()).toHaveLength(10);
    for (const part of ['Administración TutorIA', 'Tú', 'admin@tutoria.test', 'Sin grupos']) {
      expect(text(rows()[0])).toContain(part);
    }
    expect(text(rows()[1])).toContain('Adrián López Vidal');
    expect(text(rows()[1])).toContain('Alumnado');
    expect(text(rows()[1])).toContain('1.º DAW A');
    expect(screen.queryByText('Raúl Medina Cortés')).toBeNull();
  });

  it('turns the page through the URL and takes the focus back to the table', async () => {
    const harness = await renderUsers();

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/admin/usuarios?pagina=2');
    expect(text(rows()[0])).not.toContain('Administración TutorIA');
    expect(screen.getByRole('table').parentElement).toBe(document.activeElement);

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios');
  });

  it('sorts by the headers of the table, starting again at the first page', async () => {
    const harness = await renderUsers('/admin/usuarios?pagina=2');

    await userEvent.click(screen.getByRole('button', { name: 'Rol' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios');
    expect(text(rows()[0])).toContain('Alumnado');

    await userEvent.click(screen.getByRole('button', { name: 'Rol' }));
    await settle(harness);
    expect(text(rows()[0])).toContain('Administración TutorIA');
    expect(text(rows()[1])).toContain('Javier Ortega Ruiz');
  });

  it('searches and filters by role in the URL, starting again at the first page', async () => {
    const harness = await renderUsers('/admin/usuarios?pagina=2');

    await userEvent.type(screen.getByRole('searchbox'), 'ibanez');
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios?buscar=ibanez');
    expect(rows()).toHaveLength(1);
    expect(screen.getByText(`1 cuenta de ${ACTIVE}`)).toBeTruthy();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Profesorado' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios?rol=teacher');
    expect(rows().map((row) => text(row).split(' ')[0])).toEqual(['Javier', 'Marta']);

    await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Todos los roles' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios');
  });

  it('reads the filters from the URL, and shows the accounts of each status', async () => {
    const harness = await renderUsers('/admin/usuarios?rol=student&buscar=medina');

    // A disabled account matches: it says so, not that it does not exist (5.2g)
    expect(screen.getByText('Ningún usuario coincide con este estado')).toBeTruthy();
    expect(
      screen.getByText('Ninguna cuenta activa coincide, pero una desactivada sí.'),
    ).toBeTruthy();
    expect(screen.getByText(`Ninguna cuenta de ${ACTIVE}`)).toBeTruthy();

    await userEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Desactivadas' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(
      '/admin/usuarios?rol=student&buscar=medina&estado=desactivadas',
    );
    expect(text(rowOf('Raúl Medina Cortés'))).toContain('Desactivada');
    expect(screen.getByText('1 cuenta de 1')).toBeTruthy();

    await userEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Todas' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toContain('estado=todas');
    expect(rows()).toHaveLength(1);

    await userEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Activas' }));
    await settle(harness);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar los filtros' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios');
    expect(rows()).toHaveLength(10);
  });

  it('creates an account with a generated password, in its place, and says so', async () => {
    const harness = await renderUsers();
    const open = vi.spyOn(MatSnackBar.prototype, 'open');
    const createUser = vi.spyOn(service, 'createUser');

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await openedDialog();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Nombre y apellidos' }),
      'Aaron Abad',
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Correo' }),
      'aaron@tutoria.test',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la cuenta' }));
    await closed();
    await settle(harness);

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Aaron Abad', email: 'aaron@tutoria.test', role: 'student' }),
    );
    expect(createUser.mock.calls[0][0].password).toHaveLength(12);
    expect(text(rows()[0])).toContain('Aaron Abad');
    expect(screen.getByText(`${ACTIVE + 1} cuentas`)).toBeTruthy();
    expect(open).toHaveBeenCalledWith('Cuenta creada. Entrégale la contraseña en persona.');
  });

  it('tells an email that already has an account before sending it', async () => {
    await renderUsers();
    const createUser = vi.spyOn(service, 'createUser');

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await openedDialog();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Nombre y apellidos' }),
      'Lucía',
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Correo' }),
      'LUCIA.MARTIN@tutoria.test',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la cuenta' }));

    expect(await within(dialog).findByText('Ese correo ya tiene una cuenta')).toBeTruthy();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('changes the name of an account in its row, and sends nothing without changes', async () => {
    const harness = await renderUsers(LUCIA_URL);
    const open = vi.spyOn(MatSnackBar.prototype, 'open');
    const updateUser = vi.spyOn(service, 'updateUser');

    await openAction(LUCIA.name, 'Editar');
    let dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    expect(updateUser).not.toHaveBeenCalled();

    await openAction(LUCIA.name, 'Editar');
    dialog = await openedDialog();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre y apellidos' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Lucía Martín');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    await settle(harness);

    expect(updateUser).toHaveBeenCalledWith(LUCIA.id, { name: 'Lucía Martín' });
    expect(text(rowOf('Lucía Martín'))).toContain('1.º DAW A');
    expect(open).toHaveBeenCalledWith('Cambios guardados');
  });

  it('locks the role with its reason: the own one and that of someone with groups', async () => {
    const harness = await renderUsers();

    await openAction('Administración TutorIA', 'Editar');
    let dialog = await openedDialog();
    expect(
      within(dialog).getByRole('combobox', { name: 'Rol' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(text(dialog)).toContain('No puedes quitarte tu propio rol');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();

    await userEvent.type(screen.getByRole('searchbox'), 'lucia');
    await settle(harness);
    await openAction(LUCIA.name, 'Editar');
    dialog = await openedDialog();
    expect(text(dialog)).toContain('Tiene matrícula en 1.º DAW A');
  });

  it('changes the role of someone without groups', async () => {
    const harness = await renderUsers(LUCIA_URL, (db) =>
      db.update('enrollments', (rows) => rows.filter((row) => row.userId !== LUCIA.id)),
    );

    await openAction(LUCIA.name, 'Editar');
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Rol' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Profesorado' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    await settle(harness);

    expect(text(rowOf(LUCIA.name))).toContain('Profesorado');
  });

  it('keeps the dialog open with the error, and reloads the list, when saving fails', async () => {
    const harness = await renderUsers(LUCIA_URL);
    vi.spyOn(service, 'updateUser').mockRejectedValueOnce(new DataError('invalid'));
    const listUsers = vi.spyOn(service, 'listUsers');

    await openAction(LUCIA.name, 'Editar');
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre y apellidos' }), ' B');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(text(await within(dialog).findByRole('alert'))).toContain('No se puede cambiar el rol');
    await settle(harness);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('resets a password and says to hand it over', async () => {
    await renderUsers(LUCIA_URL);
    const open = vi.spyOn(MatSnackBar.prototype, 'open');
    const updateUser = vi.spyOn(service, 'updateUser');

    await openAction(LUCIA.name, 'Restablecer la contraseña');
    const dialog = await openedDialog();
    expect(text(dialog)).toContain(`La contraseña de ${LUCIA.name} cambia`);
    await userEvent.type(within(dialog).getByLabelText('Contraseña nueva'), 'nueva contraseña');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar la contraseña' }));
    await closed();

    expect(updateUser).toHaveBeenCalledWith(LUCIA.id, { password: 'nueva contraseña' });
    expect(open).toHaveBeenCalledWith('Contraseña cambiada. Entrégasela en persona.');
  });

  it('keeps the password when the dialog is cancelled', async () => {
    await renderUsers(LUCIA_URL);
    const updateUser = vi.spyOn(service, 'updateUser');

    await openAction(LUCIA.name, 'Restablecer la contraseña');
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();

    expect(updateUser).not.toHaveBeenCalled();
  });

  describe('disabling and enabling', () => {
    it('asks first, and the account leaves the list of the active ones', async () => {
      const harness = await renderUsers(LUCIA_URL);
      const open = vi.spyOn(MatSnackBar.prototype, 'open');

      await openAction(LUCIA.name, 'Desactivar');
      let dialog = await openedDialog();
      expect(text(dialog)).toContain(`${LUCIA.name} dejará de poder entrar`);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed();
      expect(rows()).toHaveLength(1);

      await openAction(LUCIA.name, 'Desactivar');
      dialog = await openedDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
      await closed();
      await settle(harness);

      expect(screen.getByText(`Ninguna cuenta de ${ACTIVE - 1}`)).toBeTruthy();
      expect(screen.queryByText(LUCIA.name)).toBeNull();
      expect(open).toHaveBeenCalledWith(`Cuenta de ${LUCIA.name} desactivada`);
    });

    it('enables a disabled account without asking', async () => {
      const harness = await renderUsers('/admin/usuarios?estado=todas&buscar=raul');
      const open = vi.spyOn(MatSnackBar.prototype, 'open');

      await openAction('Raúl Medina Cortés', 'Activar');
      await settle(harness);

      expect(text(rowOf('Raúl Medina Cortés'))).not.toContain('Desactivada');
      expect(
        TestBed.inject(MockDb)
          .tables()
          .users.find((user) => user.id === DISABLED_STUDENT_ID),
      ).toMatchObject({ status: 'active' });
      expect(open).toHaveBeenCalledWith('Cuenta de Raúl Medina Cortés activada');
    });

    it('never disables the own account, and says why', async () => {
      await renderUsers();
      const updateUser = vi.spyOn(service, 'updateUser');

      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones de Administración TutorIA' }),
      );
      const item = await screen.findByRole('menuitem', { name: /Desactivar/ });
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(text(item)).toContain('No puedes desactivar tu propia cuenta');
      await userEvent.click(item);

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('says why it failed and reloads the list', async () => {
      const harness = await renderUsers(LUCIA_URL);
      const open = vi.spyOn(MatSnackBar.prototype, 'open');
      vi.spyOn(service, 'updateUser').mockRejectedValueOnce(new DataError('network'));
      const listUsers = vi.spyOn(service, 'listUsers');

      await openAction(LUCIA.name, 'Desactivar');
      const dialog = await openedDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
      await closed();
      await settle(harness);

      expect(open).toHaveBeenCalledWith('Sin conexión: comprueba la red e inténtalo de nuevo.');
      expect(listUsers).toHaveBeenCalledTimes(1);
      expect(text(rowOf(LUCIA.name))).not.toContain('Desactivada');
    });
  });

  describe('after the final evaluation (5.2g)', () => {
    const [LUCIA_ID, HUGO_ID] = DAW_STUDENT_IDS;
    const HUGO = 'Hugo Sánchez Ferrer';

    /** Lucía finished 1.º DAW A and Hugo left it: both accounts are still active. */
    function evaluate(db: MockDb): void {
      const outcomes = new Map([
        [LUCIA_ID, 'graduates'],
        [HUGO_ID, 'leaves'],
      ] as const);
      db.update('classMembers', (members) =>
        members.map((member) =>
          member.classId === DAW_CLASS_ID
            ? { ...member, outcome: outcomes.get(member.userId) ?? null }
            : member,
        ),
      );
    }

    it('warns of the accounts left to disable, and disables those chosen', async () => {
      const harness = await renderUsers('/admin/usuarios', evaluate);
      expect(
        screen.getByText('2 alumnos titulados o de baja siguen con la cuenta activa.'),
      ).toBeTruthy();
      await userEvent.type(screen.getByRole('searchbox'), 'lucia');
      await settle(harness);
      expect(text(rowOf(LUCIA.name))).toContain('Titula · 1.º DAW A · 2026/27');

      await userEvent.click(screen.getByRole('button', { name: 'Revisar y desactivar…' }));
      const dialog = await openedDialog();
      expect(within(dialog).getByText('Baja · 1.º DAW A · 2026/27')).toBeTruthy();
      await userEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(HUGO) }));
      await userEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(HUGO) }));
      await userEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(HUGO) }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar 1' }));
      await closed();
      await settle(harness);

      expect(await screen.findByText('1 cuenta desactivada')).toBeTruthy();
      expect(
        screen.getByText('1 alumno titulado o de baja sigue con la cuenta activa.'),
      ).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('says what it could not disable, and keeps the dialog open when it fails', async () => {
      const harness = await renderUsers('/admin/usuarios', evaluate);
      let answer!: (result: { disabled: string[]; failed: string[] }) => void;
      const disable = vi
        .spyOn(service, 'disableUsers')
        .mockRejectedValueOnce(new DataError('network'))
        .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
        .mockResolvedValueOnce({ disabled: [LUCIA_ID, HUGO_ID], failed: [] });

      await userEvent.click(screen.getByRole('button', { name: 'Revisar y desactivar…' }));
      const dialog = await openedDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar 2' }));
      expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');

      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar 2' }));
      expect(await within(dialog).findByText('Desactivando…')).toBeTruthy();
      answer({ disabled: [LUCIA_ID], failed: [HUGO_ID] });
      await closed();
      await settle(harness);
      expect(disable).toHaveBeenLastCalledWith([HUGO_ID, LUCIA_ID]);
      expect(
        await screen.findByText('Desactivadas: 1. Sin desactivar: 1; vuelve a intentarlo.'),
      ).toBeTruthy();

      // Cancelled: nothing changes
      await userEvent.click(screen.getByRole('button', { name: 'Revisar y desactivar…' }));
      await userEvent.click(within(await openedDialog()).getByRole('button', { name: 'Cancelar' }));
      await closed();
      expect(disable).toHaveBeenCalledTimes(2);

      await userEvent.click(screen.getByRole('button', { name: 'Revisar y desactivar…' }));
      await userEvent.click(
        within(await openedDialog()).getByRole('button', { name: 'Desactivar 2' }),
      );
      await closed();
      expect(await screen.findByText('2 cuentas desactivadas')).toBeTruthy();
    });

    it('filters the students by their situation in the URL', async () => {
      const harness = await renderUsers('/admin/usuarios', evaluate);

      await userEvent.click(screen.getByRole('combobox', { name: 'Situación del alumnado' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Titulados o de baja' }));
      await settle(harness);
      expect(TestBed.inject(Router).url).toBe('/admin/usuarios?situacion=terminados');
      expect(rows().map((row) => text(row).split(' · ')[0])).toEqual([
        expect.stringContaining(HUGO),
        expect.stringContaining(LUCIA.name),
      ]);

      await userEvent.click(screen.getByRole('combobox', { name: 'Situación del alumnado' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Sin clase este curso' }));
      await settle(harness);
      expect(TestBed.inject(Router).url).toBe('/admin/usuarios?situacion=sin-clase');
      expect(screen.getByText(`3 cuentas de ${ACTIVE}`)).toBeTruthy();

      await userEvent.click(screen.getByRole('combobox', { name: 'Situación del alumnado' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Todas' }));
      await settle(harness);
      expect(TestBed.inject(Router).url).toBe('/admin/usuarios');
    });

    it('shows the classes of a student year by year, with their evaluation', async () => {
      await renderUsers(LUCIA_URL, evaluate);

      await openAction(LUCIA.name, 'Ver su trayectoria');
      const dialog = await openedDialog();
      expect(
        within(dialog).getByRole('heading', { name: `Trayectoria de ${LUCIA.name}` }),
      ).toBeTruthy();
      const item = within(dialog).getByRole('listitem');
      expect(within(item).getByText('1.º DAW A')).toBeTruthy();
      expect(within(item).getByText('2026/27')).toBeTruthy();
      expect(text(item)).toContain('Titula');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
      await closed();
    });

    it('offers no trajectory to who was never a student, nor a notice without anybody', async () => {
      await renderUsers('/admin/usuarios?buscar=ibanez');

      await userEvent.click(screen.getByRole('button', { name: /Acciones de Marta/ }));
      expect(await screen.findByRole('menuitem', { name: /Editar/ })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: /trayectoria/ })).toBeNull();
      expect(screen.queryByText(/siguen con la cuenta activa/)).toBeNull();
    });

    it('says how many match in the other status, and nothing more with all of them', async () => {
      await renderUsers('/admin/usuarios?situacion=terminados', (db) => {
        evaluate(db);
        db.update('users', (users) =>
          users.map((user) =>
            user.id === LUCIA_ID || user.id === HUGO_ID ? { ...user, status: 'disabled' } : user,
          ),
        );
      });
      expect(
        screen.getByText('Ninguna cuenta activa coincide, pero 2 desactivadas sí.'),
      ).toBeTruthy();
      TestBed.resetTestingModule();

      await renderUsers('/admin/usuarios?estado=desactivadas&rol=teacher');
      expect(
        screen.getByText('Ninguna cuenta desactivada coincide, pero 2 activas sí.'),
      ).toBeTruthy();
      TestBed.resetTestingModule();

      await renderUsers('/admin/usuarios?estado=todas&buscar=nadie');
      expect(screen.getByText('Ningún usuario coincide')).toBeTruthy();
    });

    it('says an active account matches when the disabled are shown', async () => {
      await renderUsers('/admin/usuarios?estado=desactivadas&buscar=lucia');

      expect(
        screen.getByText('Ninguna cuenta desactivada coincide, pero una activa sí.'),
      ).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Ver todas las cuentas' }));
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toContain('estado=todas'));
    });

    it('lists the users without the notice if the accounts to disable cannot be read', async () => {
      vi.spyOn(MockAdminService.prototype, 'listFinishedStudents').mockRejectedValueOnce(
        new DataError('network'),
      );
      await renderUsers('/admin/usuarios', evaluate);

      expect(screen.getByText(`${ACTIVE} cuentas`)).toBeTruthy();
      expect(screen.queryByText(/siguen con la cuenta activa/)).toBeNull();
    });
  });

  it('shows a skeleton while it first loads, without the filters', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideSessionOf('admin', { id: ADMIN_ID }),
        { provide: AdminService, useValue: { listUsers: () => new Promise(() => undefined) } },
      ],
    });
    await restoreSession();
    // Not through the router: a load that never ends would keep it from ever being stable
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(screen.getByText('Cargando los usuarios…')).toBeTruthy();
      },
      { timeout: LOADING_INDICATOR_DELAY_MS * 3 },
    );
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Nuevo usuario' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows the error of the list with a retry', async () => {
    const listUsers = vi
      .spyOn(MockAdminService.prototype, 'listUsers')
      .mockRejectedValueOnce(new DataError('network'));
    await renderUsers();

    expect(screen.getByRole('alert')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(screen.getByText(`${ACTIVE} cuentas`)).toBeTruthy());
    expect(listUsers).toHaveBeenCalledTimes(2);
  });
});
