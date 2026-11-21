import { Clipboard } from '@angular/cdk/clipboard';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { GroupService, type ManagedGroup } from '../../data/group-service';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import {
  DAM_STUDENT_IDS,
  DAW_CLASS_ID,
  DAW_ENGLISH_GROUP_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  DISABLED_STUDENT_ID,
  NEW_STUDENT_IDS,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { sortClassGroups } from './class-list';
import { ClassStudents } from './class-students';

const CLASS_NAME = '1.º DAW A · 2026/27';
const BASIC = 'Programación básica';
const WEB = 'Desarrollo web en entorno cliente';
const ENGLISH = `${BASIC} · Desdoble inglés`;
const AFTERNOON = `${BASIC} · Desdoble tarde`;
const LUCIA = 'Lucía Martín Gómez';
const ELENA = 'Elena Vázquez Lorenzo';
const AYA = 'Aya Benali Haddad';
const RAUL = 'Raúl Medina Cortés';
/** An empty class of Marta's, with neither students nor subjects. */
const EMPTY_CLASS_ID = 'empty-class';
/** Last year's class of Marta's, with Lucía and Elena: it lends its students. */
const LAST_YEAR_CLASS_ID = 'last-year-class';
const LAST_YEAR = '1.º DAW A · 2025/26';
/** A split of basic programming of Marta's in 1.º DAW A, without students. */
const AFTERNOON_GROUP_ID = 'afternoon-group';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * 1.º DAW A as Marta sees it, with some changes: Lucía does not take web, Hugo is in the split in
 * English, Aya's account is disabled and she does not take web either, Elena (of 1.º DAM B) takes
 * web here, Raúl (disabled, of no class) takes basic programming here, and Marta has a split of
 * basic programming of her own. Marta also has an empty class and last year's, with Lucía and Elena.
 */
function prepare(db: MockDb): void {
  const [lucia, hugo, aya] = DAW_STUDENT_IDS;
  db.update('enrollments', (rows) => [
    ...rows.filter(
      (row) => row.groupId !== DAW_WEB_GROUP_ID || (row.userId !== lucia && row.userId !== aya),
    ),
    { id: 'e-hugo', groupId: DAW_ENGLISH_GROUP_ID, userId: hugo },
    { id: 'e-elena', groupId: DAW_WEB_GROUP_ID, userId: DAM_STUDENT_IDS[0] },
    { id: 'e-raul', groupId: DAW_GROUP_ID, userId: DISABLED_STUDENT_ID },
  ]);
  db.update('users', (users) =>
    users.map((user) => (user.id === aya ? { ...user, status: 'disabled' } : user)),
  );
  db.update('groups', (groups) => [
    ...groups,
    {
      id: AFTERNOON_GROUP_ID,
      classId: DAW_CLASS_ID,
      subjectId: BASIC_PROGRAMMING_ID,
      label: 'Desdoble tarde',
      teacherId: TEACHER_ID,
    },
  ]);
  db.update('classes', (classes) => [
    ...classes,
    {
      id: EMPTY_CLASS_ID,
      name: '2.º DAW A',
      schoolYear: '2026/27',
      createdBy: TEACHER_ID,
      createdAt: '2026-09-01T08:00:00.000Z',
      reopened: false,
    },
    {
      id: LAST_YEAR_CLASS_ID,
      name: '1.º DAW A',
      schoolYear: '2025/26',
      createdBy: TEACHER_ID,
      createdAt: '2025-09-01T08:00:00.000Z',
      reopened: false,
    },
  ]);
  db.update('classMembers', (rows) => [
    ...rows,
    { classId: LAST_YEAR_CLASS_ID, userId: lucia },
    { classId: LAST_YEAR_CLASS_ID, userId: DAM_STUDENT_IDS[0] },
  ]);
}

describe('ClassStudents', () => {
  let fixture: ComponentFixture<ClassStudents>;
  let changed: ReturnType<typeof vi.fn<() => void>>;
  let copy: ReturnType<typeof vi.fn<(text: string) => boolean>>;
  let groups: readonly ManagedGroup[];

  async function render({
    fail = false,
    classId = DAW_CLASS_ID,
    latency = 0,
  }: { fail?: boolean; classId?: string; latency?: number } = {}): Promise<void> {
    localStorage.clear();
    copy = vi.fn<(text: string) => boolean>(() => true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MockGroupService,
        { provide: GroupService, useExisting: MockGroupService },
        { provide: Clipboard, useValue: { copy } },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    const db = TestBed.inject(MockDb);
    db.setSession(TEACHER_ID);
    prepare(db);
    const classes = await TestBed.inject(GroupService).listClasses();
    const managed = classes.find(({ schoolClass }) => schoolClass.id === classId);
    // In the order of the list of the page
    groups = sortClassGroups(managed?.groups ?? [], 'es');
    TestBed.inject(MockNetwork).setLatency({ min: latency, max: latency });
    if (fail) TestBed.inject(MockNetwork).failNextRequest('network');
    fixture = TestBed.createComponent(ClassStudents);
    changed = vi.fn<() => void>();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.componentRef.setInput('classId', classId);
    fixture.componentRef.setInput('className', CLASS_NAME);
    fixture.componentRef.setInput('schoolClass', { name: '1.º DAW A', schoolYear: '2026/27' });
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('sources', [{ id: LAST_YEAR_CLASS_ID, label: LAST_YEAR }]);
    // Settling waits for what loads: a slow load is watched while it lasts
    if (latency === 0) await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
  }

  /** The group of the fixture with that id. */
  function group(id: string): ManagedGroup {
    const found = groups.find((managed) => managed.group.id === id);
    if (!found) throw new Error(`No group ${id}`);
    return found;
  }

  /** The names of the students, as the rows of the table start. */
  function names(): string[] {
    return screen.getAllByRole('rowheader').map((header) => text(header.querySelector('span')));
  }

  function row(name: string): HTMLElement {
    const header = screen
      .getAllByRole('rowheader')
      .find((item) => text(item.querySelector('span')) === name);
    if (!header) throw new Error(`No row for ${name}`);
    return header.closest('tr') as HTMLElement;
  }

  /**
   * Within the row of the student: computing the accessible name of every checkbox of the table,
   * as `screen` does, made the tests that wait for one slow enough to time out under load.
   */
  function box(name: string, group: string, enrolled: boolean): HTMLInputElement {
    return within(row(name)).getByRole('checkbox', {
      name: `${name} ${enrolled ? 'está' : 'no está'} en ${group}`,
    });
  }

  /** Opens a menu by its button, once it is there: those opened before may still be closing. */
  async function openMenu(name: string): Promise<HTMLElement> {
    const trigger = screen.getByRole('button', { name });
    await userEvent.click(trigger);
    return vi.waitFor(() => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
      expect(panel).not.toBeNull();
      return panel as HTMLElement;
    });
  }

  /** The items of a menu, in order; closed as it was opened, with its button. */
  async function expectMenu(name: string, expected: string[]): Promise<void> {
    const menu = await openMenu(name);
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(expected.length);
    expected.forEach((label, index) =>
      expect(within(menu).getByRole('menuitem', { name: label })).toBe(items[index]),
    );
    const trigger = screen.getByRole('button', { name });
    await userEvent.click(trigger);
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  }

  /** The name of the menu of a column: the class and its group. */
  function groupActions(title: string): string {
    return `Acciones de 1.º DAW A · ${title}`;
  }

  async function act(name: string, item: string): Promise<void> {
    const menu = await openMenu(`Acciones de ${name}`);
    await userEvent.click(within(menu).getByRole('menuitem', { name: item }));
  }

  async function exportAs(item: string): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Exportar el alumnado' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
  }

  /** The button of the notice: it moves its content where screen readers hear it, after a moment. */
  async function undo(): Promise<void> {
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await settle();
  }

  /** Answers the confirmation, and waits until it is gone. */
  async function confirm(button: string): Promise<void> {
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.click(within(dialog).getByRole('button', { name: button }));
    await closed();
  }

  async function opened(name: string): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog', { name });
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return dialog;
  }

  async function closed(): Promise<void> {
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settle();
  }

  async function tab(dialog: HTMLElement, name: string): Promise<void> {
    const label = within(dialog).getByRole('tab', { name });
    await userEvent.click(label);
    await vi.waitFor(() => expect(label.getAttribute('aria-selected')).toBe('true'));
  }

  function heading(): HTMLElement {
    return screen.getByRole('heading', { name: /Alumnado/ });
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists the students of the class by name, with their email or their state', async () => {
    await render();

    // Elena is of another class and Raúl of none: they are not counted
    expect(text(heading())).toBe('Alumnado (24)');
    expect(
      screen.getByRole('table', { name: 'Alumnado de 1.º DAW A · 2026/27 y sus asignaturas' }),
    ).toBeTruthy();
    expect(names()).toHaveLength(26);
    expect(names()).toEqual([...names()].sort((a, b) => a.localeCompare(b, 'es')));
    expect(screen.getByTitle('lucia.martin@tutoria.test').textContent).toBe(LUCIA);
    expect(text(row(AYA))).toContain('(cuenta desactivada)');
    expect(text(row(ELENA))).toContain('De otra clase');
    expect(text(row(RAUL))).toContain('(cuenta desactivada)');
    expect(text(row(LUCIA))).not.toMatch(/desactivada|De otra clase/);
    expect(screen.queryByText(/Aún no tiene asignaturas/)).toBeNull();
  });

  it('has a column per group, with the initials of its subject, its split, teacher and count', async () => {
    await render();

    const heads = screen.getAllByRole('columnheader');
    expect(heads.map((head) => head.getAttribute('title') ?? text(head))).toEqual([
      'Alumno',
      WEB,
      BASIC,
      ENGLISH,
      AFTERNOON,
      'Acciones',
    ]);
    const count = (id: string) => group(id).studentCount;
    expect(within(heads[1]).getByText('DWEC')).toBeTruthy();
    expect(within(heads[1]).getByText(`Marta · ${count(DAW_WEB_GROUP_ID)}`)).toBeTruthy();
    expect(within(heads[2]).getByText('PB')).toBeTruthy();
    expect(within(heads[2]).getByText(`Marta · ${count(DAW_GROUP_ID)}`)).toBeTruthy();
    expect(
      within(heads[3]).getByText(`Desdoble inglés · Javier · ${count(DAW_ENGLISH_GROUP_ID)}`),
    ).toBeTruthy();
    expect(within(heads[4]).getByText('Desdoble tarde · Marta · 0')).toBeTruthy();
    // The groups of the user have their menu; that of another teacher says whose it is
    expect(within(heads[1]).getByRole('button', { name: groupActions(WEB) })).toBeTruthy();
    expect(within(heads[4]).getByRole('button', { name: groupActions(AFTERNOON) })).toBeTruthy();
    expect(within(heads[3]).queryByRole('button')).toBeNull();
    expect(within(heads[3]).getByText('La da Javier Ortega Ruiz')).toBeTruthy();
  });

  it('offers in the head of each group of the user to edit it, see its blocks or remove it', async () => {
    await render();
    const edit = vi.fn<(managed: ManagedGroup) => void>();
    const remove = vi.fn<(managed: ManagedGroup) => void>();
    fixture.componentInstance.editGroup.subscribe(edit);
    fixture.componentInstance.removeGroup.subscribe(remove);

    await expectMenu(groupActions(AFTERNOON), [
      'Editar',
      'Ver sus bloques',
      'Matricular solo aquí…',
      'Eliminar',
    ]);

    let menu = await openMenu(groupActions(WEB));
    expect(
      within(menu).getByRole('menuitem', { name: 'Ver sus bloques' }).getAttribute('href'),
    ).toBe(`${APP_PATHS.teacher.blocks}?${TEACHER_PARAMS.group}=${DAW_WEB_GROUP_ID}`);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Editar' }));
    expect(edit).toHaveBeenCalledWith(group(DAW_WEB_GROUP_ID));

    menu = await openMenu(groupActions(AFTERNOON));
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }));
    expect(remove).toHaveBeenCalledWith(group(AFTERNOON_GROUP_ID));
  });

  it('does not offer to remove a group with work, saying why', async () => {
    await render();
    const remove = vi.fn<(managed: ManagedGroup) => void>();
    fixture.componentInstance.removeGroup.subscribe(remove);
    fixture.componentRef.setInput(
      'groups',
      groups.map((managed) =>
        managed.group.id === DAW_WEB_GROUP_ID ? { ...managed, started: true } : managed,
      ),
    );
    await settle();

    const menu = await openMenu(groupActions(WEB));
    const item = within(menu).getByRole('menuitem', { name: /^Eliminar/ });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(text(item)).toContain('No se puede eliminar: ya hay alumnos con trabajo en este grupo.');
    await userEvent.click(item);
    expect(remove).not.toHaveBeenCalled();
  });

  it('adds a subject only when the page can', async () => {
    await render();
    const add = vi.fn<() => void>();
    fixture.componentInstance.addGroup.subscribe(add);
    const button = screen.getByRole('button', { name: 'Añadir asignatura' });
    expect(button).toHaveProperty('disabled', true);

    fixture.componentRef.setInput('canAddGroup', true);
    await settle();
    expect(button).toHaveProperty('disabled', false);
    await userEvent.click(button);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('checks the groups of the user, and only shows those of other teachers', async () => {
    await render();

    expect(box(LUCIA, BASIC, true).checked).toBe(true);
    expect(box(LUCIA, WEB, false).checked).toBe(false);
    expect(box(LUCIA, AFTERNOON, false).checked).toBe(false);
    // Javier's split: no checkbox, only what it is
    expect(screen.queryByRole('checkbox', { name: new RegExp(ENGLISH) })).toBeNull();
    expect(
      screen.getByRole('img', { name: `Hugo Sánchez Ferrer está en ${ENGLISH}` }).textContent,
    ).toBe('check');
    expect(screen.getByRole('img', { name: `${LUCIA} no está en ${ENGLISH}` }).textContent).toBe(
      '—',
    );
    // A disabled account is only taken out
    expect(box(AYA, BASIC, true).disabled).toBe(false);
    expect(box(AYA, WEB, false).disabled).toBe(true);
    expect(box(ELENA, WEB, true).checked).toBe(true);
  });

  it('offers in each row to take a member out of the class, or to add a student to it', async () => {
    await render();

    await expectMenu(`Acciones de ${LUCIA}`, ['Quitar de la clase']);
    await expectMenu(`Acciones de ${ELENA}`, ['Añadir a la clase']);
    await expectMenu(`Acciones de ${AYA}`, ['Quitar de la clase']);
    // Disabled, and of no class: nothing to do
    expect(screen.queryByRole('button', { name: `Acciones de ${RAUL}` })).toBeNull();
  });

  it('enrolls with a checkbox at once, and undoes it from the notice', async () => {
    await render();

    await userEvent.click(box(LUCIA, WEB, false));
    await settle();
    expect(await screen.findByText(`Alta de ${LUCIA} en ${WEB}`)).toBeTruthy();
    expect(box(LUCIA, WEB, true).checked).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);

    await undo();
    await vi.waitFor(() => expect(box(LUCIA, WEB, false).checked).toBe(false));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('unenrolls with a checkbox at once, and undoes it from the notice', async () => {
    await render();

    await userEvent.click(box(LUCIA, BASIC, true));
    await settle();
    expect(await screen.findByText(`Baja de ${LUCIA} en ${BASIC}`)).toBeTruthy();
    expect(box(LUCIA, BASIC, false).checked).toBe(false);

    await undo();
    await vi.waitFor(() => expect(box(LUCIA, BASIC, true).checked).toBe(true));
  });

  it('names the group in its notice, which a new one replaces without undoing it', async () => {
    await render();

    await userEvent.click(box(LUCIA, AFTERNOON, false));
    await settle();
    expect(await screen.findByText(`Alta de ${LUCIA} en ${AFTERNOON}`)).toBeTruthy();

    await userEvent.click(box(LUCIA, AFTERNOON, true));
    await settle();
    expect(await screen.findByText(`Baja de ${LUCIA} en ${AFTERNOON}`)).toBeTruthy();
    // The notice before may still be closing
    await vi.waitFor(() => expect(screen.queryByText(/Alta de/)).toBeNull());
    expect(box(LUCIA, AFTERNOON, false).checked).toBe(false);
  });

  it('says why a checkbox failed, puts it back and reloads', async () => {
    await render();
    const listRoster = vi.spyOn(TestBed.inject(GroupService), 'listRoster');

    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(box(LUCIA, WEB, false));
    await settle();

    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    await vi.waitFor(() => expect(box(LUCIA, WEB, false).checked).toBe(false));
    expect(listRoster).toHaveBeenCalledWith(DAW_CLASS_ID);
    expect(changed).toHaveBeenCalled();
  });

  it('takes a student out of the class after asking, keeping the focus in the class', async () => {
    await render();

    await act(LUCIA, 'Quitar de la clase');
    await confirm('Cancelar');
    expect(text(heading())).toBe('Alumnado (24)');
    expect(changed).not.toHaveBeenCalled();

    await act(LUCIA, 'Quitar de la clase');
    await confirm('Quitar de la clase');

    expect(await screen.findByText(`${LUCIA} ya no está en la clase`)).toBeTruthy();
    expect(names()).not.toContain(LUCIA);
    expect(text(heading())).toBe('Alumnado (23)');
    expect(document.activeElement?.contains(heading())).toBe(true);
    expect(changed).toHaveBeenCalled();
  });

  it('says why a student could not be taken out of the class', async () => {
    await render();

    await act(LUCIA, 'Quitar de la clase');
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Quitar de la clase');

    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    expect(screen.queryByText(`${LUCIA} ya no está en la clase`)).toBeNull();
    expect(names()).toContain(LUCIA);
  });

  it('adds a student of another class to this one, or says why not', async () => {
    await render();

    TestBed.inject(MockNetwork).failNextRequest('network');
    await act(ELENA, 'Añadir a la clase');
    await settle();
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (24)');

    await act(ELENA, 'Añadir a la clase');
    await settle();
    expect(await screen.findByText(`${ELENA} ya está en la clase`)).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (25)');
    // In the groups of the whole class
    expect(box(ELENA, BASIC, true).checked).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('downloads the list as a CSV named after the class', async () => {
    await render();
    let saved: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:roster';
    });
    const revokeObjectURL = vi.fn();
    // Assigned and put back, not stubbed: the whole URL is needed by others
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    try {
      await exportAs('Descargar la lista (CSV)');
    } finally {
      Object.assign(URL, original);
    }

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('1.º DAW A 2026-27.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:roster');
    const lines = (await saved!.text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe(`Nombre;Correo;En la clase;${WEB};${BASIC};${ENGLISH};${AFTERNOON}`);
    // A line per student, in the order of the table, and the last break
    expect(lines).toHaveLength(26 + 2);
    expect(lines).toContain(`${LUCIA};lucia.martin@tutoria.test;Sí;No;Sí;No;No`);
    expect(lines).toContain(`${ELENA};elena.vazquez@tutoria.test;No;Sí;No;No;No`);
  });

  it('copies the emails of the class, one per line', async () => {
    await render();

    await exportAs('Copiar los correos');

    expect(await screen.findByText('24 correos copiados')).toBeTruthy();
    const emails = copy.mock.calls[0][0].split('\n');
    expect(emails).toHaveLength(24);
    expect(emails[0]).toBe('adrian.lopez@tutoria.test');
    // Of the class only
    expect(emails).toContain('aya.benali@tutoria.test');
    expect(emails).not.toContain('elena.vazquez@tutoria.test');
  });

  it('filters the students, and starts again without a filter in another class', async () => {
    await render();
    const filter = screen.getByRole('searchbox', { name: 'Filtrar alumnos' });

    await userEvent.type(filter, 'LUCIA');
    expect(names()).toEqual([LUCIA]);
    await userEvent.type(filter, 'zz');
    expect(screen.getByText('Nadie coincide')).toBeTruthy();

    fixture.componentRef.setInput('classId', EMPTY_CLASS_ID);
    fixture.componentRef.setInput('groups', []);
    await settle();
    expect(screen.queryByRole('searchbox', { name: 'Filtrar alumnos' })).toBeNull();
    expect(screen.getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    expect(screen.getByText('Aún no tiene asignaturas. Añade las tuyas.')).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (0)');
    // Nothing to export
    expect(screen.getByRole('button', { name: 'Exportar el alumnado' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows a class of a past year without anything that changes it (5.2e)', async () => {
    await render();
    fixture.componentRef.setInput('readOnly', true);
    await settle();

    expect(screen.queryByRole('button', { name: /Matricular en la clase/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Añadir asignatura/ })).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // Without students, it does not say how to enroll them
    fixture.componentRef.setInput('classId', EMPTY_CLASS_ID);
    await settle();
    expect(screen.getAllByText('Esta clase aún no tiene alumnos')).not.toHaveLength(0);
    expect(screen.queryByText(/Matricúlalos/)).toBeNull();
  });

  it('shows a skeleton while it loads, and reloads when asked', async () => {
    // Slow enough for the skeleton to show, after its wait
    await render({ latency: 600 });
    expect(await screen.findByText('Cargando el alumnado…')).toBeTruthy();
    await vi.waitFor(() => expect(names()).toHaveLength(26));

    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    const listRoster = vi.spyOn(TestBed.inject(GroupService), 'listRoster');
    fixture.componentInstance.reload();
    await settle();
    expect(listRoster).toHaveBeenCalledWith(DAW_CLASS_ID);
    // A reload keeps the list
    expect(screen.queryByText('Cargando el alumnado…')).toBeNull();
  });

  it('shows its error, with a retry', async () => {
    await render({ fail: true });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    expect(screen.getByRole('button', { name: 'Matricular en la clase' })).toHaveProperty(
      'disabled',
      true,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(names()).toHaveLength(26));
  });

  it('enrolls in the class those without a class this year, in its groups of the whole class', async () => {
    await render();
    const enrollInClass = vi.spyOn(TestBed.inject(GroupService), 'enrollInClass');

    await userEvent.click(screen.getByRole('button', { name: 'Matricular en la clase' }));
    let dialog = await opened(`Matricular en ${CLASS_NAME}`);
    expect(within(dialog).getByText(/Entran en todas sus asignaturas/)).toBeTruthy();
    // A search among those who are not in the class
    await tab(dialog, 'Buscar');
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    expect(await within(dialog).findByRole('checkbox', { name: /Elena Vázquez/ })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();
    expect(screen.queryByText('Matrícula guardada')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Matricular en la clase' }));
    dialog = await opened(`Matricular en ${CLASS_NAME}`);
    expect(within(dialog).getByRole('tab', { name: 'Sin clase este curso' })).toHaveProperty(
      'ariaSelected',
      'true',
    );
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: 'Seleccionar todos (3)' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (3)' }));
    await closed();

    expect(await screen.findByText('Matrícula guardada')).toBeTruthy();
    // By name: Claudia, Ismael, Marina
    expect(enrollInClass).toHaveBeenCalledWith(DAW_CLASS_ID, [...NEW_STUDENT_IDS].reverse());
    expect(text(heading())).toBe('Alumnado (27)');
    // In the groups of the whole class, not in the splits
    expect(box('Marina Vidal Soto', BASIC, true).checked).toBe(true);
    expect(box('Marina Vidal Soto', AFTERNOON, false).checked).toBe(false);
    expect(changed).toHaveBeenCalled();
  });

  it('enrolls in the class those a pasted list names', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Matricular en la clase' }));
    const dialog = await opened(`Matricular en ${CLASS_NAME}`);
    await tab(dialog, 'Pegar una lista');
    await userEvent.click(
      within(dialog).getByRole('textbox', { name: 'Correos o nombres, uno por línea' }),
    );
    await userEvent.paste('ismael.haddou@tutoria.test\nNadie Nunca');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));
    expect((await within(dialog).findByRole('status')).textContent).toContain('1 elegido');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    expect(text(heading())).toBe('Alumnado (25)');
    expect(names()).toContain('Ismael Haddou');
  });

  it('takes the active students of another class of the user, not those here already', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Matricular en la clase' }));
    const dialog = await opened(`Matricular en ${CLASS_NAME}`);
    await tab(dialog, 'De otra clase');
    await userEvent.click(
      within(dialog).getByRole('button', { name: `Añadir los de ${LAST_YEAR}` }),
    );

    // Lucía is in this class already
    expect(await within(dialog).findByRole('button', { name: 'Matricular (1)' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: `Quitar a ${ELENA}` })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();
  });

  it('enrolls in one group only, taking the active students of the class at once', async () => {
    await render();

    const menu = await openMenu(groupActions(AFTERNOON));
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Matricular solo aquí…' }));
    const dialog = await opened(`Matricular en ${CLASS_NAME} · ${AFTERNOON}`);
    expect(within(dialog).getByText(/Solo en esta asignatura/)).toBeTruthy();
    // Those of the class first, not those without a class: that is for the class
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((label) => text(label)),
    ).toEqual(['De esta clase', 'Pegar una lista', 'De otra clase', 'Buscar']);
    await tab(dialog, 'Buscar');
    await userEvent.type(within(dialog).getByRole('searchbox'), 'rubén');
    expect(await within(dialog).findByRole('checkbox', { name: /Rubén Cabrera/ })).toBeTruthy();

    await tab(dialog, 'De esta clase');
    // The members of the class whose account is active: neither Aya, nor Elena nor Raúl
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: 'Seleccionar todos (23)' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (23)' }));
    await closed();

    expect(await screen.findByText('Matrícula guardada')).toBeTruthy();
    expect(box(LUCIA, AFTERNOON, true).checked).toBe(true);
    expect(box(AYA, AFTERNOON, false).checked).toBe(false);

    // Who is in the split already is not offered again
    const again = await openMenu(groupActions(AFTERNOON));
    await userEvent.click(within(again).getByRole('menuitem', { name: 'Matricular solo aquí…' }));
    const second = await opened(`Matricular en ${CLASS_NAME} · ${AFTERNOON}`);
    expect(await within(second).findByText('Toda la clase está ya en este grupo.')).toBeTruthy();
  });
});
