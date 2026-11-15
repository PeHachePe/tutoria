import { LiveAnnouncer } from '@angular/cdk/a11y';
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
import { DAW_GROUP_ID, DAW_WEB_GROUP_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { MockBlockService } from '../../data/mock/mock-block-service';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { BlocksPage } from './blocks-page';

const NOW = '2026-11-15T09:00:00.000Z';
const DAW = `/docente/bloques?grupo=${DAW_GROUP_ID}`;

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('BlocksPage', () => {
  let db: MockDb;
  let snack: ReturnType<typeof vi.spyOn>;

  async function renderBlocks(
    url = '/docente/bloques',
    prepare: (db: MockDb) => void = () => undefined,
  ) {
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
        provideSessionOf('teacher', { id: TEACHER_ID }),
        { provide: BlockService, useClass: MockBlockService },
        { provide: ExerciseService, useClass: MockExerciseService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.setSession(TEACHER_ID);
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

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    snack = vi.spyOn(MatSnackBar.prototype, 'open');
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
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

    await menu('Acciones del bloque «Final review»', 'Editar el título');
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

      await menu('Acciones del bloque «Repaso final»', 'Editar el título');
      const dialog = await openDialog();
      const title = within(dialog).getByRole('textbox', { name: 'Título' });
      await userEvent.clear(title);
      await userEvent.type(title, 'Repaso de la evaluación');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await closed(harness);

      await vi.waitFor(
        () => expect(text(blockHeadings().at(-1) ?? null)).toBe('Repaso de la evaluación'),
        // The whole suite runs at once: give the save and the dialog time
        { timeout: 3000 },
      );
      expect(snack).toHaveBeenCalledWith('Bloque guardado');
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
      expect(announce).toHaveBeenCalledWith('Bloque «Tema 2: Vectores» en el lugar 1 de 8');
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

    it('puts an exercise back where it was if the new order cannot be saved', async () => {
      const harness = await renderBlocks(DAW);
      const page = harness.routeDebugElement?.componentInstance as {
        dropAssignment: (planned: unknown, event: Partial<CdkDragDrop<unknown>>) => void;
        blocks: { value: () => { block: { title: string } }[] };
      };
      const planned = page.blocks
        .value()
        .find((entry) => entry.block.title === 'Tema 4: Cadenas y formato');

      page.dropAssignment(planned, { previousIndex: 1, currentIndex: 1 });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      page.dropAssignment(planned, { previousIndex: 0, currentIndex: 2 });
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
});
