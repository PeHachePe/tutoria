import { LiveAnnouncer } from '@angular/cdk/a11y';
import { withoutHistory } from '../../data/mock/fixtures/history';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { BlockService } from '../../data/block-service';
import { ExerciseService } from '../../data/exercise-service';
import {
  blockAssignmentId,
  DAW_HIDDEN_BLOCK,
  exerciseId,
} from '../../data/mock/fixtures/exercises';
import { fixtureId } from '../../data/mock/fixtures/fixture-id';
import { SEED } from '../../data/mock/fixtures/seed';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import {
  ADMIN_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { MockBlockService } from '../../data/mock/mock-block-service';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { BlocksPage } from './blocks-page';
import { DataError } from '../../data/data-error';

const NOW = '2026-11-15T09:00:00.000Z';
const DAW = `/docente/bloques?grupo=${DAW_GROUP_ID}`;

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('BlocksPage', () => {
  let db: MockDb;
  let snack: ReturnType<typeof vi.spyOn>;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  async function renderBlocks(
    url = '/docente/bloques',
    prepare: (db: MockDb) => void = () => undefined,
    role: 'teacher' | 'admin' = 'teacher',
  ) {
    const userId = role === 'admin' ? ADMIN_ID : TEACHER_ID;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'docente/bloques', component: BlocksPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideSessionOf(role, { id: userId }),
        { provide: BlockService, useClass: MockBlockService },
        { provide: ExerciseService, useClass: MockExerciseService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.setSession(userId);
    // This year alone: the classes and students of the years before are not what these test
    withoutHistory(db);
    prepare(db);
    await restoreSession();
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);
    return harness;
  }

  async function settle(harness: RouterTestingHarness): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  /**
   * The dialog, once it has the focus: the menu that opened it gives the focus back to its button
   * on closing, which under load can come after the dialog opens and take the keys typed in it.
   */
  async function openDialog(): Promise<HTMLElement> {
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    return dialog;
  }

  /** Waits for the dialog to close, which Material does after its animation, and for the page. */
  async function closed(harness: RouterTestingHarness): Promise<void> {
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settle(harness);
  }

  /** The titles of the blocks, without those of the dialogs. */
  function blockHeadings(): HTMLElement[] {
    return within(screen.getByRole('list', { name: 'Bloques del grupo' })).getAllByRole('heading', {
      level: 2,
    });
  }

  function block(title: string): HTMLElement {
    return screen.getByRole('heading', { level: 2, name: title }).closest('li') as HTMLElement;
  }

  function exercisesOf(title: string): string[] {
    return within(block(title))
      .queryAllByRole('link')
      .map((link) => text(link));
  }

  /** Opens a menu of the page, or of one block, and chooses an item. */
  async function menu(button: string, item: RegExp | string, inBlock?: string): Promise<void> {
    const scope = inBlock ? within(block(inBlock)) : screen;
    await userEvent.click(scope.getByRole('button', { name: button }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
  }

  interface PlannedEntry {
    readonly exercise: { readonly id: string; readonly title: string };
    readonly assignment: { readonly blockId: string };
  }
  interface Planned {
    readonly block: { readonly id: string; readonly title: string };
    readonly assignments: readonly PlannedEntry[];
  }
  /** What the page reads of a drop of the CDK. */
  interface Drop {
    readonly previousContainer: { readonly data: Planned };
    readonly container: { readonly data: Planned };
    readonly item?: { readonly data: PlannedEntry };
    readonly previousIndex: number;
    readonly currentIndex: number;
  }
  interface Page {
    dropAssignment: (event: Drop) => void;
    canEnter: (drag: { data: PlannedEntry }, drop: { data: Planned }) => boolean;
    blocks: { value: () => readonly Planned[] };
  }

  function pageOf(harness: RouterTestingHarness): Page {
    return harness.routeDebugElement?.componentInstance as Page;
  }

  function plannedBlock(page: Page, title: string): Planned {
    return page.blocks.value().find((entry) => entry.block.title === title) as Planned;
  }

  function entryOf(planned: Planned, title: string): PlannedEntry {
    return planned.assignments.find((entry) => entry.exercise.title === title) as PlannedEntry;
  }

  /** Replaces the snackbar with one whose «Deshacer» the test presses. */
  function undoable(): () => void {
    let undo: () => void = () => undefined;
    snack.mockImplementation(
      () =>
        ({
          onAction: () => ({ subscribe: (next: () => void) => (undo = next) }),
        }) as never,
    );
    return () => undo();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    snack = vi.spyOn(MatSnackBar.prototype, 'open');
    // jsdom does not scroll
    scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  describe('reading', () => {
    it('shows the blocks of the first group in order, with their exercises and due dates', async () => {
      await renderBlocks();

      expect(screen.getByRole('heading', { level: 1, name: 'Bloques' })).toBeTruthy();
      expect(text(screen.getByRole('combobox', { name: 'Grupo' }))).toContain(
        '1.º DAW A · Desarrollo web en entorno cliente',
      );
      expect(blockHeadings().map((heading) => text(heading))).toEqual([
        'Tema 1: Validación de formularios',
        'Tema 2: URL y peticiones',
        'Tema 3: Textos de la interfaz',
        'Tema 4: Datos de la tienda',
      ]);
      const first = block('Tema 1: Validación de formularios');
      expect(text(first)).toContain('3 ejercicios');
      expect(text(first)).toContain('2 alumnos lo han empezado');
      expect(text(first)).toContain('Sin fecha de entrega');
      const due = within(block('Tema 2: URL y peticiones')).getAllByRole('button', {
        name: /^Fecha de entrega de/,
      })[0];
      expect(text(due)).toMatch(/18 nov.*en 3 días/);
    });

    it('changes of group through the URL', async () => {
      const harness = await renderBlocks();

      await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
      await userEvent.click(
        screen.getByRole('option', { name: '1.º DAW A · Programación básica' }),
      );
      await settle(harness);

      expect(TestBed.inject(Router).url).toBe(DAW);
      expect(
        screen.getByRole('heading', { level: 2, name: 'Tema 1: Bucles y condicionales' }),
      ).toBeTruthy();
      const review = block('Repaso final');
      expect(text(review)).toContain('Oculto para los alumnos');
      expect(
        within(review).getByRole('switch', { name: 'Visible' }).getAttribute('aria-checked'),
      ).toBe('false');
      expect(text(block('Recuperación del tema 2'))).toContain('Oculto');
    });

    it('names the only group without a select', async () => {
      await renderBlocks('/docente/bloques', (mock) =>
        mock.update('groups', (rows) => rows.filter((row) => row.id !== DAW_WEB_GROUP_ID)),
      );

      expect(screen.queryByRole('combobox', { name: 'Grupo' })).toBeNull();
      expect(screen.getByText('1.º DAW A · Programación básica')).toBeTruthy();
    });

    it('says when the teacher has no groups', async () => {
      await renderBlocks('/docente/bloques', (mock) => mock.update('groups', () => []));

      expect(screen.getByText('Todavía no tienes grupos')).toBeTruthy();
    });

    it('offers to create the first block of an empty group', async () => {
      await renderBlocks(DAW, (mock) => {
        mock.update('classBlocks', (rows) => rows.filter((row) => row.groupId !== DAW_GROUP_ID));
        mock.update('assignments', (rows) => rows.filter((row) => row.groupId !== DAW_GROUP_ID));
      });

      expect(screen.getByText('Este grupo todavía no tiene bloques')).toBeTruthy();
      // The one of the empty state and the floating one
      expect(screen.getAllByRole('button', { name: 'Nuevo bloque' })).toHaveLength(2);
    });

    it('shows the errors of the groups and of the blocks, with «Reintentar»', async () => {
      TestBed.resetTestingModule();
      const harness = await renderBlocks('/docente/bloques', () =>
        TestBed.inject(MockNetwork).failNextRequest('unknown'),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await settle(harness);
      expect(blockHeadings().length).toBeGreaterThan(0);

      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
      await userEvent.click(
        screen.getByRole('option', { name: '1.º DAW A · Programación básica' }),
      );
      await settle(harness);
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await settle(harness);
      expect(
        screen.getByRole('heading', { level: 2, name: 'Tema 1: Bucles y condicionales' }),
      ).toBeTruthy();
    });
  });

  it('marks the language of a title without translation, and cancels an edit', async () => {
    const harness = await renderBlocks(DAW, (mock) => {
      mock.update('classBlocks', (rows) =>
        rows.map((row) =>
          row.title === 'Repaso final'
            ? { ...row, title: 'Final review', sourceLocale: 'en', translations: {} }
            : row,
        ),
      );
      mock.update('exercises', (rows) =>
        rows.map((row) =>
          row.id === exerciseId(5)
            ? { ...row, title: 'Reverse an array', sourceLocale: 'en', translations: {} }
            : row,
        ),
      );
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Final review' }).getAttribute('lang'),
    ).toBe('en');
    await userEvent.click(
      within(block('Final review')).getByRole('button', {
        name: /^Fecha de entrega de «Reverse an array»/,
      }),
    );
    let dialog = await openDialog();
    expect(within(dialog).getByText('Reverse an array').getAttribute('lang')).toBe('en');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed(harness);

    await menu('Acciones del bloque «Tema 1: Bucles y condicionales»', 'Añadir ejercicios');
    dialog = await openDialog();
    await settle(harness);
    expect(
      within(dialog).getByText('Reverse an array', { selector: '[lang]' }).getAttribute('lang'),
    ).toBe('en');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed(harness);

    await menu('Acciones del bloque «Final review»', 'Editar el bloque');
    dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await closed(harness);
    expect(snack).not.toHaveBeenCalled();
  });

  describe('blocks', () => {
    it('creates a block at the end and takes the focus to it', async () => {
      const harness = await renderBlocks(DAW);

      await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo bloque' })[0]);
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Examen');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el bloque' }));
      await closed(harness);

      const headings = blockHeadings();
      expect(text(headings.at(-1) ?? null)).toBe('Examen');
      await vi.waitFor(() => expect(document.activeElement).toBe(headings.at(-1)));
      expect(snack).toHaveBeenCalledWith('Bloque creado');
      // At the top of the page, with a smooth scroll (5.2f)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('keeps the page as it was when the new block is cancelled', async () => {
      const harness = await renderBlocks(DAW);
      const before = blockHeadings().length;

      await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo bloque' })[0]);
      await userEvent.click(within(await openDialog()).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);

      expect(blockHeadings()).toHaveLength(before);
      expect(snack).not.toHaveBeenCalled();
    });

    it('changes the title of a block', async () => {
      const harness = await renderBlocks(DAW);

      await menu('Acciones del bloque «Repaso final»', 'Editar el bloque');
      const dialog = await openDialog();
      const title = within(dialog).getByRole('textbox', { name: 'Título' });
      await userEvent.clear(title);
      await userEvent.type(title, 'Repaso de la evaluación');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);

      await vi.waitFor(
        () => expect(text(blockHeadings().at(-2) ?? null)).toBe('Repaso de la evaluación'),
        // The whole suite runs at once: give the save and the dialog time
        { timeout: 3000 },
      );
      expect(snack).toHaveBeenCalledWith('Bloque guardado');
    });

    it('says when a block opens to the students, until it does', async () => {
      await renderBlocks(DAW, (mock) =>
        mock.update('classBlocks', (rows) =>
          rows.map((row) =>
            row.title === 'Tema 1: Bucles y condicionales'
              ? { ...row, opensAt: '2026-11-01T08:00:00.000Z' }
              : row,
          ),
        ),
      );

      expect(text(block('Examen de los temas 5 y 6'))).toMatch(
        /Se abre el\s*lun 23 nov, 09:00.*en 8 días/,
      );
      // Open already: as any other
      expect(text(block('Tema 1: Bucles y condicionales'))).not.toContain('Se abre');
    });

    it('schedules the opening of a block, at 0:00 without a time', async () => {
      const harness = await renderBlocks(DAW);

      await menu('Acciones del bloque «Repaso final»', 'Editar el bloque');
      const dialog = await openDialog();
      expect(text(dialog)).toContain('Sin hora, a las 0:00');
      await userEvent.type(
        within(dialog).getByRole('textbox', { name: 'Se abre a los alumnos el día' }),
        '1/12/2026',
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);

      expect(text(block('Repaso final'))).toMatch(/Se abre el\s*mar 1 dic, 00:00/);
      const saved = db.tables().classBlocks.find((row) => row.title === 'Repaso final');
      expect(new Date(saved?.opensAt ?? '').getHours()).toBe(0);
    });

    it('shows and hides a block at once, and goes back if the server says no', async () => {
      const harness = await renderBlocks(DAW);
      const toggle = () => within(block('Repaso final')).getByRole('switch', { name: 'Visible' });

      await userEvent.click(toggle());
      await settle(harness);
      expect(toggle().getAttribute('aria-checked')).toBe('true');
      expect(db.tables().classBlocks.find((row) => row.title === 'Repaso final')?.isHidden).toBe(
        false,
      );

      // With a real wait, as on the network, the page draws the change before going back
      TestBed.inject(MockNetwork).setLatency({ min: 5, max: 5 });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(toggle());
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle(harness);
      expect(toggle().getAttribute('aria-checked')).toBe('true');
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
    });

    it('moves a block with the menu, says where and saves the order', async () => {
      const harness = await renderBlocks(DAW);
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

      await menu('Acciones del bloque «Tema 2: Vectores»', 'Subir');
      await settle(harness);

      const titles = blockHeadings().map((heading) => text(heading));
      expect(titles.slice(0, 2)).toEqual(['Tema 2: Vectores', 'Tema 1: Bucles y condicionales']);
      expect(announce).toHaveBeenCalledWith('Bloque «Tema 2: Vectores» en el lugar 1 de 9');
      const saved = db
        .tables()
        .classBlocks.filter((row) => row.groupId === DAW_GROUP_ID)
        .sort((a, b) => a.position - b.position);
      expect(saved[0].title).toBe('Tema 2: Vectores');

      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones del bloque «Tema 2: Vectores»' }),
      );
      const up = await screen.findByRole('menuitem', { name: 'Subir' });
      expect((up as HTMLButtonElement).disabled).toBe(true);
    });

    it('moves a block by dragging it, and puts it back if saving fails', async () => {
      const harness = await renderBlocks(DAW);
      const page = harness.routeDebugElement?.componentInstance as {
        dropBlock: (group: unknown, event: Partial<CdkDragDrop<unknown>>) => void;
        group: () => unknown;
      };

      // Dropped where it was: nothing to save
      page.dropBlock(page.group(), { previousIndex: 0, currentIndex: 0 });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      page.dropBlock(page.group(), { previousIndex: 0, currentIndex: 7 });
      await settle(harness);

      expect(text(blockHeadings()[0])).toBe('Tema 1: Bucles y condicionales');
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
    });

    it('deletes a block nobody started after asking, with its exercises', async () => {
      const harness = await renderBlocks(DAW);

      await menu('Acciones del bloque «Repaso final»', 'Borrar');
      const dialog = await openDialog();
      expect(text(dialog)).toContain('Se quitan también sus 2 ejercicios');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));
      await closed(harness);

      expect(screen.queryByRole('heading', { level: 2, name: 'Repaso final' })).toBeNull();
      expect(snack).toHaveBeenCalledWith('Bloque borrado');
    });

    it('says that the only exercise of a block goes with it', async () => {
      const harness = await renderBlocks(DAW, (mock) =>
        mock.update('assignments', (rows) =>
          rows.filter((row) => row.id !== blockAssignmentId(DAW_HIDDEN_BLOCK, 8)),
        ),
      );

      await menu('Acciones del bloque «Repaso final»', 'Borrar');
      const dialog = await openDialog();
      expect(text(dialog)).toContain('Se quita también su ejercicio, que sigue en el banco.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
    });

    it('asks about an empty block, and does nothing if cancelled', async () => {
      const harness = await renderBlocks(DAW, (mock) =>
        mock.update('assignments', (rows) =>
          rows.filter((row) => row.blockId !== fixtureId('block', DAW_HIDDEN_BLOCK)),
        ),
      );

      await menu('Acciones del bloque «Repaso final»', 'Borrar');
      const dialog = await openDialog();
      expect(text(dialog)).toContain('Está vacío');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);

      expect(screen.getByRole('heading', { level: 2, name: 'Repaso final' })).toBeTruthy();
    });

    it('says why a block cannot be deleted', async () => {
      const harness = await renderBlocks(DAW);

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Acciones del bloque «Tema 1: Bucles y condicionales»',
        }),
      );
      const blocked = await screen.findByRole('menuitem', { name: 'Borrar (ya tiene intentos)' });
      expect((blocked as HTMLButtonElement).disabled).toBe(true);
      await userEvent.keyboard('{Escape}');

      // Somebody started it while the page was open
      TestBed.inject(MockNetwork).failNextRequest('invalid');
      await menu('Acciones del bloque «Repaso final»', 'Borrar');
      await userEvent.click(within(await openDialog()).getByRole('button', { name: 'Borrar' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith(
        'No se ha podido borrar: puede que alguien acabe de empezar uno de sus ejercicios.',
      );
    });
  });

  describe('exercises', () => {
    it('adds exercises of the bank at the end of a block', async () => {
      const harness = await renderBlocks(DAW);

      await userEvent.click(
        within(block('Repaso final')).getByRole('button', { name: 'Añadir ejercicios' }),
      );
      const dialog = await openDialog();
      await settle(harness);
      await userEvent.click(within(dialog).getByRole('option', { name: /Año bisiesto/ }));
      await userEvent.click(within(dialog).getByRole('option', { name: /Factorial de un número/ }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir 2 ejercicios' }));
      await closed(harness);

      expect(exercisesOf('Repaso final').slice(-2)).toEqual([
        'Año bisiesto',
        'Factorial de un número',
      ]);
      expect(snack).toHaveBeenCalledWith('2 ejercicios añadidos');
    });

    it('says when one exercise is added, and when adding fails', async () => {
      const harness = await renderBlocks(DAW);

      await menu('Acciones del bloque «Repaso final»', 'Añadir ejercicios');
      let dialog = await openDialog();
      await settle(harness);
      await userEvent.click(within(dialog).getByRole('option', { name: /Año bisiesto/ }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir 1 ejercicio' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith('1 ejercicio añadido');

      await menu('Acciones del bloque «Repaso final»', 'Añadir ejercicios');
      dialog = await openDialog();
      await settle(harness);
      await userEvent.click(within(dialog).getByRole('option', { name: /Factorial de un número/ }));
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Añadir 1 ejercicio' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');

      await menu('Acciones del bloque «Repaso final»', 'Añadir ejercicios');
      await userEvent.click(within(await openDialog()).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
      expect(exercisesOf('Repaso final')).toHaveLength(3);
    });

    it('moves an exercise inside its block, with the menu or by dragging it', async () => {
      const harness = await renderBlocks(DAW);
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

      await menu('Acciones de «Media de un vector con dos decimales»', 'Bajar');
      await settle(harness);
      expect(exercisesOf('Tema 4: Cadenas y formato')).toEqual([
        'Contar vocales en una cadena',
        'Buscar la primera aparición de un valor',
        'Media de un vector con dos decimales',
      ]);
      expect(announce).toHaveBeenCalledWith(
        '«Media de un vector con dos decimales» en el lugar 3 de 3',
      );

      await menu('Acciones de «Media de un vector con dos decimales»', 'Subir');
      await settle(harness);
      expect(exercisesOf('Tema 4: Cadenas y formato')[1]).toBe(
        'Media de un vector con dos decimales',
      );
    });

    it('marks the archived exercises, out of the bank but still in their blocks', async () => {
      await renderBlocks(DAW);

      const archived = within(block('Tema 1: Bucles y condicionales'))
        .getByRole('link', { name: 'Tabla de multiplicar' })
        .closest('li');
      expect(text(archived)).toContain('Archivado');
      const other = screen
        .getByRole('link', { name: 'Contar vocales en una cadena' })
        .closest('li');
      expect(text(other)).not.toContain('Archivado');
    });

    it('moves an exercise to another block with the menu, and back with «Deshacer»', async () => {
      const harness = await renderBlocks(DAW);
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
      const undo = undoable();

      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones de «Contar vocales en una cadena»' }),
      );
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Mover a otro bloque' }));
      const targets = await screen.findByRole('menu', {
        name: 'Mover «Contar vocales en una cadena» a otro bloque',
      });
      // Every other block of the group
      expect(within(targets).getAllByRole('menuitem')).toHaveLength(8);
      await userEvent.click(within(targets).getByRole('menuitem', { name: 'Repaso final' }));
      await settle(harness);

      expect(exercisesOf('Tema 4: Cadenas y formato')).toEqual([
        'Media de un vector con dos decimales',
        'Buscar la primera aparición de un valor',
      ]);
      expect(exercisesOf('Repaso final')).toEqual([
        'Invertir un vector',
        'Buscar la primera aparición de un valor',
        'Contar vocales en una cadena',
      ]);
      expect(announce).toHaveBeenCalledWith(
        '«Contar vocales en una cadena» en «Repaso final», en el lugar 3 de 3',
      );
      expect(snack).toHaveBeenCalledWith(
        '«Contar vocales en una cadena» movido a «Repaso final»',
        'Deshacer',
      );

      undo();
      await settle(harness);
      expect(exercisesOf('Tema 4: Cadenas y formato')[0]).toBe('Contar vocales en una cadena');
      expect(exercisesOf('Repaso final')).toHaveLength(2);
      const saved = db
        .tables()
        .assignments.filter(
          (row) => row.groupId === DAW_GROUP_ID && row.exerciseId === exerciseId(6),
        );
      expect(saved.map((row) => row.position)).toEqual([1]);
    });

    it('does not offer a block that has the exercise already', async () => {
      await renderBlocks(DAW);

      await menu(
        'Acciones de «Buscar la primera aparición de un valor»',
        'Mover a otro bloque',
        'Tema 4: Cadenas y formato',
      );
      const targets = await screen.findByRole('menu', {
        name: 'Mover «Buscar la primera aparición de un valor» a otro bloque',
      });
      const repaso = within(targets).getByRole('menuitem', { name: 'Repaso final' });
      expect((repaso as HTMLButtonElement).disabled).toBe(true);
    });

    it('moves an exercise somebody started by dragging it to another block', async () => {
      const harness = await renderBlocks(DAW);
      const page = pageOf(harness);
      const source = plannedBlock(page, 'Tema 1: Bucles y condicionales');
      const target = plannedBlock(page, 'Tema 3: Recorridos de vectores');
      const entry = source.assignments[0];

      // Only where it is not yet
      expect(page.canEnter({ data: entry }, { data: target })).toBe(true);
      expect(page.canEnter({ data: entry }, { data: source })).toBe(true);
      expect(
        page.canEnter(
          { data: source.assignments[1] },
          { data: plannedBlock(page, 'Recuperación del tema 2') },
        ),
      ).toBe(false);

      page.dropAssignment({
        previousContainer: { data: source },
        container: { data: target },
        item: { data: entry },
        previousIndex: 0,
        currentIndex: 0,
      });
      await settle(harness);

      expect(exercisesOf('Tema 3: Recorridos de vectores')[0]).toBe(entry.exercise.title);
      expect(
        db.tables().assignments.find((row) => row.exerciseId === entry.exercise.id),
      ).toMatchObject({ blockId: target.block.id, position: 1 });
    });

    it('puts an exercise back in its block if moving it fails, also on «Deshacer»', async () => {
      const harness = await renderBlocks(DAW);
      const page = pageOf(harness);
      const undo = undoable();
      const move = (from: string, to: string) =>
        page.dropAssignment({
          previousContainer: { data: plannedBlock(page, from) },
          container: { data: plannedBlock(page, to) },
          item: { data: entryOf(plannedBlock(page, from), 'Invertir un vector') },
          previousIndex: 0,
          currentIndex: 0,
        });

      TestBed.inject(MockNetwork).failNextRequest('unknown');
      move('Repaso final', 'Tema 2: Vectores');
      await settle(harness);
      expect(exercisesOf('Repaso final')[0]).toBe('Invertir un vector');
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');

      move('Repaso final', 'Tema 2: Vectores');
      await settle(harness);
      expect(exercisesOf('Tema 2: Vectores')[0]).toBe('Invertir un vector');
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      undo();
      await settle(harness);
      expect(exercisesOf('Tema 2: Vectores')[0]).toBe('Invertir un vector');
      expect(snack).toHaveBeenCalledTimes(3);
    });

    it('puts an exercise back where it was if the new order cannot be saved', async () => {
      const harness = await renderBlocks(DAW);
      const page = pageOf(harness);
      const container = { data: plannedBlock(page, 'Tema 4: Cadenas y formato') };

      page.dropAssignment({
        previousContainer: container,
        container,
        previousIndex: 1,
        currentIndex: 1,
      });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      page.dropAssignment({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 2,
      });
      await settle(harness);

      expect(exercisesOf('Tema 4: Cadenas y formato')[0]).toBe('Contar vocales en una cadena');
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
    });

    it('hides an exercise from the students, and goes back if the server says no', async () => {
      const harness = await renderBlocks(DAW);
      const hide = 'Ocultar «Contar vocales en una cadena» a los alumnos';

      await userEvent.click(screen.getByRole('button', { name: hide }));
      await settle(harness);
      const show = screen.getByRole('button', {
        name: 'Mostrar «Contar vocales en una cadena» a los alumnos',
      });
      expect(show.getAttribute('aria-pressed')).toBe('true');

      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(show);
      await settle(harness);
      expect(screen.getByRole('button', { name: /Mostrar «Contar vocales/ })).toBeTruthy();
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
    });

    it('chooses, keeps and removes the due date of an exercise', async () => {
      const harness = await renderBlocks(DAW);
      const button = () =>
        screen.getByRole('button', { name: /^Fecha de entrega de «Contar vocales en una cadena»/ });

      await userEvent.click(button());
      let dialog = await openDialog();
      const day = within(dialog).getByRole('textbox', { name: 'Día' });
      await userEvent.clear(day);
      await userEvent.type(day, '20/11/2026');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);
      expect(text(button())).toMatch(/20 nov.*en 5 días/);
      expect(snack).toHaveBeenCalledWith('Fecha de entrega guardada');

      // Saving the same date changes nothing
      await userEvent.click(button());
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledTimes(1);

      await userEvent.click(button());
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);

      await userEvent.click(button());
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar la fecha' }));
      await closed(harness);
      expect(text(button())).toContain('Sin fecha de entrega');
      expect(snack).toHaveBeenCalledWith('Fecha de entrega quitada');
    });

    it('gives every exercise of a block the same due date, or removes them all', async () => {
      const harness = await renderBlocks(DAW);

      await menu(
        'Acciones del bloque «Tema 4: Cadenas y formato»',
        'Fecha de entrega para todo el bloque',
      );
      let dialog = await openDialog();
      expect(text(dialog)).toContain('Todos los ejercicios de «Tema 4: Cadenas y formato»');
      const day = within(dialog).getByRole('textbox', { name: 'Día' });
      await userEvent.clear(day);
      await userEvent.type(day, '1/12/2026');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);
      const dates = within(block('Tema 4: Cadenas y formato'))
        .getAllByRole('button', { name: /^Fecha de entrega de/ })
        .map((button) => text(button));
      expect(dates.every((date) => /1 dic/.test(date))).toBe(true);
      expect(snack).toHaveBeenCalledWith('Fecha de entrega guardada en todo el bloque');

      await menu(
        'Acciones del bloque «Tema 4: Cadenas y formato»',
        'Fecha de entrega para todo el bloque',
      );
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar la fecha' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith('Fechas de entrega quitadas');

      // Mixed dates start the dialog empty, and cancelling changes nothing
      await userEvent.click(
        screen.getByRole('button', { name: /^Fecha de entrega de «Contar vocales en una cadena»/ }),
      );
      dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Día' }), '2/12/2026');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);
      await menu(
        'Acciones del bloque «Tema 4: Cadenas y formato»',
        'Fecha de entrega para todo el bloque',
      );
      dialog = await openDialog();
      expect((within(dialog).getByRole('textbox', { name: 'Día' }) as HTMLInputElement).value).toBe(
        '',
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
    });

    it('removes an exercise nobody started, and puts it back in its place with «Deshacer»', async () => {
      const harness = await renderBlocks(DAW, (mock) =>
        mock.update('assignments', (rows) =>
          rows.map((row) =>
            row.id === blockAssignmentId(DAW_HIDDEN_BLOCK, 5)
              ? { ...row, isHidden: true, dueAt: '2026-12-01T22:59:00.000Z' }
              : row,
          ),
        ),
      );
      let undo: () => void = () => undefined;
      snack.mockImplementation(
        () =>
          ({
            onAction: () => ({ subscribe: (next: () => void) => (undo = next) }),
          }) as never,
      );

      await menu('Acciones de «Invertir un vector»', 'Quitar del bloque', 'Repaso final');
      await settle(harness);
      expect(exercisesOf('Repaso final')).toEqual(['Buscar la primera aparición de un valor']);
      expect(snack).toHaveBeenCalledWith('«Invertir un vector» quitado del bloque', 'Deshacer');

      undo();
      await settle(harness);
      expect(exercisesOf('Repaso final')).toEqual([
        'Invertir un vector',
        'Buscar la primera aparición de un valor',
      ]);
      const restored = db
        .tables()
        .assignments.find(
          (row) =>
            row.blockId === fixtureId('block', DAW_HIDDEN_BLOCK) &&
            row.exerciseId === exerciseId(5),
        );
      expect(restored).toMatchObject({
        position: 1,
        isHidden: true,
        dueAt: '2026-12-01T22:59:00.000Z',
      });
    });

    it('puts back an exercise that had nothing special, and reloads if that fails', async () => {
      const harness = await renderBlocks(DAW);
      let undo: () => void = () => undefined;
      snack.mockImplementation(
        () =>
          ({
            onAction: () => ({ subscribe: (next: () => void) => (undo = next) }),
          }) as never,
      );

      await menu(
        'Acciones de «Buscar la primera aparición de un valor»',
        'Quitar del bloque',
        'Repaso final',
      );
      await settle(harness);
      undo();
      await settle(harness);
      expect(exercisesOf('Repaso final')[1]).toBe('Buscar la primera aparición de un valor');

      await menu(
        'Acciones de «Buscar la primera aparición de un valor»',
        'Quitar del bloque',
        'Repaso final',
      );
      await settle(harness);
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      undo();
      await settle(harness);
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
    });

    it('does not remove an exercise somebody started', async () => {
      const harness = await renderBlocks(DAW);

      await userEvent.click(
        screen.getAllByRole('button', { name: 'Acciones de «Contar números pares»' })[0],
      );
      const blocked = await screen.findByRole('menuitem', {
        name: 'Quitar (ya tiene intentos: ocúltalo)',
      });
      expect((blocked as HTMLButtonElement).disabled).toBe(true);
      await userEvent.keyboard('{Escape}');

      TestBed.inject(MockNetwork).failNextRequest('invalid');
      await menu('Acciones de «Invertir un vector»', 'Quitar del bloque', 'Repaso final');
      await settle(harness);
      expect(snack).toHaveBeenCalledWith(
        'No se ha podido quitar: puede que alguien acabe de empezarlo.',
      );
      expect(exercisesOf('Repaso final')).toHaveLength(2);
    });
  });

  describe('dialogs', () => {
    it('searches the bank, shows every subject and says where else an exercise is', async () => {
      const harness = await renderBlocks(DAW, (mock) =>
        // More exercises than the dialog shows at once
        mock.update('exercises', (rows) => [
          ...rows,
          ...Array.from({ length: 20 }, (_, index) => ({
            ...rows[0],
            id: `extra-${index}`,
            title: `Ejercicio extra ${index}`,
          })),
        ]),
      );

      await menu('Acciones del bloque «Repaso final»', 'Añadir ejercicios');
      const dialog = await openDialog();
      await settle(harness);
      expect(text(dialog)).toContain('Ya está en el bloque');
      expect(text(dialog)).toContain('También en Tema 2: Vectores');

      await userEvent.click(within(dialog).getByRole('option', { name: /Año bisiesto/ }));
      await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Buscar' }), 'factorial');
      await settle(harness);
      expect(within(dialog).getAllByRole('option')).toHaveLength(1);
      await userEvent.click(within(dialog).getByRole('option', { name: /Factorial/ }));
      // What was chosen before the search stays chosen
      expect(within(dialog).getByRole('button', { name: 'Añadir 2 ejercicios' })).toBeTruthy();
      await userEvent.clear(within(dialog).getByRole('searchbox', { name: 'Buscar' }));

      await userEvent.click(within(dialog).getByRole('switch', { name: /Todas las asignaturas/ }));
      await settle(harness);
      expect(text(dialog)).toContain('se ven 50: busca para encontrar el resto');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
    });

    it('lets the bank be loaded again when it fails', async () => {
      const harness = await renderBlocks(DAW);

      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await menu('Acciones del bloque «Repaso final»', 'Añadir ejercicios');
      const dialog = await openDialog();
      await settle(harness);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reintentar' }));
      await settle(harness);
      expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(0);
    });

    it('keeps the block dialog open with the error when saving fails, and follows the language', async () => {
      const harness = await renderBlocks(DAW);

      await userEvent.click(screen.getByRole('button', { name: 'Nuevo bloque' }));
      const dialog = await openDialog();
      await userEvent.click(
        within(dialog).getByRole('combobox', { name: 'Idioma en que lo escribes' }),
      );
      await userEvent.click(await screen.findByRole('option', { name: 'English' }));
      expect(within(dialog).getByRole('textbox', { name: 'Título en español' })).toBeTruthy();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Exam');

      TestBed.inject(MockNetwork).setLatency({ min: 5, max: 5 });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear el bloque' }));
      expect(await within(dialog).findByText('Guardando…')).toBeTruthy();
      expect((await within(dialog).findByRole('alert')).textContent).toContain(
        'No se ha podido guardar',
      );
      await settle(harness);
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('asks for the day a block opens when only its time is given', async () => {
      const harness = await renderBlocks(DAW);

      await menu('Acciones del bloque «Repaso final»', 'Editar el bloque');
      const dialog = await openDialog();
      // Typed without a click, which would open the list of times
      within(dialog).getByRole('combobox', { name: 'Hora' }).focus();
      await userEvent.keyboard('9:00');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await settle(harness);

      expect(text(dialog)).toContain('Elige el día en que se abre');
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('asks for the day of a due date', async () => {
      const harness = await renderBlocks(DAW);

      // One without a date yet
      await userEvent.click(
        screen.getAllByRole('button', { name: /^Fecha de entrega de «Contar números pares»/ })[0],
      );
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await settle(harness);

      expect(text(dialog)).toContain('Elige el día');
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  describe('copying blocks (5.2c)', () => {
    const NEXT = 'next-year';
    const EMPTY = 'empty-group';

    /** The same class next year, without blocks, and a group of the same subject without any. */
    function newGroups(db: MockDb): void {
      db.update('classes', (classes) => [
        ...classes,
        { ...classes[0], id: 'next-class', schoolYear: '2027/28' },
        { ...classes[0], id: 'workshop', name: 'Taller' },
      ]);
      db.update('groups', (groups) => [
        ...groups,
        {
          id: NEXT,
          classId: 'next-class',
          label: null,
          teacherId: TEACHER_ID,
          subjectId: BASIC_PROGRAMMING_ID,
        },
        {
          id: EMPTY,
          classId: 'workshop',
          label: null,
          teacherId: TEACHER_ID,
          subjectId: BASIC_PROGRAMMING_ID,
        },
      ]);
    }

    it('copies the blocks of last year into an empty group, with their dates moved', async () => {
      const harness = await renderBlocks(`/docente/bloques?grupo=${NEXT}`, newGroups);

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      const dialog = await openDialog();
      expect(text(within(dialog).getByRole('heading'))).toBe(
        'Copiar bloques en 1.º DAW A · Programación básica · 2027/28',
      );
      expect(text(dialog)).toContain('como los primeros de este grupo');
      expect(text(dialog)).toContain('Elige el grupo para ver dónde caen.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      expect(text(dialog)).toContain('Elige el grupo');

      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      const options = await screen.findAllByRole('option');
      // Those of the same subject first
      expect(options.map((option) => text(option))).toEqual([
        '1.º DAW A · Programación básica · 2026/27',
        'Taller · Programación básica',
        '1.º DAW A · Desarrollo web en entorno cliente',
      ]);
      await userEvent.click(options[0]);
      expect(text(dialog)).toContain('pasan a 2027/28, el mismo día de la semana');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);

      const sources = SEED.classBlocks.filter((row) => row.groupId === DAW_GROUP_ID);
      expect(blockHeadings()).toHaveLength(sources.length);
      expect(snack).toHaveBeenCalledWith(
        `${sources.length} bloques copiados de 1.º DAW A · Programación básica · 2026/27`,
        'Deshacer',
        { duration: 10_000 },
      );
      // The first copy, at the top of the page with the focus
      await vi.waitFor(() => expect(document.activeElement).toBe(blockHeadings()[0]));
      const copiedDates = db
        .tables()
        .assignments.filter((row) => row.groupId === NEXT && row.dueAt !== null);
      expect(copiedDates.length).toBeGreaterThan(0);
      expect(copiedDates.every((row) => row.dueAt!.startsWith('2027-'))).toBe(true);
    });

    it('copies after the blocks a group has, without dates, and says when there was nothing', async () => {
      const harness = await renderBlocks(DAW, newGroups);
      const before = blockHeadings().length;

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      let dialog = await openDialog();
      expect(text(dialog)).toContain(`después de los ${before} bloques que ya tiene`);
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', { name: 'Taller · Programación básica' }),
      );
      expect(text(dialog)).toContain('Las mismas fechas de apertura y entrega.');
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Con sus fechas' }));
      expect(text(dialog)).toContain('sin fechas de apertura ni de entrega');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith('Ese grupo no tiene bloques: no se ha copiado nada');

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', {
          name: '1.º DAW A · Desarrollo web en entorno cliente',
        }),
      );
      TestBed.inject(MockNetwork).failNextRequest('network');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      expect((await within(dialog).findByRole('alert')).textContent).toContain(
        'No se han podido copiar los bloques',
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);

      const web = SEED.classBlocks.filter((row) => row.groupId === DAW_WEB_GROUP_ID);
      expect(blockHeadings()).toHaveLength(before + web.length);
    });

    it('warns of the titles the group has, and undoes the copy with «Deshacer» (5.2f)', async () => {
      const undo = undoable();
      const harness = await renderBlocks(`/docente/bloques?grupo=${NEXT}`, (mock) => {
        newGroups(mock);
        mock.update('classBlocks', (rows) => [
          ...rows,
          { ...rows[0], id: 'next-1', groupId: NEXT },
        ]);
      });

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', { name: '1.º DAW A · Programación básica · 2026/27' }),
      );
      await vi.waitFor(() =>
        expect(text(within(dialog).getByRole('status'))).toContain(
          'Este grupo ya tiene «Tema 1: Bucles y condicionales»: se añadirán otra vez',
        ),
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);
      const sources = SEED.classBlocks.filter((row) => row.groupId === DAW_GROUP_ID);
      expect(blockHeadings()).toHaveLength(1 + sources.length);
      await vi.waitFor(() => expect(document.activeElement).toBe(blockHeadings()[1]));

      undo();
      await settle(harness);

      expect(blockHeadings()).toHaveLength(1);
      expect(snack).toHaveBeenCalledWith('Copia deshecha');
    });

    it('keeps on «Deshacer» a copy somebody started, and says when undoing fails', async () => {
      const undo = undoable();
      const harness = await renderBlocks(`/docente/bloques?grupo=${NEXT}`, newGroups);
      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', { name: '1.º DAW A · Programación básica · 2026/27' }),
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);
      const [copied] = db.tables().assignments.filter((row) => row.groupId === NEXT);
      startAssignment(db, copied.id);

      undo();
      await settle(harness);
      expect(blockHeadings()).toHaveLength(1);
      expect(snack).toHaveBeenCalledWith(
        'Copia deshecha, salvo los bloques que alguien ya ha empezado',
      );

      TestBed.inject(MockNetwork).failNextRequest('network');
      undo();
      await settle(harness);
      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
      expect(blockHeadings()).toHaveLength(1);
    });

    it('reloads the blocks when the copies cannot be read, and goes at once with less motion', async () => {
      Object.defineProperty(window, 'matchMedia', {
        value: () => ({ matches: true }),
        configurable: true,
      });
      const harness = await renderBlocks(`/docente/bloques?grupo=${NEXT}`, newGroups);
      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      let dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', {
          name: '1.º DAW A · Desarrollo web en entorno cliente',
        }),
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      delete (window as Partial<Window>).matchMedia;
      const web = SEED.classBlocks.filter((row) => row.groupId === DAW_WEB_GROUP_ID).length;

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', {
          name: '1.º DAW A · Desarrollo web en entorno cliente',
        }),
      );
      // The titles of the source arrive first; then the copy, and the blocks cannot be read
      await vi.waitFor(() => expect(text(within(dialog).getByRole('status'))).not.toBe(''));
      vi.spyOn(TestBed.inject(BlockService), 'listBlocks').mockRejectedValueOnce(
        new DataError('network'),
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);

      expect(blockHeadings()).toHaveLength(2 * web);
      expect(snack).toHaveBeenCalledWith(
        `${web} bloques copiados de 1.º DAW A · Desarrollo web en entorno cliente`,
        'Deshacer',
        { duration: 10_000 },
      );
    });

    it('says when a single block was copied, and from where', async () => {
      const harness = await renderBlocks(`/docente/bloques?grupo=${NEXT}`, (mock) => {
        newGroups(mock);
        mock.update('classBlocks', (rows) => [
          ...rows,
          { ...rows[0], id: 'workshop-1', groupId: EMPTY },
        ]);
      });

      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
      await userEvent.click(
        await screen.findByRole('option', { name: 'Taller · Programación básica' }),
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));
      await closed(harness);

      expect(blockHeadings()).toHaveLength(1);
      expect(snack).toHaveBeenCalledWith(
        '1 bloque copiado de Taller · Programación básica',
        'Deshacer',
        { duration: 10_000 },
      );
    });

    it('is not offered with a single group, and a cancelled copy changes nothing', async () => {
      const harness = await renderBlocks(DAW, newGroups);
      await userEvent.click(screen.getByRole('button', { name: 'Copiar de otro grupo' }));
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
      expect(snack).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      await renderBlocks(DAW, (db) =>
        db.update('groups', (groups) => groups.filter((group) => group.id === DAW_GROUP_ID)),
      );
      expect(screen.queryByRole('button', { name: 'Copiar de otro grupo' })).toBeNull();
    });
  });

  describe('a closed class (5.2f)', () => {
    /** 1.º DAW A, moved to a year that is over, and maybe reopened by the administration. */
    function closeDaw(mock: MockDb, reopened = false): void {
      const classId = mock.tables().groups.find((group) => group.id === DAW_GROUP_ID)!.classId;
      mock.update('classes', (rows) =>
        rows.map((row) => (row.id === classId ? { ...row, schoolYear: '2025/26', reopened } : row)),
      );
    }

    it('shows its blocks to read, with why nothing changes and how to use them again', async () => {
      await renderBlocks(DAW, (mock) => closeDaw(mock));

      expect(text(screen.getByText(/^El curso/))).toBe(
        'El curso 2025/26 ya terminó: estos bloques se pueden ver, pero no cambiar. Para ' +
          'reutilizarlos, abre tu grupo de 2026/27 y pulsa «Copiar de otro grupo».',
      );
      expect(blockHeadings().length).toBeGreaterThan(0);
      expect(exercisesOf('Tema 1: Bucles y condicionales')).toHaveLength(2);
      for (const name of ['Nuevo bloque', 'Copiar de otro grupo', 'Seleccionar']) {
        expect(screen.queryByRole('button', { name })).toBeNull();
      }
      expect(screen.queryAllByRole('switch')).toHaveLength(0);
      expect(
        screen.queryAllByRole('button', { name: /Acciones|Arrastrar|Ocultar|Mostrar/ }),
      ).toEqual([]);
      expect(
        screen.queryAllByRole('button', { name: /Añadir ejercicios|Fecha de entrega/ }),
      ).toEqual([]);
      // The due dates, as text
      expect(text(block('Tema 4: Cadenas y formato'))).toContain(
        'Fecha de entrega de «Contar vocales en una cadena»:',
      );
      expect(text(block('Tema 1: Bucles y condicionales'))).toContain('Sin fecha de entrega');
    });

    it('tells the administration it can reopen it, and that an empty group had no blocks', async () => {
      await renderBlocks(
        `/docente/bloques?grupo=${DAW_WEB_GROUP_ID}`,
        (mock) => {
          closeDaw(mock);
          mock.update('classBlocks', (rows) =>
            rows.filter((row) => row.groupId !== DAW_WEB_GROUP_ID),
          );
        },
        'admin',
      );

      expect(text(screen.getByText(/^El curso/))).toContain(
        'abre el grupo de 2026/27 y pulsa «Copiar de otro grupo». Para corregirlos, reabre la clase en Grupos.',
      );
      expect(screen.getByText('Este grupo no tuvo bloques')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Nuevo bloque' })).toBeNull();
    });

    it('is changed again once the administration reopens it', async () => {
      await renderBlocks(DAW, (mock) => closeDaw(mock, true));

      expect(text(screen.getByText(/^El curso/))).toContain(
        'la administración ha reabierto esta clase: estos bloques se pueden cambiar.',
      );
      expect(screen.getAllByRole('button', { name: 'Nuevo bloque' }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeTruthy();
    });
  });

  describe('deleting several blocks (5.2f)', () => {
    function box(title: string): HTMLInputElement {
      return screen.getByRole('checkbox', { name: `Marcar «${title}» para borrarlo` });
    }

    function marked(): string {
      return text(
        screen.getByRole('toolbar', { name: 'Borrar varios bloques' }).querySelector('span'),
      );
    }

    it('marks only what nobody started, and deletes it after asking', async () => {
      const harness = await renderBlocks(DAW);
      await userEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));

      expect(screen.queryByRole('button', { name: 'Nuevo bloque' })).toBeNull();
      expect(marked()).toBe('Marca los bloques que quieras borrar');
      expect(screen.getByRole('button', { name: 'Borrar' }).hasAttribute('disabled')).toBe(true);
      expect(box('Tema 1: Bucles y condicionales').disabled).toBe(true);
      const free = screen
        .getAllByRole('checkbox')
        .filter((input) => !(input as HTMLInputElement).disabled);

      await userEvent.click(screen.getByRole('button', { name: 'Marcar los no empezados' }));
      expect(marked()).toBe(`${free.length} bloques marcados`);
      await userEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }));
      expect(marked()).toBe('Marca los bloques que quieras borrar');

      await userEvent.click(box('Repaso final'));
      await userEvent.click(free.find((input) => input !== box('Repaso final'))!);
      expect(marked()).toBe('2 bloques marcados');
      await userEvent.click(free.find((input) => input !== box('Repaso final'))!);
      expect(marked()).toBe('1 bloque marcado');

      await userEvent.click(screen.getByRole('button', { name: 'Borrar 1' }));
      const dialog = await openDialog();
      expect(text(within(dialog).getByRole('heading'))).toBe('¿Borrar 1 bloque?');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));
      await closed(harness);

      expect(screen.queryByRole('heading', { level: 2, name: 'Repaso final' })).toBeNull();
      expect(snack).toHaveBeenCalledWith('Bloques borrados: 1');
      expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Nuevo bloque' }).length).toBeGreaterThan(0);
    });

    it('asks for several, keeps what somebody started meanwhile, and says when it fails', async () => {
      const harness = await renderBlocks(DAW);
      await userEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
      await userEvent.click(screen.getByRole('button', { name: 'Marcar los no empezados' }));
      const count = Number(marked().split(' ')[0]);

      await userEvent.click(screen.getByRole('button', { name: `Borrar ${count}` }));
      let dialog = await openDialog();
      expect(text(within(dialog).getByRole('heading'))).toBe(`¿Borrar ${count} bloques?`);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await closed(harness);
      expect(marked()).toBe(`${count} bloques marcados`);

      startAssignment(db, blockAssignmentId(DAW_HIDDEN_BLOCK, 5));
      await userEvent.click(screen.getByRole('button', { name: `Borrar ${count}` }));
      dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));
      await closed(harness);
      expect(snack).toHaveBeenCalledWith(
        `Bloques borrados: ${count - 1}. Los demás ya tienen intentos.`,
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Repaso final' })).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
      await userEvent.click(screen.getByRole('button', { name: 'Marcar los no empezados' }));
      expect(marked()).toBe('Marca los bloques que quieras borrar');
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeTruthy();
    });

    it('keeps the blocks when deleting them fails', async () => {
      const harness = await renderBlocks(DAW);
      await userEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
      await userEvent.click(box('Repaso final'));
      await userEvent.click(screen.getByRole('button', { name: 'Borrar 1' }));
      const dialog = await openDialog();
      TestBed.inject(MockNetwork).failNextRequest('network');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }));
      await closed(harness);

      expect(snack).toHaveBeenCalledWith('No se ha podido guardar. Inténtalo de nuevo.');
      expect(screen.getByRole('heading', { level: 2, name: 'Repaso final' })).toBeTruthy();
    });
  });
});

/** A student of 1.º DAW A opens the assignment: then their attempt keeps it. */
function startAssignment(db: MockDb, assignmentId: string): void {
  db.update('attempts', (rows) => [
    ...rows,
    { ...rows[0], id: `started-${assignmentId}`, userId: DAW_STUDENT_IDS[0], assignmentId },
  ]);
}
