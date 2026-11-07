import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { AuthService } from '../../data/auth-service';
import { DataError } from '../../data/data-error';
import { ExerciseService } from '../../data/exercise-service';
import { DAM_STUDENT_IDS, DAW_STUDENT_IDS, TEACHER_ID } from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockNetwork } from '../../data/mock/mock-network';
import { provideMockData } from '../../data/mock/provide-mock-data';
import { DataExplorerPage } from './data-explorer-page';

describe('DataExplorerPage', () => {
  let fixture: ComponentFixture<DataExplorerPage>;

  /** Opens the page signed in as `userId`; `prepare` runs before the page reads anything. */
  async function open(userId: string | null, prepare?: () => void): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideMockData(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(userId);
    prepare?.();
    fixture = TestBed.createComponent(DataExplorerPage);
    await fixture.whenStable();
  }

  afterEach(() => localStorage.clear());

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function clean(text: string | null | undefined): string {
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  function text(): string {
    return clean(element().textContent);
  }

  /** A button by its accessible name: its aria-label or, without one, its text. */
  function button(label: string): HTMLButtonElement {
    const found = [...element().querySelectorAll('button')].find((candidate) =>
      (candidate.getAttribute('aria-label') ?? spoken(candidate)).includes(label),
    );
    if (!found) throw new Error(`No button with "${label}"`);
    return found;
  }

  async function click(label: string): Promise<void> {
    button(label).click();
    await fixture.whenStable();
  }

  function listSection(): HTMLElement {
    return element().querySelector('#exercise-list')!;
  }

  /** What a screen reader reads of an element: its text without the decorative icons. */
  function spoken(node: Element): string {
    const copy = node.cloneNode(true) as Element;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((icon) => icon.remove());
    return clean(copy.textContent);
  }

  /** Each line of the list: a session heading or an exercise with its chip. */
  function listLines(): string[] {
    return [...listSection().querySelectorAll('h3, li, p')].map(spoken);
  }

  /** Text of the alert without its icon. */
  function alertText(): string | undefined {
    const alert = element().querySelector('[role="alert"]');
    if (!alert) return undefined;
    return [...alert.children]
      .filter((child) => child.tagName !== 'MAT-ICON')
      .map((child) => clean(child.textContent))
      .join(' ');
  }

  function textarea(): HTMLTextAreaElement | null {
    return element().querySelector('textarea');
  }

  /** Each example as it reads: «suma([1, 2, 3]) devuelve 6». */
  function examples(): string[] {
    return [...element().querySelectorAll('mat-expansion-panel li')].map(spoken);
  }

  function panelHeader(title: string): HTMLElement {
    const header = [...element().querySelectorAll<HTMLElement>('mat-expansion-panel-header')].find(
      (candidate) => spoken(candidate).startsWith(title),
    );
    if (!header) throw new Error(`No panel "${title}"`);
    return header;
  }

  it('asks to sign in with the dev toolbar when there is no session', async () => {
    await open(null);

    expect(element().querySelector('h1')?.textContent).toBe('Datos simulados');
    expect(text()).toContain('Sin sesión: entra como algún usuario desde la barra de desarrollo');
  });

  it("groups a student's exercises by session, each with the status chip of its attempt", async () => {
    await open(DAW_STUDENT_IDS[1]); // Hugo

    expect(text()).toContain('Hugo Sánchez Ferrer · alumnado');
    expect(element().querySelector('#list-title')?.textContent?.trim()).toBe(
      'Ejercicios asignados',
    );
    expect(listLines()).toEqual([
      'Sesión 1',
      'Contar números pares Entregado',
      'Tabla de multiplicar Entregado',
      'Sesión 2',
      'Suma de los elementos de un vector Entregado',
      'Máximo de un vector Con fallos',
      'Sesión 3',
      'Invertir un vector Con fallos',
      'Sesión 4',
      'Contar vocales en una cadena En curso',
      'Media de un vector con dos decimales Sin empezar',
      'Buscar un valor con parada temprana Sin empezar',
    ]);
    expect(listSection().querySelectorAll('app-status-chip')).toHaveLength(8);
  });

  it('lists the whole bank for a teacher, with the difficulty instead of a status', async () => {
    await open(TEACHER_ID);

    expect(element().querySelector('#list-title')?.textContent?.trim()).toBe('Banco de ejercicios');
    expect(listSection().querySelectorAll('h3')).toHaveLength(0);
    expect(listSection().querySelectorAll('app-difficulty-chip')).toHaveLength(8);
    expect(listSection().querySelectorAll('app-status-chip')).toHaveLength(0);
  });

  it('says when the list is empty', async () => {
    await open(DAM_STUDENT_IDS[0], () => TestBed.inject(MockDb).update('assignments', () => []));

    expect(clean(listSection().querySelector('p')?.textContent)).toBe('No hay ejercicios.');
  });

  it('folds the list away from its own header, keeping the button to bring it back', async () => {
    await open(DAW_STUDENT_IDS[0]);
    const toggle = button('Ocultar la lista');
    expect(toggle.closest('section')?.contains(listSection())).toBe(true);
    expect(toggle.getAttribute('aria-controls')).toBe('exercise-list');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await click('Ocultar la lista');

    expect(listSection().hidden).toBe(true);
    expect(button('Mostrar la lista').getAttribute('aria-expanded')).toBe('false');
    await click('Mostrar la lista');
    expect(listSection().hidden).toBe(false);
  });

  it('shows an exercise with its statement and its examples', async () => {
    await open(DAW_STUDENT_IDS[0]);
    expect(text()).toContain('Elige un ejercicio de la lista.');

    await click('Suma de los elementos de un vector');

    expect(button('Suma de los elementos de un vector').getAttribute('aria-current')).toBe('true');
    expect(clean(element().querySelector('#detail-title')?.textContent)).toBe(
      'Suma de los elementos de un vector',
    );
    const detail = element().querySelector('#detail-title')!.closest('section')!;
    expect(spoken(detail.querySelector('app-difficulty-chip')!)).toBe('Media');
    expect(text()).toContain('Escribe una función suma que reciba un vector de números enteros');
    expect(element().querySelector('mat-expansion-panel p code')?.textContent).toBe('suma');
    expect(text()).toContain('Función suma · el tutor interviene tras 3 fallos seguidos o 4 min');
    expect(examples()).toEqual([
      'suma([1, 2, 3]) devuelve 6',
      'suma([5]) devuelve 5',
      'suma([]) devuelve 0',
      'suma([-2, 2, 10]) devuelve 10',
    ]);
    expect(spoken(panelHeader('Ejemplos'))).toBe('Ejemplos (4)');
    expect(text()).toContain('Y 1 comprobación oculta: el alumno verá si las supera');
  });

  it('shows a text result line by line, not as a quoted string', async () => {
    await open(DAW_STUDENT_IDS[0]);

    await click('Tabla de multiplicar');

    expect(examples()[0]).toMatch(/^tablaMultiplicar\(2\) devuelve el texto: 2 x 1 = 2/);
    const block = element().querySelector('mat-expansion-panel li pre');
    expect(block?.textContent?.split('\n')).toHaveLength(10);
    expect(block?.textContent).not.toContain('"');
  });

  it('folds the statement and the examples away independently', async () => {
    await open(DAW_STUDENT_IDS[0]);
    await click('Suma de los elementos de un vector');
    const statement = panelHeader('Enunciado');
    const examplesHeader = panelHeader('Ejemplos');
    expect(statement.getAttribute('aria-expanded')).toBe('true');

    examplesHeader.click();
    await fixture.whenStable();

    expect(examplesHeader.getAttribute('aria-expanded')).toBe('false');
    expect(statement.getAttribute('aria-expanded')).toBe('true');
  });

  it('counts several hidden checks in plural', async () => {
    await open(DAW_STUDENT_IDS[0], () =>
      TestBed.inject(MockDb).update('tests', (tests) =>
        tests.map((t) => ({ ...t, isHidden: true })),
      ),
    );

    await click('Contar números pares');

    expect(examples()).toEqual([]);
    expect(text()).toContain('Y 4 comprobaciones ocultas');
  });

  it('lets a student try an exercise not assigned to them and shows the access rule', async () => {
    await open(DAM_STUDENT_IDS[0]);
    expect(listLines().slice(-5)).toEqual([
      'No asignados · prueba la regla de acceso',
      'Invertir un vector',
      'Contar vocales en una cadena',
      'Media de un vector con dos decimales',
      'Buscar un valor con parada temprana',
    ]);

    await click('Invertir un vector');

    expect(alertText()).toBe('No existe o no tienes acceso. (not_found) Reintentar');
    expect(clean(element().querySelector('#detail-title')?.textContent)).toBe('Ejercicio');
  });

  it('retries loading an exercise after an error', async () => {
    await open(DAW_STUDENT_IDS[0]);
    vi.spyOn(TestBed.inject(ExerciseService), 'getDetail').mockRejectedValueOnce(
      new DataError('network'),
    );

    await click('Contar números pares');
    expect(alertText()).toBe('Sin conexión con el servidor. (network) Reintentar');

    await click('Reintentar');
    expect(alertText()).toBeUndefined();
    expect(examples()[0]).toBe('contarPares(10) devuelve 5');
  });

  it('retries loading the list after an error', async () => {
    await open(DAW_STUDENT_IDS[0], () =>
      vi
        .spyOn(TestBed.inject(ExerciseService), 'listAssigned')
        .mockRejectedValueOnce(new DataError('rate_limited')),
    );
    expect(alertText()).toBe('Demasiadas peticiones: espera un momento. (rate_limited) Reintentar');

    await click('Reintentar');

    expect(listSection().querySelectorAll('app-status-chip')).toHaveLength(8);
  });

  it('retries loading the session after an unexpected error', async () => {
    await open(DAW_STUDENT_IDS[0], () =>
      vi
        .spyOn(TestBed.inject(AuthService), 'currentUser')
        .mockRejectedValueOnce(new TypeError('boom')),
    );
    expect(alertText()).toBe('Error inesperado. Reintentar');

    await click('Reintentar');

    expect(text()).toContain('Lucía Martín Gómez · alumnado');
  });

  describe('attempt', () => {
    beforeEach(async () => {
      await open(DAW_STUDENT_IDS[0], () => TestBed.inject(MockDb).update('attempts', () => []));
      await click('Suma de los elementos de un vector');
    });

    function attemptChip(): string {
      const detail = element().querySelector('#detail-title')!.closest('section')!;
      return spoken(detail.querySelector('app-status-chip')!);
    }

    it('starts empty, with a hint of the function to write instead of text to delete', async () => {
      await click('Abrir o crear el intento');

      expect(textarea()?.value).toBe('');
      expect(textarea()?.placeholder).toBe('Escribe aquí la función suma');
      expect(attemptChip()).toBe('En curso');
    });

    it('goes through the transitions of 2.4 up to the submission', async () => {
      await click('Abrir o crear el intento');

      textarea()!.value = 'function suma(v) { return 0; }';
      textarea()!.dispatchEvent(new Event('input'));
      await click('Guardar');
      expect(attemptChip()).toBe('En curso');

      await click('Con fallos');
      expect(attemptChip()).toBe('Con fallos');

      await click('Superada');
      expect(attemptChip()).toBe('Superado');
      expect(clean(button('Suma de los elementos de un vector').textContent)).toContain('Superado');

      await click('Entregar');
      expect(attemptChip()).toBe('Entregado');
      expect(textarea()?.readOnly).toBe(true);
      expect(alertText()).toBeUndefined();

      await click('Guardar');
      expect(alertText()).toBe('La operación no está permitida en el estado actual. (invalid)');
    });

    it('labels the simulated run buttons as a group', async () => {
      await click('Abrir o crear el intento');

      const group = element().querySelector('[role="group"]');
      const label = element().querySelector(`#${group?.getAttribute('aria-labelledby')}`);
      expect(clean(label?.textContent)).toBe('Simular ejecución:');
    });

    it('does not submit an attempt that has not passed', async () => {
      await click('Abrir o crear el intento');

      await click('Entregar');

      expect(alertText()).toBe('La operación no está permitida en el estado actual. (invalid)');
      expect(attemptChip()).toBe('En curso');
    });

    it('shows a failed request and keeps the attempt closed', async () => {
      TestBed.inject(MockNetwork).failNextRequest('network');

      await click('Abrir o crear el intento');

      expect(alertText()).toBe('Sin conexión con el servidor. (network)');
      expect(textarea()).toBeNull();
    });

    it('closes the attempt when another exercise is chosen', async () => {
      await click('Abrir o crear el intento');

      await click('Máximo de un vector');

      expect(textarea()).toBeNull();
      expect(button('Abrir o crear el intento')).toBeTruthy();
    });
  });
});
