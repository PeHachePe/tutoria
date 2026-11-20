import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { provideLocalizedPaginator } from '../../core/i18n/localized-paginator-intl';
import { BlockService } from '../../data/block-service';
import { DataError } from '../../data/data-error';
import { ExerciseService } from '../../data/exercise-service';
import { exerciseId } from '../../data/mock/fixtures/exercises';
import { SEED } from '../../data/mock/fixtures/seed';
import { ADVANCED_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { fixtureId } from '../../data/mock/fixtures/fixture-id';
import {
  ADMIN_ID,
  DAW_GROUP_ID,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from '../../data/mock/fixtures/users';
import { MockBlockService } from '../../data/mock/mock-block-service';
import { withoutHistory } from '../../data/mock/fixtures/history';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { ExerciseBankPage } from './exercise-bank-page';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Marta's subjects: basic programming (15) and web development (15). */
/** Of the teacher's subjects, without the archived «Tabla de multiplicar». */
const MY_EXERCISES = 29;

describe('ExerciseBankPage', () => {
  let service: MockExerciseService;

  async function renderBank(
    url = '/docente/ejercicios',
    userId = TEACHER_ID,
    prepare: (db: MockDb) => void = () => undefined,
  ) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'docente/ejercicios', component: ExerciseBankPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideLocalizedPaginator(),
        provideSessionOf(userId === ADMIN_ID ? 'admin' : 'teacher', { id: userId }),
        MockExerciseService,
        { provide: ExerciseService, useExisting: MockExerciseService },
        { provide: BlockService, useClass: MockBlockService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(userId);
    // This year alone: the groups of the years before are not what these test
    withoutHistory(TestBed.inject(MockDb));
    prepare(TestBed.inject(MockDb));
    service = TestBed.inject(MockExerciseService);
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

  function rows(): HTMLElement[] {
    return within(screen.getByRole('list', { name: 'Ejercicios del banco' })).getAllByRole(
      'listitem',
    );
  }

  afterEach(() => localStorage.clear());

  it("shows a page of the teacher's subjects, newest first, with what each one is", async () => {
    await renderBank();

    expect(screen.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeTruthy();
    expect(screen.getByText(`${MY_EXERCISES} ejercicios`)).toBeTruthy();
    expect(rows()).toHaveLength(20);
    const first = rows()[0];
    expect(within(first).getByRole('link', { name: 'Contar números pares' })).toBeTruthy();
    expect(text(first)).toContain('Programación básica');
    expect(text(first)).toContain('countEvens()');
    expect(text(first)).toContain('Tuyo');
    expect(text(first)).toContain('5 pruebas');
    expect(text(first)).toContain('Asignado en 1.º DAW A');
    expect(text(first)).toMatch(/\d+ alumnos lo han empezado/);
    expect(screen.getByRole('link', { name: 'Nuevo ejercicio' }).getAttribute('href')).toBe(
      '/docente/ejercicios/nuevo',
    );
  });

  it('turns the page through the URL and keeps the focus on the list', async () => {
    const harness = await renderBank();

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios?pagina=2');
    expect(rows()).toHaveLength(MY_EXERCISES - 20);
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Ejercicios del banco' }));

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios');
  });

  it('searches, filters and starts again at the first page, all in the URL', async () => {
    const harness = await renderBank('/docente/ejercicios?pagina=2');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'bisiesto');
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios?buscar=bisiesto');
    expect(screen.getByText('1 ejercicio de 29')).toBeTruthy();
    expect(within(rows()[0]).getByRole('link', { name: 'Año bisiesto' })).toBeTruthy();

    await userEvent.click(screen.getByRole('switch', { name: 'Solo los míos' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toContain('mios=1');

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios?mios=1');
  });

  it('brings another subject from the server, keeping the search while it loads', async () => {
    const harness = await renderBank('/docente/ejercicios?buscar=fibonacci');
    expect(screen.getByText('Ningún ejercicio de 29')).toBeTruthy();
    const listBank = vi.spyOn(service, 'listBank');

    await userEvent.click(screen.getByRole('button', { name: 'Buscar en todas las asignaturas' }));
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveProperty('value', 'fibonacci');
    await settle(harness);

    expect(listBank).toHaveBeenCalledWith({ kind: 'all' });
    expect(screen.getByText('1 ejercicio de 41')).toBeTruthy();
    expect(text(rows()[0])).toContain('De otro docente');
  });

  it('marks the language of a title that has no translation into the interface', async () => {
    const leapYear = SEED.exercises.find((exercise) => exercise.functionName === 'isLeapYear');
    await renderBank('/docente/ejercicios?buscar=leap', TEACHER_ID, (db) =>
      db.update('exercises', (rows) =>
        rows.map((row) =>
          row.id === leapYear?.id
            ? { ...row, title: 'Leap year', sourceLocale: 'en', translations: {} }
            : row,
        ),
      ),
    );

    expect(screen.getByRole('link', { name: 'Leap year' }).getAttribute('lang')).toBe('en');
  });

  it('lists one subject, and a new exercise starts in it', async () => {
    await renderBank(`/docente/ejercicios?asignatura=${ADVANCED_PROGRAMMING_ID}`);

    expect(screen.getByText('15 ejercicios')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: /paginador|Paginator/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Nuevo ejercicio' }).getAttribute('href')).toBe(
      `/docente/ejercicios/nuevo?asignatura=${ADVANCED_PROGRAMMING_ID}`,
    );
  });

  it('chooses the subjects with the select, «Mis asignaturas» without a parameter', async () => {
    const harness = await renderBank('/docente/ejercicios?asignatura=todas');

    await userEvent.click(screen.getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(screen.getByRole('option', { name: 'Programación avanzada' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(
      `/docente/ejercicios?asignatura=${ADVANCED_PROGRAMMING_ID}`,
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(screen.getByRole('option', { name: 'Mis asignaturas' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios');
  });

  it('filters by difficulty and clears the filters, keeping the subjects', async () => {
    const harness = await renderBank('/docente/ejercicios?asignatura=todas&buscar=zzz');

    await userEvent.click(screen.getByRole('combobox', { name: 'Dificultad' }));
    await userEvent.click(screen.getByRole('option', { name: 'Avanzada' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toContain('dificultad=advanced');
    expect(screen.queryByRole('button', { name: 'Buscar en todas las asignaturas' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar los filtros' }));
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/docente/ejercicios?asignatura=todas');
    expect(screen.getByText('41 ejercicios')).toBeTruthy();
  });

  it('says so when a subject has no exercises yet', async () => {
    const harness = await renderBank();
    service.listBank = () =>
      Promise.resolve({ exercises: [], subjects: SEED.subjects, mySubjectIds: [] });

    await userEvent.click(screen.getByRole('combobox', { name: 'Asignatura' }));
    await userEvent.click(screen.getByRole('option', { name: 'Programación avanzada' }));
    await settle(harness);

    expect(screen.getByText('Todavía no hay ejercicios aquí')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buscar en todas las asignaturas' })).toBeTruthy();
  });

  it('only offers to edit and delete what the user wrote, and to view the rest', async () => {
    await renderBank('/docente/ejercicios?asignatura=todas&buscar=fibonacci');

    await userEvent.click(
      screen.getByRole('button', { name: 'Acciones de «Sucesión de Fibonacci»' }),
    );

    expect(screen.getByRole('menuitem', { name: /Ver/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Duplicar/ }).getAttribute('href')).toBe(
      `/docente/ejercicios/nuevo?copia=${exerciseId(42)}`,
    );
    expect(screen.queryByRole('menuitem', { name: /Borrar/ })).toBeNull();
  });

  it('archives an exercise somebody started instead of deleting it', async () => {
    await renderBank('/docente/ejercicios?buscar=pares');

    await userEvent.click(
      screen.getByRole('button', { name: 'Acciones de «Contar números pares»' }),
    );

    expect(screen.getByRole('menuitem', { name: /Editar/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Archivar/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Borrar/ })).toBeNull();
  });

  describe('archiving', () => {
    let undo: () => void;

    beforeEach(() => {
      undo = () => undefined;
      vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(
        () =>
          ({
            onAction: () => ({ subscribe: (next: () => void) => (undo = next) }),
          }) as never,
      );
    });

    it('takes an exercise out of the bank, with «Deshacer»', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=pares');

      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones de «Contar números pares»' }),
      );
      await userEvent.click(screen.getByRole('menuitem', { name: /Archivar/ }));
      await settle(harness);

      expect(screen.getByText('Ningún ejercicio de 28')).toBeTruthy();
      expect(MatSnackBar.prototype.open).toHaveBeenCalledWith('Ejercicio archivado', 'Deshacer');

      undo();
      await settle(harness);
      expect(screen.getByText('1 ejercicio de 29')).toBeTruthy();
      expect(MatSnackBar.prototype.open).toHaveBeenCalledWith('Ejercicio devuelto al banco');
    });

    it('shows the archived ones apart, in the URL, without assigning them', async () => {
      const harness = await renderBank();

      await userEvent.click(screen.getByRole('switch', { name: 'Archivados' }));
      await settle(harness);

      expect(TestBed.inject(Router).url).toBe('/docente/ejercicios?archivados=1');
      expect(screen.getByText('1 ejercicio')).toBeTruthy();
      expect(text(rows()[0])).toContain('Archivado');
      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones de «Tabla de multiplicar»' }),
      );
      expect(screen.queryByRole('menuitem', { name: /Asignar a un bloque/ })).toBeNull();
      await userEvent.click(screen.getByRole('menuitem', { name: /Desarchivar/ }));
      await settle(harness);

      expect(screen.getByText('Ningún ejercicio archivado')).toBeTruthy();
      expect(MatSnackBar.prototype.open).toHaveBeenCalledWith('Ejercicio devuelto al banco');
    });

    it('says when it could not archive it', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=pares');

      await userEvent.click(
        screen.getByRole('button', { name: 'Acciones de «Contar números pares»' }),
      );
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(screen.getByRole('menuitem', { name: /Archivar/ }));
      await settle(harness);

      expect(screen.getByText('1 ejercicio de 29')).toBeTruthy();
      expect(MatSnackBar.prototype.open).toHaveBeenCalledWith(
        'No se ha podido guardar. Inténtalo de nuevo.',
      );
    });
  });

  describe('deleting', () => {
    const leapYear = SEED.exercises.find((exercise) => exercise.functionName === 'isLeapYear');

    const dawBlock = SEED.classBlocks.find((block) => block.groupId === DAW_GROUP_ID);

    /** Nobody has started it, so it can go; assigned in a block of DAW A, or nowhere. */
    async function renderUnstarted(confirm: boolean, assigned = false) {
      const harness = await renderBank('/docente/ejercicios?buscar=bisiesto', TEACHER_ID, (db) => {
        db.update('attempts', (rows) => rows.filter((row) => row.exerciseId !== leapYear?.id));
        db.update('assignments', (rows) => [
          ...rows.filter((row) => row.exerciseId !== leapYear?.id),
          ...(assigned
            ? [
                {
                  id: 'leap-year-in-daw',
                  groupId: DAW_GROUP_ID,
                  blockId: dawBlock?.id ?? '',
                  exerciseId: leapYear?.id ?? '',
                  position: 9,
                  isHidden: false,
                  dueAt: null,
                },
              ]
            : []),
        ]);
      });
      const question = await deleteLeapYear(confirm);
      await settle(harness);
      return { harness, question };
    }

    /** Deletes it, or cancels, and says what the dialog asked. */
    async function deleteLeapYear(confirm = true): Promise<string> {
      await userEvent.click(screen.getByRole('button', { name: 'Acciones de «Año bisiesto»' }));
      await userEvent.click(screen.getByRole('menuitem', { name: /Borrar/ }));
      const dialog = await screen.findByRole('dialog');
      const question = text(dialog);
      await userEvent.click(
        within(dialog).getByRole('button', { name: confirm ? 'Borrar' : 'Cancelar' }),
      );
      return question;
    }

    it('asks first, deletes it and says so', async () => {
      const open = vi.spyOn(MatSnackBar.prototype, 'open');

      const { question } = await renderUnstarted(true);

      expect(question).toContain('¿Borrar «Año bisiesto»?');
      expect(question).toContain('Nadie lo ha empezado todavía. No se puede deshacer.');
      // The dialog closes with its animation before the answer comes back
      await vi.waitFor(() => expect(open).toHaveBeenCalledWith('Ejercicio borrado'));
      expect(
        TestBed.inject(MockDb)
          .tables()
          .exercises.some((e) => e.id === leapYear?.id),
      ).toBe(false);
      await vi.waitFor(() => expect(screen.getByText('Ningún ejercicio de 28')).toBeTruthy());
    });

    it('keeps it when the teacher cancels', async () => {
      const { question } = await renderUnstarted(false, true);

      expect(question).toContain('Se quitará también de los bloques de 1.º DAW A.');
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        TestBed.inject(MockDb)
          .tables()
          .exercises.some((e) => e.id === leapYear?.id),
      ).toBe(true);
    });

    it('says why when it could not delete it', async () => {
      const open = vi.spyOn(MatSnackBar.prototype, 'open');
      vi.spyOn(MockExerciseService.prototype, 'remove')
        .mockRejectedValueOnce(new DataError('invalid'))
        .mockRejectedValueOnce(new DataError('network'));

      await renderUnstarted(true);
      await vi.waitFor(() =>
        expect(open).toHaveBeenCalledWith('Ya está en uso: no se puede borrar, pero sí archivar'),
      );
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      await deleteLeapYear();
      await vi.waitFor(() =>
        expect(open).toHaveBeenCalledWith('No se ha podido borrar. Inténtalo de nuevo.'),
      );
    });
  });

  it('shows a skeleton while it first loads, without the filters', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideSessionOf('teacher', { id: TEACHER_ID }),
        { provide: ExerciseService, useValue: { listBank: () => new Promise(() => undefined) } },
      ],
    });
    await restoreSession();
    // Not through the router: a load that never ends would keep it from ever being stable
    const fixture = TestBed.createComponent(ExerciseBankPage);
    fixture.detectChanges();

    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(screen.getByText('Cargando los ejercicios…')).toBeTruthy();
      },
      { timeout: LOADING_INDICATOR_DELAY_MS * 3 },
    );
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('shows the error of the bank with a retry', async () => {
    const listBank = vi
      .spyOn(MockExerciseService.prototype, 'listBank')
      .mockRejectedValueOnce(new DataError('network'));
    await renderBank();

    expect(screen.getByRole('alert')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(screen.getByText(`${MY_EXERCISES} ejercicios`)).toBeTruthy());
    expect(listBank).toHaveBeenCalledTimes(2);
  });

  describe('assigning to a block', () => {
    const leapYear = SEED.exercises.find((exercise) => exercise.functionName === 'isLeapYear');

    /** Opens «Asignar a un bloque…» of «Año bisiesto» and waits for its groups. */
    async function openAssign(harness: RouterTestingHarness): Promise<HTMLElement> {
      await userEvent.click(screen.getByRole('button', { name: 'Acciones de «Año bisiesto»' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Asignar a un bloque…' }));
      const dialog = await screen.findByRole('dialog');
      await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      await settle(harness);
      return dialog;
    }

    async function choose(dialog: HTMLElement, select: string, option: string): Promise<void> {
      await userEvent.click(within(dialog).getByRole('combobox', { name: select }));
      await userEvent.click(await screen.findByRole('option', { name: option }));
    }

    it('assigns an exercise to a block of a group of its subjects, at the end', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=bisiesto');
      const open = vi.spyOn(MatSnackBar.prototype, 'open');

      const dialog = await openAssign(harness);
      // The group of its subject comes chosen; the block where it already is cannot be chosen
      expect(text(within(dialog).getByRole('combobox', { name: 'Grupo' }))).toBe(
        '1.º DAW A · Programación básica',
      );
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Bloque' }));
      const assigned = await screen.findByRole('option', { name: /Tema 5: Funciones con números/ });
      expect(text(assigned)).toContain('(ya está)');
      expect(assigned.getAttribute('aria-disabled')).toBe('true');
      await userEvent.click(screen.getByRole('option', { name: 'Tema 2: Vectores' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await settle(harness);

      expect(open).toHaveBeenCalledWith(
        'Asignado a «Tema 2: Vectores» (1.º DAW A · Programación básica)',
      );
      const rows = TestBed.inject(MockDb)
        .tables()
        .assignments.filter((row) => row.blockId === fixtureId('block', 2));
      expect(rows.at(-1)).toMatchObject({ exerciseId: leapYear?.id, position: 3 });
    });

    it('asks for the block, which another group empties, and says when a group has none', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=bisiesto', TEACHER_ID, (db) =>
        db.update('classBlocks', (rows) => rows.filter((row) => row.groupId !== DAW_WEB_GROUP_ID)),
      );

      const dialog = await openAssign(harness);
      await choose(dialog, 'Bloque', 'Tema 2: Vectores');
      await choose(dialog, 'Grupo', '1.º DAW A · Desarrollo web en entorno cliente');
      await settle(harness);
      expect(text(within(dialog).getByRole('combobox', { name: 'Bloque' }))).toBe('');
      expect(text(dialog)).toContain('Este grupo no tiene bloques todavía');
      expect(
        within(dialog).getByRole('link', { name: 'créalos en Bloques' }).getAttribute('href'),
      ).toBe(`/docente/bloques?grupo=${DAW_WEB_GROUP_ID}`);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));
      expect(await within(dialog).findByText('Elige el bloque')).toBeTruthy();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('keeps the dialog open with the error when assigning fails', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=bisiesto');

      const dialog = await openAssign(harness);
      await choose(dialog, 'Bloque', 'Tema 2: Vectores');
      TestBed.inject(MockNetwork).setLatency({ min: 5, max: 5 });
      TestBed.inject(MockNetwork).failNextRequest('unknown');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

      expect(await within(dialog).findByText('Asignando…')).toBeTruthy();
      expect(text(await within(dialog).findByRole('alert'))).toBe(
        'No se ha podido asignar. Inténtalo de nuevo.',
      );
    });

    it('says when the teacher has no groups, and retries the groups that fail', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=bisiesto', TEACHER_ID, (db) =>
        db.update('groups', () => []),
      );

      TestBed.inject(MockNetwork).failNextRequest('unknown');
      const dialog = await openAssign(harness);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reintentar' }));
      await settle(harness);

      expect(text(dialog)).toContain('Todavía no tienes grupos a los que asignarlo.');
      expect(
        (within(dialog).getByRole('button', { name: 'Asignar' }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('marks the language of the titles without translation, and puts other subjects last', async () => {
      const harness = await renderBank('/docente/ejercicios?buscar=leap', TEACHER_ID, (db) => {
        db.update('exercises', (rows) =>
          rows.map((row) =>
            row.id === leapYear?.id
              ? { ...row, title: 'Leap year', sourceLocale: 'en', translations: {} }
              : row,
          ),
        );
        db.update('classBlocks', (rows) =>
          rows.map((row) =>
            row.id === fixtureId('block', 2)
              ? { ...row, title: 'Topic 2: Arrays', sourceLocale: 'en', translations: {} }
              : row,
          ),
        );
      });

      await userEvent.click(screen.getByRole('button', { name: 'Acciones de «Leap year»' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Asignar a un bloque…' }));
      const dialog = await screen.findByRole('dialog');
      await settle(harness);
      expect(within(dialog).getByText('Leap year').getAttribute('lang')).toBe('en');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Grupo' }));
      const groups = (await screen.findAllByRole('option')).map((option) => text(option));
      expect(groups).toEqual([
        '1.º DAW A · Programación básica',
        '1.º DAW A · Desarrollo web en entorno cliente',
      ]);
      await userEvent.keyboard('{Escape}');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Bloque' }));
      expect((await screen.findByText('Topic 2: Arrays')).getAttribute('lang')).toBe('en');
    });
  });
});
