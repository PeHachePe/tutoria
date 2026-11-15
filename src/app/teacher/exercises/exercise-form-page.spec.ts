import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { unsavedChangesGuard } from '../../core/unsaved-changes-guard';
import { DataError } from '../../data/data-error';
import { ExerciseService } from '../../data/exercise-service';
import { SEED } from '../../data/mock/fixtures/seed';
import { ADVANCED_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockExerciseService } from '../../data/mock/mock-exercise-service';
import { MockNetwork } from '../../data/mock/mock-network';
import { ExerciseFormPage } from './exercise-form-page';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const SUM = SEED.exercises.find((exercise) => exercise.functionName === 'sum') ?? SEED.exercises[0];
const OTHERS = SEED.exercises.find((exercise) => exercise.createdBy === OTHER_TEACHER_ID) ?? SUM;

describe('ExerciseFormPage', () => {
  let harness: RouterTestingHarness;
  let snackBar: ReturnType<typeof vi.spyOn>;

  async function renderForm(url: string, prepare: (db: MockDb) => void = () => undefined) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'docente/ejercicios', children: [] },
            {
              path: 'docente/ejercicios/nuevo',
              component: ExerciseFormPage,
              canDeactivate: [unsavedChangesGuard],
            },
            {
              path: 'docente/ejercicios/:exerciseId',
              component: ExerciseFormPage,
              canDeactivate: [unsavedChangesGuard],
            },
          ],
          withComponentInputBinding(),
        ),
        provideSessionOf('teacher', { id: TEACHER_ID }),
        MockExerciseService,
        { provide: ExerciseService, useExisting: MockExerciseService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(TEACHER_ID);
    prepare(TestBed.inject(MockDb));
    snackBar = vi.spyOn(MatSnackBar.prototype, 'open');
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

  function field(name: string | RegExp): HTMLInputElement {
    return screen.getByRole('textbox', { name }) as HTMLInputElement;
  }

  afterEach(() => localStorage.clear());

  describe('a new exercise', () => {
    it('starts empty, in the language of the interface, with one test to fill', async () => {
      await renderForm('/docente/ejercicios/nuevo');

      expect(screen.getByRole('heading', { level: 1, name: 'Nuevo ejercicio' })).toBeTruthy();
      expect(field('Título').value).toBe('');
      expect(screen.getAllByRole('group', { name: /^Prueba / })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Crear el ejercicio' })).toBeTruthy();
      expect(text(screen.getByText(/El esqueleto que da el tutor/).parentElement)).toContain(
        'function …() {}',
      );
    });

    it('starts in the subject the bank showed', async () => {
      await renderForm(`/docente/ejercicios/nuevo?asignatura=${ADVANCED_PROGRAMMING_ID}`);

      expect(text(screen.getByRole('combobox', { name: 'Asignaturas' }))).toBe(
        'Programación avanzada',
      );
    });

    it('says what is missing and takes the focus to the first field with an error', async () => {
      await renderForm('/docente/ejercicios/nuevo');

      await userEvent.click(screen.getByRole('button', { name: 'Crear el ejercicio' }));
      await settle();

      expect(screen.getByText('Escribe el título')).toBeTruthy();
      expect(screen.getByText('Escribe el nombre de la función')).toBeTruthy();
      expect(screen.getByText('Elige al menos una asignatura')).toBeTruthy();
      await vi.waitFor(() => expect(document.activeElement).toBe(field('Título')));
    });

    it('opens the tab of a translation started halfway to show its error', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`, (db) =>
        db.update('exercises', (rows) =>
          rows.map((row) =>
            row.id === SUM.id
              ? { ...row, translations: { ca: { title: '', statement: '', topics: ['Vectors'] } } }
              : row,
          ),
        ),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }));
      await settle();

      await vi.waitFor(() =>
        expect(screen.getByRole('tab', { name: /Català/, selected: true })).toBeTruthy(),
      );
      expect(screen.getByRole('tab', { name: /con errores/ })).toBeTruthy();
      await vi.waitFor(() => expect(document.activeElement).toBe(field('Título')));
    });

    it('creates the exercise and opens it as itself', async () => {
      await renderForm(`/docente/ejercicios/nuevo?asignatura=${ADVANCED_PROGRAMMING_ID}`);

      // Before the function has a name, the call says «f»
      await userEvent.type(field('Argumentos'), '1');
      await userEvent.type(field('Resultado esperado'), '1');
      expect(screen.getByText('f(1) → 1')).toBeTruthy();
      await userEvent.clear(field('Argumentos'));
      await userEvent.clear(field('Resultado esperado'));

      await userEvent.type(field('Título'), 'Producto');
      await userEvent.type(field('Enunciado'), 'Escribe `product`.');
      await userEvent.type(field('Contenidos'), 'Vectores, acumulador');
      await userEvent.type(field('Nombre de la función'), 'product');
      await userEvent.type(field('Parámetros'), 'numbers');
      await userEvent.type(field('Argumentos'), '[[2, 3]'); // «[[» types a «[»
      await userEvent.type(field('Resultado esperado'), '6');
      expect(screen.getByText('product([2, 3]) → 6')).toBeTruthy();
      expect(screen.getByText('Hay cambios sin guardar')).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Crear el ejercicio' }));
      await vi.waitFor(() => expect(snackBar).toHaveBeenCalledWith('Ejercicio creado'));
      await settle();

      const created = TestBed.inject(MockDb)
        .tables()
        .exercises.find((exercise) => exercise.title === 'Producto');
      expect(created).toMatchObject({
        functionName: 'product',
        parameters: ['numbers'],
        topics: ['Vectores', 'acumulador'],
      });
      expect(TestBed.inject(Router).url).toBe(`/docente/ejercicios/${created?.id}`);
    });
  });

  describe('an exercise of the teacher', () => {
    it('shows it, warns that students started it and saves its changes', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);

      expect(screen.getByRole('heading', { level: 1, name: 'Editar el ejercicio' })).toBeTruthy();
      expect(field('Título').value).toBe(SUM.title);
      expect(screen.getByText(/alumnos ya lo han empezado/)).toBeTruthy();
      expect(screen.getAllByRole('group', { name: /^Prueba / }).length).toBeGreaterThan(1);
      expect(screen.queryByText('Hay cambios sin guardar')).toBeNull();

      await userEvent.clear(field('Título'));
      await userEvent.type(field('Título'), 'Sumar un vector');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }));

      await vi.waitFor(() => expect(snackBar).toHaveBeenCalledWith('Cambios guardados'));
      await settle();
      expect(
        TestBed.inject(MockDb)
          .tables()
          .exercises.find((e) => e.id === SUM.id)?.title,
      ).toBe('Sumar un vector');
      expect(screen.queryByText('Hay cambios sin guardar')).toBeNull();
    });

    it('adds a test with the focus on it and removes it again', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);
      const count = screen.getAllByRole('group', { name: /^Prueba / }).length;

      await userEvent.click(screen.getByRole('button', { name: 'Añadir prueba' }));
      await settle();

      const tests = screen.getAllByRole('group', { name: /^Prueba / });
      expect(tests).toHaveLength(count + 1);
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          within(tests[count]).getByRole('textbox', { name: 'Argumentos' }),
        ),
      );

      await userEvent.click(screen.getByRole('button', { name: `Quitar la prueba ${count + 1}` }));
      await settle();
      expect(screen.getAllByRole('group', { name: /^Prueba / })).toHaveLength(count);
    });

    it('marks a hidden test as such and asks for a visible one', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);
      const hidden = screen.getAllByRole('group', { name: /^Prueba / }).at(-1) as HTMLElement;
      expect(text(hidden)).toContain('El alumno no la ve: solo sabrá si pasa.');

      for (const box of screen.getAllByRole('checkbox', { name: 'Oculta' })) {
        if (!(box as HTMLInputElement).checked) await userEvent.click(box);
      }
      await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }));
      await settle();

      expect(
        screen.getByText('Deja al menos una prueba visible: el alumno aprende de ella'),
      ).toBeTruthy();
    });

    it('shows the exercise as the student will read it', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);

      await userEvent.click(screen.getByRole('tab', { name: /English/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Ver como el alumno' }));

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByRole('heading', { name: SUM.translations.en?.title }),
      ).toBeTruthy();
      expect(text(dialog)).toContain('sum([1, 2, 3])');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    });

    it.each([
      ['forbidden', 'Solo quien escribió el ejercicio puede cambiarlo. Duplícalo para adaptarlo.'],
      ['network', 'Sin conexión: no se ha guardado. Inténtalo de nuevo.'],
      ['unknown', 'No se ha podido guardar. Inténtalo de nuevo.'],
    ] as const)('says why it could not save (%s)', async (kind, message) => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);
      vi.spyOn(MockExerciseService.prototype, 'update').mockRejectedValueOnce(new DataError(kind));

      await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }));

      expect(await screen.findByRole('alert')).toHaveProperty('textContent', message);
    });

    it('asks before leaving with unsaved changes, and stays if the teacher says so', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);
      await userEvent.type(field('Título'), '!');
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);

      const leaving = harness.navigateByUrl('/docente/ejercicios');
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: '¿Salir sin guardar?' })).toBeTruthy();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await leaving;

      expect(TestBed.inject(Router).url).toBe(`/docente/ejercicios/${SUM.id}`);
    });

    it('leaves without asking when nothing changed', async () => {
      await renderForm(`/docente/ejercicios/${SUM.id}`);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);

      await harness.navigateByUrl('/docente/ejercicios');

      expect(TestBed.inject(Router).url).toBe('/docente/ejercicios');
    });
  });

  it("only shows another teacher's exercise, with a way to duplicate it", async () => {
    await renderForm(`/docente/ejercicios/${OTHERS.id}`);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Ejercicio de otro docente' }),
    ).toBeTruthy();
    expect(field('Título').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Añadir prueba' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Duplicar' }).getAttribute('href')).toBe(
      `/docente/ejercicios/nuevo?copia=${OTHERS.id}`,
    );
  });

  it('starts a copy with the texts and tests of the original, marked as a copy', async () => {
    await renderForm(`/docente/ejercicios/nuevo?copia=${OTHERS.id}`);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Nuevo ejercicio a partir de otro' }),
    ).toBeTruthy();
    expect(field('Título').value).toBe(`${OTHERS.title} (copia)`);
    expect(field('Nombre de la función').value).toBe(OTHERS.functionName);
    expect(screen.getByRole('button', { name: 'Crear el ejercicio' })).toBeTruthy();
  });

  it('offers a way back from an exercise that is not there', async () => {
    await renderForm('/docente/ejercicios/missing');

    expect(text(screen.getByRole('alert'))).toContain('No tienes acceso a este contenido.');
    expect(screen.getByRole('link', { name: 'Volver a los ejercicios' })).toBeTruthy();
  });

  it('loads again after a network error', async () => {
    vi.spyOn(MockExerciseService.prototype, 'getWithTests').mockRejectedValueOnce(
      new DataError('network'),
    );
    await renderForm(`/docente/ejercicios/${SUM.id}`);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();

    expect(field('Título').value).toBe(SUM.title);
  });
});
