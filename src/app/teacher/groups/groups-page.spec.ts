import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import {
  ADMIN_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockGroupService } from '../../data/mock/mock-group-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { SEARCH_DELAY_MS } from './enroll-dialog';
import { GroupsPage } from './groups-page';

const URL = '/docente/grupos';
const DAW_COUNT = `${DAW_STUDENT_IDS.length} alumnos`;

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

  /** The headers of the panels, which are their buttons. */
  function headers(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('mat-expansion-panel-header'));
  }

  function headerOf(subject: string): HTMLElement {
    const header = headers().find((candidate) => text(candidate).includes(subject));
    if (!header) throw new Error(`No panel for ${subject}`);
    return header;
  }

  async function openedDialog(): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return dialog;
  }

  async function closed(): Promise<void> {
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }

  async function confirm(button: string): Promise<void> {
    const dialog = await openedDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: button }));
    await closed();
    await settle();
  }

  afterEach(() => localStorage.clear());

  it('lists the groups of the teacher, without their teacher', async () => {
    await render();

    expect(screen.getByRole('heading', { level: 1, name: 'Grupos y matrícula' })).toBeTruthy();
    expect(headers()).toHaveLength(2);
    expect(text(headers()[1])).toContain('Programación básica');
    expect(text(headers()[1])).toContain('2026/27');
    expect(text(headers()[1])).toContain(DAW_COUNT);
    expect(screen.queryByText(/Docente:/)).toBeNull();
  });

  it('lists every group with its teacher for an administrator', async () => {
    await render(URL, { role: 'admin' });

    expect(headers()).toHaveLength(4);
    expect(screen.getAllByText(/Docente: Marta Ibáñez Soler/)).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    expect(text(within(dialog).getByRole('combobox', { name: 'Docente' }))).toBe('');
  });

  it('opens a panel, asking for its enrollment and writing the URL', async () => {
    await render();

    await userEvent.click(headerOf('Programación básica'));
    await settle();

    expect(TestBed.inject(Router).url).toBe(`${URL}?grupo=${DAW_GROUP_ID}`);
    const list = screen.getByRole('list', { name: 'Alumnado' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(DAW_STUDENT_IDS.length);
    expect(text(within(list).getAllByRole('listitem')[0])).toContain('@');

    await userEvent.click(headerOf('Programación básica'));
    await settle();
    expect(TestBed.inject(Router).url).toBe(URL);
  });

  it('opens the panel of the URL, and filters its students', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    expect(headerOf('Programación básica').getAttribute('aria-expanded')).toBe('true');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filtrar alumnos' }), 'LUCIA');
    const list = screen.getByRole('list', { name: 'Alumnado' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filtrar alumnos' }), 'zz');
    expect(within(list).getByText('Nadie coincide')).toBeTruthy();
  });

  it('creates a group, which opens with no students, and removes it', async () => {
    await render();

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), '2.º DAW B');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
    await settle();

    expect(headers()).toHaveLength(3);
    expect(text(headers()[2])).toContain('2.º DAW B');
    expect(text(headers()[2])).toContain('Sin alumnos');
    expect(screen.getByText('Este grupo aún no tiene alumnos')).toBeTruthy();
    expect(screen.getByText('Grupo creado')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de 2.º DAW B' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    await confirm('Eliminar');

    expect(headers()).toHaveLength(2);
    expect(TestBed.inject(Router).url).toBe(URL);
    expect(screen.getByText('Grupo 2.º DAW B eliminado')).toBeTruthy();
  });

  it('edits a group in place', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de 1.º DAW A' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const dialog = await openedDialog();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.type(name, '1.º DAW Z');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await closed();
    await settle();

    expect(text(headers()[1])).toContain('1.º DAW Z');
    expect(screen.getByText('Cambios guardados')).toBeTruthy();
  });

  it('does not remove a started group, saying why, and links to its blocks', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de 1.º DAW A' }));
    const remove = await screen.findByRole('menuitem', { name: /Eliminar/ });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(text(remove)).toContain('ya hay alumnos con trabajo');
    const blocks = screen.getByRole('menuitem', { name: 'Ver sus bloques' });
    expect(blocks.getAttribute('href')).toBe(`/docente/bloques?grupo=${DAW_GROUP_ID}`);
  });

  it('unenrolls a student, lowering the count', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    await confirm('Dar de baja del grupo');

    expect(screen.queryByText('Lucía Martín Gómez')).toBeNull();
    expect(text(headerOf('Programación básica'))).toContain(
      `${DAW_STUDENT_IDS.length - 1} alumnos`,
    );
    expect(screen.getByText('Lucía Martín Gómez ya no está en el grupo')).toBeTruthy();
  });

  it('enrolls students in order, raising the count', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'elena');
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS));
    await userEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));
    await closed();
    await settle();

    const names = within(screen.getByRole('list', { name: 'Alumnado' }))
      .getAllByRole('listitem')
      .map((item) => text(item));
    expect(names.findIndex((name) => name.includes('Elena'))).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    expect(text(headerOf('Programación básica'))).toContain(
      `${DAW_STUDENT_IDS.length + 1} alumnos`,
    );
    expect(screen.getByText('Matrícula guardada')).toBeTruthy();
  });

  it('warns of a failed unenrollment and reloads', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    TestBed.inject(MockNetwork).failNextRequest('network');
    await confirm('Dar de baja del grupo');

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByText('Lucía Martín Gómez')).toBeTruthy();
  });

  it('warns of a failed removal and reloads', async () => {
    await render();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    let dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Prueba' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    dialog = await openedDialog();
    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await closed();
    await settle();

    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(headers()).toHaveLength(3);
  });

  it('closes the open panel when another opens, keeping the URL of the new one', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(headerOf('Desarrollo web'));
    await settle();

    expect(TestBed.inject(Router).url).toBe(`${URL}?grupo=${DAW_WEB_GROUP_ID}`);
    expect(headerOf('Programación básica').getAttribute('aria-expanded')).toBe('false');
  });

  it('does nothing when the removal or the unenrollment is cancelled', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

    await userEvent.click(
      screen.getByRole('button', { name: 'Dar de baja a Lucía Martín Gómez del grupo' }),
    );
    await confirm('Cancelar');
    expect(screen.getByText('Lucía Martín Gómez')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de 1.º DAW A' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    await confirm('Cancelar');
    expect(screen.queryByText('Cambios guardados')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Programación avanzada' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
    await settle();
    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Prueba' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    await confirm('Cancelar');
    expect(headers()).toHaveLength(3);
  });

  it('keeps the enroll dialog open when enrolling fails, and reloads', async () => {
    await render(`${URL}?grupo=${DAW_GROUP_ID}`);

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

  it('chooses the only subject there is, and has no filter for a short list', async () => {
    await render(URL, {
      prepare: () => {
        const db = TestBed.inject(MockDb);
        db.update('subjects', (subjects) => subjects.slice(0, 1));
        db.update('groups', (groups) =>
          groups.filter((group) => group.subjectId === SUBJECTS[0].id),
        );
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    const dialog = await openedDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Prueba');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el grupo' }));
    await closed();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Matricular alumnos' }));
    const enroll = await openedDialog();
    await userEvent.type(within(enroll).getByRole('searchbox'), 'elena');
    await userEvent.click(
      await within(enroll).findByRole('checkbox', { name: /Elena Vázquez Lorenzo/ }),
    );
    await userEvent.click(within(enroll).getByRole('button', { name: 'Matricular (1)' }));
    await closed();
    await settle();

    expect(text(headers().find((header) => text(header).includes('Prueba')) ?? null)).toContain(
      '1 alumno',
    );
    expect(screen.queryByRole('searchbox', { name: 'Filtrar alumnos' })).toBeNull();
  });

  it('shows the empty state without groups', async () => {
    await render(URL, {
      prepare: () =>
        TestBed.inject(MockDb).update('groups', (groups) =>
          groups.filter((group) => group.teacherId !== TEACHER_ID),
        ),
    });
    expect(screen.getByText('Aún no tienes grupos')).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo grupo' })[1]);
    expect(await screen.findByRole('dialog', { name: 'Nuevo grupo' })).toBeTruthy();
  });

  it('shows the error of the list, and that of a panel apart, with their retries', async () => {
    await render(URL, { prepare: () => TestBed.inject(MockNetwork).failNextRequest('network') });
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(headers()).toHaveLength(2);

    TestBed.inject(MockNetwork).failNextRequest('network');
    await userEvent.click(headerOf('Programación básica'));
    await settle();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(screen.getByRole('list', { name: 'Alumnado' })).toBeTruthy();
  });
});
