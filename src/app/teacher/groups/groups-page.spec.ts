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
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { GroupsPage } from './groups-page';
import { nextSchoolYear } from './school-year';

const URL = '/docente/grupos';
const DAW = '1.º DAW A · 2026/27';
const DAM = '1.º DAM B · 2026/27';
const BASIC = 'Programación básica';
const ADVANCED = 'Programación avanzada';
const WEB = 'Desarrollo web en entorno cliente';
const ENGLISH = `${BASIC} · Desdoble inglés`;
const MARTA = 'Marta Ibáñez Soler';
const JAVIER = 'Javier Ortega Ruiz';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** The text of an element word by word, as it reads, without the names of its icons. */
function words(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('mat-icon')) parts.push(node.textContent ?? '');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
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
    }: { role?: Role; userId?: string; prepare?: () => void; latency?: number } = {},
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

  /** The subjects of the class shown, as their list says them. */
  function subjects(): string[] {
    const region = screen.getByRole('region', { name: 'Asignaturas' });
    return within(region)
      .getAllByRole('listitem')
      .map((item) => words(item));
  }

  /** The zone of the students of the class shown, named after it. */
  function studentsOf(label: string): HTMLElement {
    return screen.getByRole('region', { name: label });
  }

  async function choose(label: string): Promise<void> {
    await userEvent.click(screen.getByRole('combobox', { name: 'Clase' }));
    await userEvent.click(await screen.findByRole('option', { name: label }));
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

  /** Chooses subjects in a list that stays open until Escape. */
  async function pickSubjects(dialog: HTMLElement, ...names: string[]): Promise<void> {
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Tus asignaturas en ella' }),
    );
    for (const name of names) await userEvent.click(await screen.findByRole('option', { name }));
    await userEvent.keyboard('{Escape}');
  }

  /** A new class of the user with the subjects given, which the page then shows. */
  async function createClass(name: string, ...subjectNames: string[]): Promise<void> {
    await userEvent.click(screen.getAllByRole('button', { name: 'Nueva clase' })[0]);
    const dialog = await openedDialog('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), name);
    if (subjectNames.length > 0) await pickSubjects(dialog, ...subjectNames);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));
    await closed();
  }

  /** A subject of the user in the class shown. */
  async function addSubject(subject: string, label?: string): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: subject }));
    if (label !== undefined) {
      const field = within(dialog).getByRole('textbox', { name: 'Nombre del desdoble' });
      await userEvent.clear(field);
      await userEvent.type(field, label);
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    await closed();
  }

  afterEach(() => localStorage.clear());

  it('has no class nor subjects to offer before its classes arrive', async () => {
    await render(URL, { latency: 10_000 });
    // Defensive: the template reads them only once the classes are there
    const page = harness.routeDebugElement!.componentInstance as GroupsPage;

    expect(page['options']()).toEqual([]);
    expect(page['groupRows']()).toEqual([]);
  });

  it('shows the class of the teacher with every subject, those of other teachers too', async () => {
    await render();

    expect(screen.getByRole('heading', { level: 1, name: 'Grupos y matrícula' })).toBeTruthy();
    expect(screen.getByText(/Tus clases, que compartes con sus otros docentes/)).toBeTruthy();
    // A single class: its name, without a selector
    expect(screen.queryByRole('combobox', { name: 'Clase' })).toBeNull();
    expect(screen.getByText(DAW)).toBeTruthy();
    expect(subjects()).toEqual([
      `${WEB} ${MARTA} · 24 alumnos`,
      `${BASIC} ${MARTA} · 24 alumnos`,
      `${ENGLISH} ${JAVIER} · Sin alumnos`,
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

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAW);
    // Not their class: they only duplicate their split
    await expectMenu(DAW, ['Duplicar…']);
    expect(screen.getByRole('button', { name: `Acciones de 1.º DAW A · ${ENGLISH}` })).toBeTruthy();

    await choose(DAM);
    expect(url()).toBe(`${URL}?clase=${DAM_CLASS_ID}`);
    expect(subjects()).toEqual([
      `${ADVANCED} ${JAVIER} · 6 alumnos`,
      `${BASIC} ${JAVIER} · 6 alumnos`,
    ]);
    expect(text(studentsOf(DAM))).toContain('Alumnado (6)');
  });

  it('shows the first class for an unknown one in the URL', async () => {
    await render(`${URL}?clase=nope`, { userId: OTHER_TEACHER_ID });

    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(DAM);
  });

  it('shows every class to an administrator, who chooses the teacher of a new one', async () => {
    await render(URL, { role: 'admin' });

    expect(screen.getByText(/Las clases del centro, sus asignaturas y su alumnado/)).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: 'Clase' }));
    expect((await screen.findAllByRole('option')).map((option) => text(option))).toEqual([
      DAM,
      DAW,
    ]);
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Nueva clase' }));
    const dialog = await openedDialog('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW A');
    await pickSubjects(dialog, ADVANCED);
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: JAVIER }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));
    await closed();

    expect(screen.getByText('Clase creada')).toBeTruthy();
    expect(subjects()).toEqual([`${ADVANCED} ${JAVIER} · Sin alumnos`]);
  });

  it('lets an administrator add a subject of any teacher', async () => {
    await render(`${URL}?clase=${DAW_CLASS_ID}`, { role: 'admin' });

    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: ADVANCED }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Docente' }));
    await userEvent.click(await screen.findByRole('option', { name: JAVIER }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    await closed();

    expect(subjects()).toContain(`${ADVANCED} ${JAVIER} · 24 alumnos`);
  });

  it('creates a class, which is chosen, empty, and removes it', async () => {
    await render();

    await createClass('2.º DAW B');
    const label = '2.º DAW B · 2026/27';
    expect(screen.getByText('Clase creada')).toBeTruthy();
    expect(url()).toMatch(/\?clase=/);
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(label);
    expect(screen.getByText('Aún no tiene asignaturas. Añade las tuyas.')).toBeTruthy();
    expect(screen.getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    // Nothing of the user to duplicate in it
    await expectMenu(label, ['Editar', 'Eliminar']);

    await userEvent.click(await action(label, 'Eliminar'));
    await cancel();
    expect(screen.getByText(label)).toBeTruthy();

    await userEvent.click(await action(label, 'Eliminar'));
    await confirm('Eliminar');

    expect(screen.getByText(`Clase ${label} eliminada`)).toBeTruthy();
    expect(url()).toBe(URL);
    expect(screen.queryByRole('combobox', { name: 'Clase' })).toBeNull();
    expect(screen.getByText(DAW)).toBeTruthy();
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
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(label);
  });

  it('joins a class that exists with the subjects of the user', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Nueva clase' }));
    const dialog = await openedDialog('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '1.º dam b');
    expect(within(dialog).getByText(/Esta clase ya existe/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir mis asignaturas' }));
    expect(within(dialog).getByText('Elige las asignaturas que das en ella')).toBeTruthy();
    await pickSubjects(dialog, WEB);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir mis asignaturas' }));
    await closed();

    expect(screen.getByText('Asignaturas añadidas a la clase')).toBeTruthy();
    expect(url()).toBe(`${URL}?clase=${DAM_CLASS_ID}`);
    // It takes the students of the class
    expect(subjects()).toContain(`${WEB} ${MARTA} · 6 alumnos`);
    // Not their class: they only duplicate their subject
    await expectMenu(DAM, ['Duplicar…']);
  });

  it('opens a new class without suggestions if the classes could not be read', async () => {
    await render();

    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(screen.getByRole('button', { name: 'Nueva clase' }));
    const dialog = await openedDialog('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '1.º DAW A');
    expect(within(dialog).queryByText(/Esta clase ya existe/)).toBeNull();
    await cancel();

    expect(screen.queryByText('Clase creada')).toBeNull();
    expect(url()).toBe(URL);
  });

  it('keeps the dialog of a class open when saving fails', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Nueva clase' }));
    const dialog = await openedDialog('Nueva clase');
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Nombre' }), '2.º DAW B');
    const createClass = vi.spyOn(TestBed.inject(GroupService), 'createClass');
    createClass.mockRejectedValueOnce(new DataError('network'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la clase' }));

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
    expect(screen.getByText('1.º DAW Z · 2026/27')).toBeTruthy();
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
    expect(text(screen.getByRole('combobox', { name: 'Clase' }))).toContain(`1.º DAW A · ${year}`);
    // A new year is a new class: without students
    expect(subjects()).toEqual([
      `${WEB} ${MARTA} · Sin alumnos`,
      `${BASIC} ${MARTA} · Sin alumnos`,
    ]);
  });

  it('adds a split of a subject the class has, edits its label and removes it', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Añadir asignatura' }));
    await cancel();
    expect(screen.queryByText('Asignatura añadida')).toBeNull();

    await addSubject(BASIC);
    const split = `${BASIC} · Desdoble 3`;
    expect(screen.getByText('Asignatura añadida')).toBeTruthy();
    // A split starts without students: they are chosen
    expect(subjects()).toContain(`${split} ${MARTA} · Sin alumnos`);

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
    expect(subjects()).toContain(`${renamed} ${MARTA} · Sin alumnos`);

    await userEvent.click(await action(`1.º DAW A · ${renamed}`, 'Eliminar'));
    await cancel();
    expect(subjects()).toContain(`${renamed} ${MARTA} · Sin alumnos`);

    await userEvent.click(await action(`1.º DAW A · ${renamed}`, 'Eliminar'));
    dialog = await openedDialog();
    expect(within(dialog).getByRole('heading').textContent).toContain(
      `¿Eliminar el grupo 1.º DAW A · ${renamed}?`,
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await closed();

    expect(screen.getByText(`Grupo 1.º DAW A · ${renamed} eliminado`)).toBeTruthy();
    expect(subjects()).not.toContain(`${renamed} ${MARTA} · Sin alumnos`);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('adds a subject of the whole class, which takes its students', async () => {
    await render();

    await addSubject(ADVANCED);

    expect(subjects()).toEqual([
      `${WEB} ${MARTA} · 24 alumnos`,
      `${ADVANCED} ${MARTA} · 24 alumnos`,
      `${BASIC} ${MARTA} · 24 alumnos`,
      `${ENGLISH} ${JAVIER} · Sin alumnos`,
    ]);
  });

  it('warns of a group it could not remove', async () => {
    await render();
    await addSubject(ADVANCED);

    await userEvent.click(await action(`1.º DAW A · ${ADVANCED}`, 'Eliminar'));
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Eliminar');

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(subjects()).toContain(`${ADVANCED} ${MARTA} · 24 alumnos`);
  });

  it('enrolls students in one group only', async () => {
    await render();

    await userEvent.click(await action(`1.º DAW A · ${BASIC}`, 'Matricular solo aquí…'));
    const dialog = await openedDialog(`Matricular en ${DAW} · ${BASIC}`);
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
    expect(subjects()).toContain(`${BASIC} ${MARTA} · 25 alumnos`);
    expect(text(studentsOf(DAW))).toContain(`De otra clase: ${BASIC}`);
  });

  it('updates the counts of the subjects when the students change', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Lucía Martín Gómez' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Quitar de la clase' }));
    await confirm('Quitar de la clase');

    expect(subjects()).toEqual([
      `${WEB} ${MARTA} · 23 alumnos`,
      `${BASIC} ${MARTA} · 23 alumnos`,
      `${ENGLISH} ${JAVIER} · Sin alumnos`,
    ]);
  });

  it('shows a skeleton while the classes load', async () => {
    await render(URL, { latency: 600 });

    expect(await screen.findByText('Cargando las clases…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva clase' })).toHaveProperty('disabled', true);
    await settle();
    expect(screen.getByText(DAW)).toBeTruthy();
  });

  it('shows the error of the page with its retry', async () => {
    await render(URL, { prepare: () => TestBed.inject(MockNetwork).failNextRequest('network') });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(screen.getByText(DAW)).toBeTruthy();
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Nueva clase' })[1]);
    expect(await screen.findByRole('dialog', { name: 'Nueva clase' })).toBeTruthy();

    TestBed.resetTestingModule();
    await render(URL, { role: 'admin', prepare: noClasses });
    expect(screen.getByText('Aún no hay clases')).toBeTruthy();
  });
});
