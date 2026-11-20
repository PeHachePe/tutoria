import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

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
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { ClassStudents } from './class-students';

const CLASS_NAME = '1.º DAW A · 2026/27';
const BASIC = 'Programación básica';
const WEB = 'Desarrollo web en entorno cliente';
const LUCIA = 'Lucía Martín Gómez';
const ELENA = 'Elena Vázquez Lorenzo';
/** An empty class of Marta's, with neither students nor subjects. */
const EMPTY_CLASS_ID = 'empty-class';
/** A split of basic programming of Marta's in 1.º DAW A, without students. */
const AFTERNOON_GROUP_ID = 'afternoon-group';

/** What a row says besides the name and email of a student. */
const NOTE = /No cursa|De otra clase|Desdoble/;

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * 1.º DAW A as Marta sees it, with some changes: Lucía does not take web, Hugo is in the split in
 * English, Aya's account is disabled and she does not take web either, Elena (of 1.º DAM B) takes
 * web here, Raúl (disabled, of no class) takes basic programming here, and Marta has a split of
 * basic programming of her own.
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
    },
  ]);
}

describe('ClassStudents', () => {
  let fixture: ComponentFixture<ClassStudents>;
  let changed: ReturnType<typeof vi.fn<() => void>>;
  let groups: readonly ManagedGroup[];

  async function render({
    changes = prepare,
    fail = false,
    classId = DAW_CLASS_ID,
    latency = 0,
  }: {
    changes?: (db: MockDb) => void;
    fail?: boolean;
    classId?: string;
    latency?: number;
  } = {}): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [MockGroupService, { provide: GroupService, useExisting: MockGroupService }],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    const db = TestBed.inject(MockDb);
    db.setSession(TEACHER_ID);
    changes(db);
    const classes = await TestBed.inject(GroupService).listClasses();
    groups = classes.find(({ schoolClass }) => schoolClass.id === classId)?.groups ?? [];
    TestBed.inject(MockNetwork).setLatency({ min: latency, max: latency });
    if (fail) TestBed.inject(MockNetwork).failNextRequest('network');
    fixture = TestBed.createComponent(ClassStudents);
    changed = vi.fn<() => void>();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.componentRef.setInput('classId', classId);
    fixture.componentRef.setInput('className', CLASS_NAME);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('sources', []);
    // Settling waits for what loads: a slow load is watched while it lasts
    if (latency === 0) await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
  }

  function rows(): HTMLElement[] {
    return within(screen.getByRole('list', { name: 'Alumnado' })).getAllByRole('listitem');
  }

  function row(name: string): HTMLElement {
    const found = rows().find((item) => text(item).startsWith(name));
    if (!found) throw new Error(`No row for ${name}`);
    return found;
  }

  /** The items of the menu of a row, in order; the menus opened before may still be closing. */
  async function expectMenu(name: string, expected: string[]): Promise<void> {
    const trigger = screen.getByRole('button', { name: `Acciones de ${name}` });
    await userEvent.click(trigger);
    const menu = await vi.waitFor(() => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
      expect(panel).not.toBeNull();
      return panel as HTMLElement;
    });
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(expected.length);
    expected.forEach((label, index) =>
      expect(within(menu).getByRole('menuitem', { name: label })).toBe(items[index]),
    );
    // Closed as it was opened, with its button
    await userEvent.click(trigger);
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  }

  async function act(name: string, item: string): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: `Acciones de ${name}` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
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

  function heading(): HTMLElement {
    return screen.getByRole('heading', { name: /Alumnado/ });
  }

  afterEach(() => localStorage.clear());

  it('lists the students of the class by name, with what they take and their state', async () => {
    await render();

    // Elena is of another class and Raúl of none: they are not counted
    expect(text(heading())).toBe('Alumnado (24)');
    const names = rows().map((item) => text(item));
    expect(names).toHaveLength(26);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    expect(text(row(LUCIA))).toContain(`No cursa: ${WEB}`);
    expect(text(row('Hugo Sánchez Ferrer'))).toContain(`${BASIC} · Desdoble inglés`);
    expect(text(row('Aya Benali Haddad'))).toContain('(cuenta desactivada)');
    expect(text(row(ELENA))).toContain(`De otra clase: ${WEB}`);
    expect(text(row('Raúl Medina Cortés'))).toContain(`De otra clase: ${BASIC}`);
    expect(within(row('Carmen Navarro Gil')).queryByText(NOTE)).toBeNull();
  });

  it('offers in each row the groups of the user and the class', async () => {
    await render();

    // Marta's groups only, not the split in English of Javier's
    await expectMenu(LUCIA, [
      `Matricular en ${WEB}`,
      `Dar de baja de ${BASIC}`,
      `Matricular en ${BASIC} · Desdoble tarde`,
      'Quitar de la clase',
    ]);
    await expectMenu(ELENA, [
      `Dar de baja de ${WEB}`,
      `Matricular en ${BASIC}`,
      `Matricular en ${BASIC} · Desdoble tarde`,
      'Añadir a la clase',
    ]);
    // A disabled account is only taken out
    await expectMenu('Aya Benali Haddad', [`Dar de baja de ${BASIC}`, 'Quitar de la clase']);
    await expectMenu('Raúl Medina Cortés', [`Dar de baja de ${BASIC}`]);
  });

  it('unenrolls from a group after asking, keeping the focus in the class', async () => {
    await render();

    await act(LUCIA, `Dar de baja de ${BASIC}`);
    await confirm('Cancelar');
    expect(changed).not.toHaveBeenCalled();

    await act(LUCIA, `Dar de baja de ${BASIC}`);
    await confirm('Dar de baja del grupo');

    expect(screen.getByText(`${LUCIA} ya no está en ${BASIC}`)).toBeTruthy();
    expect(text(row(LUCIA))).toContain(`No cursa: ${WEB}, ${BASIC}`);
    expect(changed).toHaveBeenCalled();
    expect(document.activeElement?.contains(heading())).toBe(true);
  });

  it('enrolls in a group of the user, and adds a student of another class to this one', async () => {
    await render();

    await act(LUCIA, `Matricular en ${WEB}`);
    await settle();
    expect(screen.getByText(`${LUCIA} ya está en ${WEB}`)).toBeTruthy();
    expect(text(row(LUCIA))).not.toContain('No cursa');

    await act(ELENA, 'Añadir a la clase');
    await settle();
    expect(screen.getByText(`${ELENA} ya está en la clase`)).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (25)');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('takes a student out of the class after asking', async () => {
    await render();

    await act(LUCIA, 'Quitar de la clase');
    await confirm('Cancelar');
    expect(text(heading())).toBe('Alumnado (24)');

    await act(LUCIA, 'Quitar de la clase');
    await confirm('Quitar de la clase');

    expect(screen.getByText(`${LUCIA} ya no está en la clase`)).toBeTruthy();
    expect(screen.queryByText(LUCIA)).toBeNull();
    expect(text(heading())).toBe('Alumnado (23)');
    expect(document.activeElement?.contains(heading())).toBe(true);
  });

  it('says why a change failed, and reloads', async () => {
    await render();
    const listRoster = vi.spyOn(TestBed.inject(GroupService), 'listRoster');

    TestBed.inject(MockNetwork).failNextRequest('network');
    await act(LUCIA, `Matricular en ${WEB}`);
    await settle();

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(text(row(LUCIA))).toContain(`No cursa: ${WEB}`);
    expect(listRoster).toHaveBeenCalledWith(DAW_CLASS_ID);
    expect(changed).toHaveBeenCalled();
  });

  it('filters the students, and starts again without a filter in another class', async () => {
    await render();
    const filter = screen.getByRole('searchbox', { name: 'Filtrar alumnos' });

    await userEvent.type(filter, 'LUCIA');
    expect(rows().map((item) => text(item).split(' ')[0])).toEqual(['Lucía']);
    await userEvent.type(filter, 'zz');
    expect(screen.getByText('Nadie coincide')).toBeTruthy();

    fixture.componentRef.setInput('classId', EMPTY_CLASS_ID);
    fixture.componentRef.setInput('groups', []);
    await settle();
    expect(screen.queryByRole('searchbox', { name: 'Filtrar alumnos' })).toBeNull();
    expect(screen.getByText('Esta clase aún no tiene alumnos')).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (0)');
  });

  it('shows a skeleton while it loads', async () => {
    // Slow enough for the skeleton to show, after its wait
    await render({ latency: 600 });
    expect(await screen.findByText('Cargando el alumnado…')).toBeTruthy();
    await settle();
    expect(rows()).toHaveLength(26);
  });

  it('shows its error, with a retry', async () => {
    await render({ fail: true });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    expect(screen.getByRole('button', { name: /Matricular en la clase/ })).toHaveProperty(
      'disabled',
      true,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(rows()).toHaveLength(26));
  });

  it('enrolls students in the class, in every group of the whole class', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: /Matricular en la clase/ }));
    let dialog = await opened(`Matricular en ${CLASS_NAME}`);
    expect(within(dialog).getByText(/Entran en todas sus asignaturas/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed();
    expect(screen.queryByText('Matrícula guardada')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Matricular en la clase/ }));
    dialog = await opened(`Matricular en ${CLASS_NAME}`);
    await userEvent.type(within(dialog).getByRole('searchbox'), 'rubén');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Rubén Cabrera/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();

    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
    expect(text(heading())).toBe('Alumnado (25)');
    // In the groups of the whole class, not in the splits
    expect(within(row('Rubén Cabrera Méndez')).queryByText(NOTE)).toBeNull();
    expect(changed).toHaveBeenCalled();
  });

  it('enrolls in one group only, taking the active students of the class at once', async () => {
    await render();
    const afternoon = groups.find(({ group }) => group.id === AFTERNOON_GROUP_ID);
    if (!afternoon) throw new Error('No afternoon split');

    void fixture.componentInstance.enrollInGroup(afternoon, `${BASIC} · Desdoble tarde`);
    const dialog = await opened(`Matricular en ${CLASS_NAME} · ${BASIC} · Desdoble tarde`);
    expect(within(dialog).getByText(/Solo en esta asignatura/)).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'rubén');
    expect(await within(dialog).findByRole('checkbox', { name: /Rubén Cabrera/ })).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir los de otra clase' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: CLASS_NAME }));
    // The members of the class whose account is active: neither Aya, nor Elena nor Raúl
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Matricular (23)' }));
    await closed();

    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
    expect(text(row(LUCIA))).toContain(`${BASIC} · Desdoble tarde`);
    expect(text(row('Aya Benali Haddad'))).not.toContain('Desdoble tarde');

    // Who is in the split already is not taken again
    void fixture.componentInstance.enrollInGroup(afternoon, `${BASIC} · Desdoble tarde`);
    const again = await opened(`Matricular en ${CLASS_NAME} · ${BASIC} · Desdoble tarde`);
    await userEvent.click(within(again).getByRole('button', { name: 'Añadir los de otra clase' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: CLASS_NAME }));
    expect(await within(again).findByRole('button', { name: 'Matricular (0)' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
