import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import {
  ADMIN_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { GroupsPage } from './groups-page';

const URL = '/docente/grupos';
const BASIC = '1.º DAW A · Programación básica';
const WEB = '1.º DAW A · Desarrollo web en entorno cliente';
const DAW_URL = `${URL}?grupo=${DAW_GROUP_ID}`;

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('GroupsPage', () => {
  let harness: RouterTestingHarness;

  async function render(
    url = URL,
    { role = 'teacher', prepare }: { role?: 'teacher' | 'admin'; prepare?: () => void } = {},
  ): Promise<void> {
    localStorage.clear();
    const userId = role === 'admin' ? ADMIN_ID : TEACHER_ID;
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'docente/grupos', component: GroupsPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideSessionOf(role, { id: userId }),
        MockGroupService,
        { provide: GroupService, useExisting: MockGroupService },
        MockExerciseService,
        { provide: ExerciseService, useExisting: MockExerciseService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(userId);
    prepare?.();
    await restoreSession();
    harness = await RouterTestingHarness.create(url);
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  /** The zone of the group chosen, named after it. */
  function shown(label: string): HTMLElement {
    return screen.getByRole('region', { name: label });
  }

  function students(): HTMLElement[] {
    return within(screen.getByRole('list', { name: 'Alumnado' })).getAllByRole('listitem');
  }

  async function choose(label: string): Promise<void> {
    await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
    await userEvent.click(await screen.findByRole('option', { name: label }));
    await settle();
  }

  async function action(label: string, item: string | RegExp): Promise<HTMLElement> {
    await userEvent.click(screen.getByRole('button', { name: `Acciones de ${label}` }));
    return screen.findByRole('menuitem', { name: item });
  }

  async function openedDialog(): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return dialog;
  }

  async function closed(): Promise<void> {
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settle();
  }

  async function confirm(button: string): Promise<void> {
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: button }));
    await closed();
  }

  /** A new group of advanced programming, which nobody started: it can be removed. */
  async function createGroup(name: string): Promise<void> {
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo grupo' })[0]);
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), name);
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
  }

  afterEach(() => localStorage.clear());

  it('shows the first group of the teacher by name and subject, without its teacher', async () => {
    await render();

    expect(screen.getByRole('heading', { level: 1, name: 'Grupos y matrícula' })).toBeTruthy();
    expect(screen.getByText('Tus grupos y quién está en cada uno.')).toBeTruthy();
    expect(text(shown(WEB))).toContain('2026/27');
    expect(text(shown(WEB))).toContain(`${DAW_STUDENT_IDS.length} alumnos`);
    expect(screen.queryByText(/Docente:/)).toBeNull();

    await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
    expect((await screen.findAllByRole('option')).map((option) => text(option))).toEqual([
      WEB,
      BASIC,
    ]);
  });

  it('shows every group with its teacher for an administrator', async () => {
    await render(URL, { role: 'admin' });

    expect(screen.getByText('Los grupos del centro y quién está en cada uno.')).toBeTruthy();
    expect(screen.getByText(/Docente: Javier Ortega Ruiz/)).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
    expect(await screen.findAllByRole('option')).toHaveLength(4);
  });

  it('lets an administrator choose the teacher of a new group and change it', async () => {
    await render(URL, { role: 'admin' });

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    let dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Marta Ibáñez Soler' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
    const label = 'Prueba · Programación avanzada';
    expect(text(shown(label))).toContain('Docente: Marta Ibáñez Soler');

    await userEvent.click(await action(label, 'Editar'));
    dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Javier Ortega Ruiz' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    expect(text(shown(label))).toContain('Docente: Javier Ortega Ruiz');
  });

  it('chooses the group in the URL, and filters its students', async () => {
    await render(DAW_URL);

    expect(students()).toHaveLength(DAW_STUDENT_IDS.length);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filtrar alumnos' }), 'LUCIA');
    expect(students()).toHaveLength(1);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filtrar alumnos' }), 'zz');
    expect(screen.getByText('Nadie coincide')).toBeTruthy();

    await choose(WEB);
    expect(TestBed.inject(Router).url).toBe(`${URL}?grupo=${DAW_WEB_GROUP_ID}`);
    // Another group starts without a filter
    expect(students()).toHaveLength(DAW_STUDENT_IDS.length);
  });

  it('creates a group, which is chosen with no students, and removes it', async () => {
    await render();

    await createGroup('2.º DAW B');
    const label = '2.º DAW B · Programación avanzada';
    expect(text(shown(label))).toContain('Sin alumnos');
    expect(screen.getByText('Este grupo aún no tiene alumnos')).toBeTruthy();
    expect(screen.getByText('Grupo creado')).toBeTruthy();

    await userEvent.click(await action(label, 'Eliminar'));
    await confirm('Eliminar');

    expect(screen.queryByRole('region', { name: label })).toBeNull();
    expect(TestBed.inject(Router).url).toBe(URL);
    expect(screen.getByText(`Grupo ${label} eliminado`)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('edits a group in place', async () => {
    await render(DAW_URL);

    await userEvent.click(await action(BASIC, 'Editar'));
    const dialog = await openedDialog();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.type(name, '1.º DAW Z');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();

    expect(shown('1.º DAW Z · Programación básica')).toBeTruthy();
    expect(screen.getByText('Cambios guardados')).toBeTruthy();
  });

  it('does not remove a started group, saying why, and links to its blocks', async () => {
    await render(DAW_URL);

    const remove = await action(BASIC, /Eliminar/);
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(text(remove)).toContain('ya hay alumnos con trabajo');
    const blocks = screen.getByRole('menuitem', { name: 'Ver sus bloques' });
    expect(blocks.getAttribute('href')).toBe(`/docente/bloques?grupo=${DAW_GROUP_ID}`);
  });

  it('unenrolls a student, lowering the count and keeping the focus in the group', async () => {
    await render(DAW_URL);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    await confirm('Dar de baja del grupo');

    expect(screen.queryByText('Lucía Martín Gómez')).toBeNull();
    expect(text(shown(BASIC))).toContain(`${DAW_STUDENT_IDS.length - 1} alumnos`);
    expect(screen.getByText('Lucía Martín Gómez ya no está en el grupo')).toBeTruthy();
    expect(shown(BASIC).contains(document.activeElement)).toBe(true);
  });

  it('enrolls students in order, raising the count', async () => {
    await render(DAW_URL);

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const dialog = await openedDialog();
    expect(within(dialog).getByRole('heading', { name: `Matricular en ${BASIC}` })).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    const names = students().map((item) => text(item));
    expect(names.findIndex((name) => name.includes('Elena'))).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    expect(text(shown(BASIC))).toContain(`${DAW_STUDENT_IDS.length + 1} alumnos`);
    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
  });

  it('enrolls the active students of another group at once', async () => {
    // A disabled account stays in its group, but cannot be enrolled in another one
    await render(DAW_URL, {
      prepare: () =>
        TestBed.inject(MockDb).update('users', (users) =>
          users.map((user) =>
            user.id === DAW_STUDENT_IDS[0] ? { ...user, status: 'disabled' } : user,
          ),
        ),
    });
    await createGroup('Prueba');

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir los de otro grupo' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: BASIC }));
    await userEvent.click(
      await within(dialog).findByRole('button', {
        name: `Matricular (${DAW_STUDENT_IDS.length - 1})`,
      }),
    );
    await closed();

    expect(students()).toHaveLength(DAW_STUDENT_IDS.length - 1);
    expect(text(shown('Prueba · Programación avanzada'))).toContain(
      `${DAW_STUDENT_IDS.length - 1} alumnos`,
    );
  });

  it('keeps the enroll dialog open when enrolling fails', async () => {
    await render(DAW_URL);

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
  });

  it('does nothing when an edit, a removal or an unenrollment is cancelled', async () => {
    await render(DAW_URL);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    await confirm('Cancelar');
    expect(screen.getByText('Lucía Martín Gómez')).toBeTruthy();

    await userEvent.click(await action(BASIC, 'Editar'));
    await confirm('Cancelar');
    expect(screen.queryByText('Cambios guardados')).toBeNull();

    await createGroup('Prueba');
    await userEvent.click(await action('Prueba · Programación avanzada', 'Eliminar'));
    await confirm('Cancelar');
    expect(shown('Prueba · Programación avanzada')).toBeTruthy();
  });

  it('warns of a failed unenrollment and reloads', async () => {
    await render(DAW_URL);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    const listStudents = vi.spyOn(TestBed.inject(GroupService), 'listStudents');
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Dar de baja del grupo');

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByText('Lucía Martín Gómez')).toBeTruthy();
    expect(listStudents).toHaveBeenCalledWith(DAW_GROUP_ID);
  });

  it('keeps the group dialog open when saving fails, and warns of a failed removal', async () => {
    await render();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();

    await userEvent.click(await action('Prueba · Programación avanzada', 'Eliminar'));
    const confirmDialog = await openedDialog();
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Eliminar' }));
    await closed();

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(shown('Prueba · Programación avanzada')).toBeTruthy();
  });

  it('chooses the only subject there is, and shows a single group without a selector', async () => {
    await render(URL, {
      prepare: () => {
        const db = TestBed.inject(MockDb);
        db.update('subjects', (subjects) => subjects.slice(0, 1));
        db.update('groups', (groups) =>
          groups.filter((group) => group.subjectId === SUBJECTS[0].id),
        );
      },
    });
    expect(screen.queryByRole('combobox', { name: 'Grupo' })).toBeNull();
    expect(screen.getByText(BASIC)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();

    expect(shown('Prueba · Programación básica')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Grupo' })).toBeTruthy();
  });

  it('shows the empty state without groups, for a teacher and for an administrator', async () => {
    const noGroups = () => TestBed.inject(MockDb).update('groups', () => []);
    await render(URL, { prepare: noGroups });
    expect(screen.getByText('Aún no tienes grupos')).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo grupo' })[1]);
    expect(await screen.findByRole('dialog', { name: 'Nuevo grupo' })).toBeTruthy();

    TestBed.resetTestingModule();
    await render(URL, { role: 'admin', prepare: noGroups });
    expect(screen.getByText('Aún no hay grupos')).toBeTruthy();
  });

  it('shows the error of the page, and that of the students apart, with their retries', async () => {
    await render(DAW_URL, {
      prepare: () => TestBed.inject(MockNetwork).failNextRequest('network'),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(students()).toHaveLength(DAW_STUDENT_IDS.length);

    TestBed.inject(MockNetwork).failNextRequest('network');
    await choose(WEB);
    await userEvent.click(within(shown(WEB)).getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(students()).toHaveLength(DAW_STUDENT_IDS.length);
  });
});
