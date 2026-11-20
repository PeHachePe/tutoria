import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { DataError } from '../../data/data-error';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import {
  ADMIN_ID,
  DAM_CLASS_ID,
  DAW_CLASS_ID,
  DAW_GROUP_ID,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { withoutHistory } from '../../data/mock/fixtures/history';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { subjectLine } from './class-list';
import { GroupsPage } from './groups-page';
import { nextSchoolYear, schoolYearOf } from './school-year';

const URL = '/docente/grupos';
const DAW = '1.º DAW A · 2026/27';
const DAM = '1.º DAM B · 2026/27';
const DAW_NAME = '1.º DAW A';
const DAM_NAME = '1.º DAM B';
const BASIC = 'Programación básica';
const ADVANCED = 'Programación avanzada';
const WEB = 'Desarrollo web en entorno cliente';
const ENGLISH = `${BASIC} · Desdoble inglés`;
const MARTA = 'Marta Ibáñez Soler';
const JAVIER = 'Javier Ortega Ruiz';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

type Role = 'teacher' | 'admin';

describe('GroupsPage', () => {
  let harness: RouterTestingHarness;

  async function render(
    url = URL,
    {
      role = 'teacher',
      userId = role === 'admin' ? ADMIN_ID : TEACHER_ID,
      prepare,
      latency = 0,
      history = false,
    }: {
      role?: Role;
      userId?: string;
      prepare?: () => void;
      latency?: number;
      history?: boolean;
    } = {},
  ): Promise<void> {
    localStorage.clear();
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
    TestBed.inject(MockNetwork).setLatency({ min: latency, max: latency });
    TestBed.inject(MockDb).setSession(userId);
    // This year alone, unless a test is about the years before
    if (!history) withoutHistory(TestBed.inject(MockDb));
    prepare?.();
    await restoreSession();
    harness = await RouterTestingHarness.create(url);
    // Settling waits for what loads: a slow load is watched while it lasts
    if (latency === 0) await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  function url(): string {
    return TestBed.inject(Router).url;
  }

  /**
   * The subjects of the class shown, as the heads of the columns of its students say them: the
   * whole name, and under its initials the split, the teacher and how many students it has.
   */
  function subjects(): string[] {
    return screen
      .getAllByRole('columnheader')
      .filter((head) => head.hasAttribute('title'))
      .map((head) => `${head.getAttribute('title')} (${text(head.lastElementChild)})`);
  }

  /**
   * The subjects of a class without students, whose table has no columns to show yet: as the
   * service keeps them, with their teacher.
   */
  async function groupsOf(label: string): Promise<string[]> {
    const classes = await TestBed.inject(GroupService).listClasses();
    const found = classes.find(
      ({ schoolClass }) => `${schoolClass.name} · ${schoolClass.schoolYear}` === label,
    );
    return (found?.groups ?? []).map(
      (managed) => `${subjectLine(managed, 'es')} (${managed.teacherName})`,
    );
  }

  /** The zone of the students of the class shown, named after it. */
  function studentsOf(label: string): HTMLElement {
    return screen.getByRole('region', { name: label });
  }

  /** Chooses a class of the year shown by its name, or a year, in the selector of two levels. */
  async function choose(name: string, level: 'Clase' | 'Curso' = 'Clase'): Promise<void> {
    await userEvent.click(screen.getByRole('combobox', { name: level }));
    await userEvent.click(await screen.findByRole('option', { name }));
    await settle();
  }

  function trigger(label: string): HTMLElement {
    return screen.getByRole('button', { name: `Acciones de ${label}` });
  }

  /** Opens the menu of a class or a group; the menus opened before may still be closing. */
  async function openMenu(label: string): Promise<HTMLElement> {
    const button = trigger(label);
    await userEvent.click(button);
    return vi.waitFor(() => {
      const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
      expect(panel).not.toBeNull();
      return panel as HTMLElement;
    });
  }

  async function action(label: string, item: string | RegExp): Promise<HTMLElement> {
    return within(await openMenu(label)).getByRole('menuitem', { name: item });
  }

  /** The items of the menu of a class or a group, in order. */
  async function expectMenu(label: string, expected: (string | RegExp)[]): Promise<void> {
    const menu = await openMenu(label);
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(expected.length);
    expected.forEach((name, index) =>
      expect(within(menu).getByRole('menuitem', { name })).toBe(items[index]),
    );
    // Closed as it was opened, with its button
    await userEvent.click(trigger(label));
    await vi.waitFor(() => expect(trigger(label).getAttribute('aria-expanded')).toBe('false'));
  }

  async function openedDialog(name?: string): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog', name ? { name } : {});
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

  async function cancel(): Promise<void> {
    await confirm('Cancelar');
  }

  /** Marks subjects in the list of «Añadir asignaturas», each as it comes (whole class or split). */
  async function chooseSubjects(dialog: HTMLElement, ...names: string[]): Promise<void> {
    for (const name of names) {
      await userEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(`^${name}`) }));
    }
  }

  /** The button of «Añadir asignaturas», which says how many. */
  function addButton(dialog: HTMLElement): HTMLElement {
    return within(dialog).getByRole('button', { name: /^Añadir \(\d+\)$/ });
  }

  /** Opens «Añadir clase» and types the name of the class. */
  async function startClass(name: string): Promise<HTMLElement> {
    await userEvent.click(screen.getAllByRole('button', { name: 'Añadir clase' })[0]);
    const dialog = await openedDialog('Añadir una clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), name);
    await userEvent.keyboard('{Escape}');
    return dialog;
  }

  /**
   * A new class of the user, which the page then shows, and its subjects asked for at once: those
   * given are added, or none.
   */
  async function createClass(name: string, ...subjectNames: string[]): Promise<void> {
    const dialog = await startClass(name);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );
    const subjects = await openedDialog(`Añadir asignaturas a ${name} · 2026/27`);
    if (subjectNames.length === 0) {
      await userEvent.click(within(subjects).getByRole('button', { name: 'Cancelar' }));
    } else {
      await chooseSubjects(subjects, ...subjectNames);
      await userEvent.click(addButton(subjects));
    }
    await closed();
  }

  /** Subjects of the user in the class shown, as each one comes. */
  async function addSubject(...subjects: string[]): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    const dialog = await openedDialog();
    await chooseSubjects(dialog, ...subjects);
    await userEvent.click(addButton(dialog));
    await closed();
  }

  afterEach(() => localStorage.clear());

  it('has no class nor subjects to offer before its classes arrive', async () => {
    await render(URL, { latency: 10_000 });
    // Defensive: the template reads them only once the classes are there
    const page = harness.routeDebugElement!.componentInstance as GroupsPage;

    expect(page['options']()).toEqual([]);
    expect(page['classGroups']()).toEqual([]);
    expect(page['mine']()).toEqual([]);
    expect(page['sources']()).toEqual([]);
  });

  it('shows the class of the teacher with every subject, those of other teachers too', async () => {
    await render();

    expect(screen.getByRole('heading', { level: 1, name: 'Grupos y matrícula' })).toBeTruthy();
    expect(screen.getByText(/Tus clases, que compartes con sus otros docentes/)).toBeTruthy();
    // A single class: its year, always in sight, and its name, without a selector of classes
    expect(text(screen.getByRole('combobox', { name: 'Curso' }))).toContain('2026/27');
    expect(screen.queryByRole('combobox', { name: 'Clase' })).toBeNull();
    expect(screen.getByText(DAW_NAME)).toBeTruthy();
    expect(subjects()).toEqual([
      `${WEB} (Marta · 24)`,
      `${BASIC} (Marta · 24)`,
      `${ENGLISH} (Desdoble inglés · Javier · 0)`,
    ]);
    // Only the groups of the user have a menu
    expect(screen.getByRole('button', { name: `Acciones de 1.º DAW A · ${BASIC}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Acciones de 1.º DAW A · ${ENGLISH}` })).toBeNull();
    expect(text(studentsOf(DAW))).toContain('Alumnado (24)');
  });

  it('lets the creator of a class edit it, but not remove it while it has subjects', async () => {
    await render();

    await expectMenu(DAW, ['Editar', 'Duplicar…', /^Eliminar/]);
    const remove = await action(DAW, /Eliminar/);
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(text(remove)).toContain('Solo se elimina sin asignaturas: elimínalas antes.');
  });

  it('does not remove a started group, saying why, and links to its blocks', async () => {
    await render();

    const remove = await action(`1.º DAW A · ${BASIC}`, /Eliminar/);
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(text(remove)).toContain('ya hay alumnos con trabajo');
    const blocks = screen.getByRole('menuitem', { name: 'Ver sus bloques' });
    expect(blocks.getAttribute('href')).toBe(`/docente/bloques?grupo=${DAW_GROUP_ID}`);
  });

  it('shows another teacher the classes where they teach, choosing one in the URL', async () => {
    await render(`${URL}?clase=${DAW_CLASS_ID}`, { userId: OTHER_TEACHER_ID });

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAW_NAME);
    // Not their class: they only duplicate their split
    await expectMenu(DAW, ['Duplicar…']);
    expect(screen.getByRole('button', { name: `Acciones de 1.º DAW A · ${ENGLISH}` })).toBeTruthy();

    await choose(DAM_NAME);
    expect(url()).toBe(`${URL}?clase=${DAM_CLASS_ID}`);
    expect(subjects()).toEqual([`${ADVANCED} (Javier · 6)`, `${BASIC} (Javier · 6)`]);
    expect(text(studentsOf(DAM))).toContain('Alumnado (6)');
  });

  it('shows the first class of the current year for an unknown one in the URL', async () => {
    await render(`${URL}?clase=nope`, {
      userId: OTHER_TEACHER_ID,
      // Classes of this year, whatever the date the tests run
      prepare: () =>
        TestBed.inject(MockDb).update('classes', (rows) =>
          rows.map((row) => ({ ...row, schoolYear: schoolYearOf(new Date()) })),
        ),
    });

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAM_NAME);
  });

  it('shows the first class of all when the current year has none', async () => {
    await render(URL, {
      userId: OTHER_TEACHER_ID,
      prepare: () =>
        TestBed.inject(MockDb).update('classes', (rows) =>
          rows.map((row) => ({ ...row, schoolYear: '2001/02' })),
        ),
    });

    expect(text(screen.getByRole('combobox', { name: 'Curso' }))).toContain('2001/02');
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAM_NAME);
  });

  it('shows every class to an administrator, who chooses the teacher of a new one', async () => {
    await render(URL, { role: 'admin' });

    expect(screen.getByText(/Las clases del centro, sus asignaturas y su alumnado/)).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: 'Clase' }));
    expect((await screen.findAllByRole('option')).map((option) => text(option))).toEqual([
      DAM_NAME,
      DAW_NAME,
    ]);
    await userEvent.click(
      document.querySelector<HTMLElement>('.cdk-overlay-transparent-backdrop')!,
    );

    const dialog = await startClass('2.º DAW A');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );
    const subjectsDialog = await openedDialog('Añadir asignaturas a 2.º DAW A · 2026/27');
    expect(screen.getByText('Clase creada')).toBeTruthy();
    await chooseSubjects(subjectsDialog, ADVANCED);
    await userEvent.click(within(subjectsDialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: JAVIER }));
    await userEvent.click(addButton(subjectsDialog));
    await closed();

    const label = '2.º DAW A · 2026/27';
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain('2.º DAW A');
    // Without students yet: its table waits for them
    expect(within(studentsOf(label)).getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    expect(within(studentsOf(label)).queryByText(/Aún no tiene asignaturas/)).toBeNull();
    expect(await groupsOf(label)).toEqual([`${ADVANCED} (${JAVIER})`]);
  });

  it('lets an administrator add a subject of any teacher', async () => {
    await render(`${URL}?clase=${DAW_CLASS_ID}`, { role: 'admin' });

    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    const dialog = await openedDialog();
    await chooseSubjects(dialog, ADVANCED);
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: JAVIER }));
    await userEvent.click(addButton(dialog));
    await closed();

    expect(subjects()).toContain(`${ADVANCED} (Javier · 24)`);
  });

  it('creates a class, which is chosen, empty, and removes it', async () => {
    await render();

    await createClass('2.º DAW B');
    const label = '2.º DAW B · 2026/27';
    expect(screen.getByText('Clase creada')).toBeTruthy();
    expect(url()).toMatch(/\?clase=/);
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain('2.º DAW B');
    expect(screen.getByText('Aún no tiene asignaturas. Añade las tuyas.')).toBeTruthy();
    expect(screen.getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    // Nothing of the user to duplicate in it
    await expectMenu(label, ['Editar', 'Eliminar']);

    await userEvent.click(await action(label, 'Eliminar'));
    await cancel();
    expect(trigger(label)).toBeTruthy();

    await userEvent.click(await action(label, 'Eliminar'));
    await confirm('Eliminar');

    expect(screen.getByText(`Clase ${label} eliminada`)).toBeTruthy();
    expect(url()).toBe(URL);
    expect(screen.queryByRole('combobox', { name: 'Clase' })).toBeNull();
    expect(screen.getByText(DAW_NAME)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('warns of a class it could not remove', async () => {
    await render();
    await createClass('2.º DAW B');
    const label = '2.º DAW B · 2026/27';

    await userEvent.click(await action(label, 'Eliminar'));
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Eliminar');

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(trigger(label)).toBeTruthy();
  });

  it('joins a class that exists with the subjects of the user', async () => {
    await render();

    let dialog = await startClass('1.º dam b');
    expect(
      within(dialog).getByText(/Esta clase ya existe \(la dan Javier Ortega Ruiz\)/),
    ).toBeTruthy();
    // Joined without choosing: nothing changes
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Unirme y elegir asignaturas' }),
    );
    dialog = await openedDialog(`Añadir asignaturas a ${DAM}`);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();
    expect(url()).toBe(URL);

    dialog = await startClass('1.º dam b');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Unirme y elegir asignaturas' }),
    );
    dialog = await openedDialog(`Añadir asignaturas a ${DAM}`);
    await chooseSubjects(dialog, WEB);
    await userEvent.click(addButton(dialog));
    await closed();

    expect(screen.getByText('Asignatura añadida')).toBeTruthy();
    expect(url()).toBe(`${URL}?clase=${DAM_CLASS_ID}`);
    // It takes the students of the class
    expect(subjects()).toContain(`${WEB} (Marta · 6)`);
    // Not their class: they only duplicate their subject
    await expectMenu(DAM, ['Duplicar…']);
  });

  it('opens a new class without suggestions if the classes could not be read', async () => {
    await render();

    TestBed.inject(MockNetwork).failNextRequest('network');
    const dialog = await startClass('1.º DAW A');
    expect(within(dialog).queryByText(/Esta clase ya existe/)).toBeNull();
    await cancel();

    expect(screen.queryByText('Clase creada')).toBeNull();
    expect(url()).toBe(URL);
  });

  it('keeps the dialog of a class open when saving fails', async () => {
    await render();

    const dialog = await startClass('2.º DAW B');
    const createClass = vi.spyOn(TestBed.inject(GroupService), 'createClass');
    createClass.mockRejectedValueOnce(new DataError('network'));
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Crear y elegir asignaturas' }),
    );

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
  });

  it('edits the name of a class in place', async () => {
    await render();

    await userEvent.click(await action(DAW, 'Editar'));
    await cancel();
    expect(screen.queryByText('Cambios guardados')).toBeNull();

    await userEvent.click(await action(DAW, 'Editar'));
    const dialog = await openedDialog('Editar la clase');
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.type(name, '1.º DAW Z');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();

    expect(screen.getByText('Cambios guardados')).toBeTruthy();
    expect(screen.getByText('1.º DAW Z')).toBeTruthy();
  });

  it('duplicates the subjects of the user into the class of next year', async () => {
    await render();

    await userEvent.click(await action(DAW, 'Duplicar…'));
    await cancel();
    expect(screen.queryByText('Clase duplicada')).toBeNull();

    await userEvent.click(await action(DAW, 'Duplicar…'));
    const dialog = await openedDialog(`Duplicar ${DAW}`);
    const subjectsToCopy = within(dialog).getByRole('group', { name: 'Asignaturas' });
    // Those of the user, in the order of the class: not the split of Javier's
    expect(
      within(subjectsToCopy)
        .getAllByRole('checkbox')
        .map((box) => text(box.closest('mat-checkbox'))),
    ).toEqual([`${WEB} (24 alumnos)`, `${BASIC} (24 alumnos)`]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar 2 asignaturas' }));
    await closed();

    const year = nextSchoolYear('2026/27', new Date());
    expect(screen.getByText('Clase duplicada')).toBeTruthy();
    expect(text(screen.getByRole('combobox', { name: 'Curso' }))).toContain(year);
    // A new year is a new class: without students, and with the subjects of the user
    const label = `1.º DAW A · ${year}`;
    expect(within(studentsOf(label)).getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    expect(within(studentsOf(label)).queryByText(/Aún no tiene asignaturas/)).toBeNull();
    expect(await groupsOf(label)).toEqual([`${WEB} (${MARTA})`, `${BASIC} (${MARTA})`]);

    // Back to this year: its first class
    await choose('2026/27', 'Curso');
    expect(url()).toBe(`${URL}?clase=${DAW_CLASS_ID}`);
    expect(text(studentsOf(DAW))).toContain('Alumnado (24)');
  });

  it('adds a split of a subject the class has, edits its label and removes it', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    await cancel();
    expect(screen.queryByText('Asignatura añadida')).toBeNull();

    await addSubject(BASIC);
    const split = `${BASIC} · Desdoble 2`;
    expect(screen.getByText('Asignatura añadida')).toBeTruthy();
    // A split starts without students: they are chosen
    expect(subjects()).toContain(`${split} (Desdoble 2 · Marta · 0)`);

    await userEvent.click(await action(`1.º DAW A · ${split}`, 'Editar'));
    await cancel();
    await userEvent.click(await action(`1.º DAW A · ${split}`, 'Editar'));
    let dialog = await openedDialog(`Editar ${DAW} · ${BASIC}`);
    const label = within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' });
    await userEvent.clear(label);
    await userEvent.type(label, 'Desdoble tarde');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    const renamed = `${BASIC} · Desdoble tarde`;
    expect(screen.getByText('Cambios guardados')).toBeTruthy();
    expect(subjects()).toContain(`${renamed} (Desdoble tarde · Marta · 0)`);

    await userEvent.click(await action(`1.º DAW A · ${renamed}`, 'Eliminar'));
    await cancel();
    expect(subjects()).toContain(`${renamed} (Desdoble tarde · Marta · 0)`);

    await userEvent.click(await action(`1.º DAW A · ${renamed}`, 'Eliminar'));
    dialog = await openedDialog();
    expect(within(dialog).getByRole('heading').textContent).toContain(
      `¿Eliminar el grupo 1.º DAW A · ${renamed}?`,
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await closed();

    expect(screen.getByText(`Grupo 1.º DAW A · ${renamed} eliminado`)).toBeTruthy();
    expect(subjects()).not.toContain(`${renamed} (Desdoble tarde · Marta · 0)`);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('adds a subject of the whole class, which takes its students', async () => {
    await render();

    await addSubject(ADVANCED);

    expect(subjects()).toEqual([
      `${WEB} (Marta · 24)`,
      `${ADVANCED} (Marta · 24)`,
      `${BASIC} (Marta · 24)`,
      `${ENGLISH} (Desdoble inglés · Javier · 0)`,
    ]);
  });

  it('adds several subjects one by one, and what was added stays when another fails', async () => {
    await render();
    await createClass('2.º DAW B');
    const service = TestBed.inject(GroupService);
    const real = service.addGroup.bind(service);
    vi.spyOn(service, 'addGroup')
      .mockImplementationOnce(real)
      .mockRejectedValueOnce(new DataError('network'));

    // In the order of the list: client web development is added, advanced programming fails
    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    const dialog = await openedDialog();
    await chooseSubjects(dialog, ADVANCED, WEB);
    await userEvent.click(addButton(dialog));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    await cancel();
    expect(screen.getByText('Asignatura añadida')).toBeTruthy();
    expect(subjects()).toEqual([`${WEB} (Marta · 0)`]);

    await addSubject(ADVANCED, BASIC);

    expect(screen.getByText('Asignaturas añadidas')).toBeTruthy();
    expect(subjects()).toEqual([
      `${WEB} (Marta · 0)`,
      `${ADVANCED} (Marta · 0)`,
      `${BASIC} (Marta · 0)`,
    ]);
  });

  it('offers the classes of the years before, with the students who finished', async () => {
    await render(URL, { history: true });

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAW_NAME);
    await userEvent.click(screen.getByRole('combobox', { name: 'Curso' }));
    expect((await screen.findAllByRole('option')).map((option) => text(option))).toEqual([
      '2026/27',
      '2025/26',
      '2024/25',
      '2023/24',
      '2022/23',
      '2021/22',
    ]);
    await userEvent.click(screen.getByRole('option', { name: '2023/24' }));
    await settle();

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain('1.º DAM B');
    const label = '1.º DAM B · 2023/24';
    expect(text(studentsOf(label))).toContain('Alumnado (8)');
    expect(within(studentsOf(label)).getAllByText('(cuenta desactivada)')).toHaveLength(8);
  });

  it('warns of a group it could not remove', async () => {
    await render();
    await addSubject(ADVANCED);

    await userEvent.click(await action(`1.º DAW A · ${ADVANCED}`, 'Eliminar'));
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Eliminar');

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(subjects()).toContain(`${ADVANCED} (Marta · 24)`);
  });

  it('enrolls students in one group only', async () => {
    await render();

    await userEvent.click(await action(`1.º DAW A · ${BASIC}`, 'Matricular solo aquí…'));
    const dialog = await openedDialog(`Matricular en ${DAW} · ${BASIC}`);
    const search = within(dialog).getByRole('tab', { name: 'Buscar' });
    await userEvent.click(search);
    await vi.waitFor(() => expect(search.getAttribute('aria-selected')).toBe('true'));
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
    expect(subjects()).toContain(`${BASIC} (Marta · 25)`);
    // In that group only, from another class
    const elena = within(studentsOf(DAW)).getByRole('checkbox', {
      name: `Elena Vázquez Lorenzo está en ${BASIC}`,
    });
    expect(elena).toHaveProperty('checked', true);
    expect(text(elena.closest('tr'))).toContain('De otra clase');
  });

  it('updates the counts of the subjects when the students change', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Lucía Martín Gómez' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Quitar de la clase' }));
    await confirm('Quitar de la clase');

    expect(subjects()).toEqual([
      `${WEB} (Marta · 23)`,
      `${BASIC} (Marta · 23)`,
      `${ENGLISH} (Desdoble inglés · Javier · 0)`,
    ]);
  });

  it('shows a skeleton while the classes load', async () => {
    await render(URL, { latency: 600 });

    expect(await screen.findByText('Cargando las clases…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Añadir clase' })).toHaveProperty('disabled', true);
    await settle();
    expect(screen.getByText(DAW_NAME)).toBeTruthy();
  });

  it('shows the error of the page with its retry', async () => {
    await render(URL, { prepare: () => TestBed.inject(MockNetwork).failNextRequest('network') });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(screen.getByText(DAW_NAME)).toBeTruthy();
  });

  it('needs the subjects, and the teachers for an administrator', async () => {
    await render(URL, {
      prepare: () =>
        vi
          .spyOn(TestBed.inject(MockExerciseService), 'listSubjects')
          .mockRejectedValueOnce(new DataError('network')),
    });
    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');

    TestBed.resetTestingModule();
    await render(URL, {
      role: 'admin',
      prepare: () =>
        vi
          .spyOn(TestBed.inject(MockGroupService), 'listTeachers')
          .mockRejectedValueOnce(new DataError('network')),
    });
    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(screen.getByRole('combobox', { name: 'Clase' })).toBeTruthy();
  });

  it('shows the empty state without classes, for a teacher and for an administrator', async () => {
    const noClasses = () => {
      const db = TestBed.inject(MockDb);
      db.update('groups', () => []);
      db.update('classes', () => []);
    };
    await render(URL, { prepare: noClasses });
    expect(screen.getByText('Aún no tienes clases')).toBeTruthy();
    expect(screen.getByText(/Crea una, o únete a la de otro docente/)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Añadir clase' })[1]);
    expect(await screen.findByRole('dialog', { name: 'Añadir una clase' })).toBeTruthy();

    TestBed.resetTestingModule();
    await render(URL, { role: 'admin', prepare: noClasses });
    expect(screen.getByText('Aún no hay clases')).toBeTruthy();
  });
});
