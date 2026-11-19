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
import { nextSchoolYear } from './school-year';

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

  /** Chooses subjects in the list of a new group, which stays open until Escape. */
  async function pickSubjects(dialog: HTMLElement, ...names: string[]): Promise<void> {
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignaturas' }));
    for (const name of names) await userEvent.click(await screen.findByRole('option', { name }));
    await userEvent.keyboard('{Escape}');
  }

  /** A new group of advanced programming, which nobody started: it can be removed. */
  async function createGroup(name: string): Promise<void> {
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo grupo' })[0]);
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), name);
    await pickSubjects(dialog, 'Programación avanzada');
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
    await pickSubjects(dialog, 'Programación avanzada');
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

  it('creates the same class in several subjects at once, and chooses the first', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), '2.º DAW B');
    await pickSubjects(dialog, 'Programación avanzada', 'Programación básica');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear 2 grupos' }));
    await closed();

    // In the order of the list of subjects, whatever the order of the clicks
    expect(shown('2.º DAW B · Programación básica')).toBeTruthy();
    expect(screen.getByText('2 grupos creados')).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
    expect(
      await screen.findByRole('option', { name: '2.º DAW B · Programación avanzada' }),
    ).toBeTruthy();
  });

  it('duplicates a class for the next year, with its blocks and its students', async () => {
    await render(DAW_URL);

    await userEvent.click(await action(BASIC, 'Duplicar…'));
    const dialog = await openedDialog();
    expect(within(dialog).getByRole('heading').textContent).toContain(
      'Duplicar 1.º DAW A · 2026/27',
    );
    const year = nextSchoolYear('2026/27', new Date());
    expect(within(dialog).getByRole('textbox', { name: 'Curso' })).toHaveProperty('value', year);
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    expect(
      within(subjects)
        .getAllByRole('checkbox')
        .map((box) => [text(box.closest('mat-checkbox')), (box as HTMLInputElement).checked]),
    ).toEqual([
      [`Programación básica (${DAW_STUDENT_IDS.length} alumnos)`, true],
      [expect.stringContaining('Desarrollo web en entorno cliente'), true],
    ]);
    expect(within(dialog).getByText(/pasan a .*, el mismo día de la semana/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Su alumnado/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear 2 grupos' }));
    await closed();

    const label = `${BASIC} · ${year}`;
    expect(text(shown(label))).toContain(`${DAW_STUDENT_IDS.length} alumnos`);
    expect(screen.getByText('2 grupos creados')).toBeTruthy();
  });

  it('lets an administrator duplicate a group for the teacher of the source', async () => {
    await render(DAW_URL, { role: 'admin' });

    await userEvent.click(await action(BASIC, 'Duplicar…'));
    const dialog = await openedDialog();
    expect(text(within(dialog).getByRole('combobox', { name: 'Docente' }))).toContain(
      'Marta Ibáñez Soler',
    );
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    await userEvent.click(within(subjects).getAllByRole('checkbox')[1]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();

    const year = nextSchoolYear('2026/27', new Date());
    expect(text(shown(`${BASIC} · ${year}`))).toContain('Docente: Marta Ibáñez Soler');
  });

  it('duplicates one group without blocks, and says what is missing', async () => {
    await render(DAW_URL);

    await userEvent.click(await action(BASIC, 'Duplicar…'));
    const dialog = await openedDialog();
    const subjects = within(dialog).getByRole('group', { name: 'Asignaturas' });
    for (const box of within(subjects).getAllByRole('checkbox')) await userEvent.click(box);
    expect(within(dialog).getByText('Elige al menos una asignatura')).toBeTruthy();
    const dates = within(dialog).getByRole('checkbox', { name: 'Con sus fechas' });
    await userEvent.click(dates);
    expect(within(dialog).getByText(/sin fechas de apertura ni de entrega/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Sus bloques/ }));
    expect(within(dialog).getByRole('checkbox', { name: 'Con sus fechas' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(dialog).getByText('Solo con los bloques.')).toBeTruthy();
    const year = within(dialog).getByRole('textbox', { name: 'Curso' });
    await userEvent.clear(year);
    await userEvent.type(year, '2026/27');
    await userEvent.click(within(subjects).getAllByRole('checkbox')[0]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();

    expect(text(shown(`${BASIC} · 2026/27`))).toContain('Sin alumnos');
    expect(screen.getByText('Grupo creado')).toBeTruthy();
  });

  it('keeps the duplicate dialog open when it fails, and does nothing when cancelled', async () => {
    await render(DAW_URL);

    await userEvent.click(await action(BASIC, 'Duplicar…'));
    const dialog = await openedDialog();
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear 2 grupos' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();
    expect(screen.queryByText(/grupos creados/)).toBeNull();
  });

  it('enrolls in the other groups of the class too', async () => {
    await render(DAW_URL);

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const dialog = await openedDialog();
    const also = within(dialog).getByRole('group', { name: 'Matricular también en' });
    expect(within(also).getByRole('checkbox', { name: WEB })).toHaveProperty('checked', true);
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    await choose(WEB);
    expect(students().some((item) => text(item).includes('Elena Vázquez Lorenzo'))).toBe(true);
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
    await pickSubjects(dialog, 'Programación avanzada');
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
