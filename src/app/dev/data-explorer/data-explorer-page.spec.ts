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

  function text(): string {
    return (element().textContent ?? '').replace(/\s+/g, ' ');
  }

  function button(label: string): HTMLButtonElement {
    const found = [...element().querySelectorAll('button')].find((candidate) =>
      (candidate.textContent ?? '').replace(/\s+/g, ' ').includes(label),
    );
    if (!found) throw new Error(`No button with "${label}"`);
    return found;
  }

  async function click(label: string): Promise<void> {
    button(label).click();
    await fixture.whenStable();
  }

  function listItems(): string[] {
    return [...element().querySelectorAll('#list-title ~ ul')]
      .flatMap((list) => [...list.querySelectorAll('li')])
      .map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  /** Text of the alert, with its message and its button (if any) separated by a space. */
  function alertText(): string | undefined {
    const alert = element().querySelector('[role="alert"]');
    if (!alert) return undefined;
    const parts = alert.children.length > 0 ? [...alert.children] : [alert];
    return parts.map((part) => (part.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' ');
  }

  function textarea(): HTMLTextAreaElement | null {
    return element().querySelector('textarea');
  }

  it('asks to sign in with the dev toolbar when there is no session', async () => {
    await open(null);

    expect(element().querySelector('h1')?.textContent).toBe('Datos simulados');
    expect(text()).toContain('Sin sesión: entra como algún usuario desde la barra de desarrollo');
  });

  it("lists a student's exercises by session with their status", async () => {
    await open(DAW_STUDENT_IDS[1]); // Hugo

    expect(text()).toContain('Sesión: Hugo Sánchez Ferrer (alumnado)');
    expect(element().querySelector('#list-title')?.textContent?.trim()).toBe(
      'Ejercicios asignados',
    );
    const items = listItems();
    expect(items).toHaveLength(8);
    expect(items[0]).toBe('Sesión 1 · Contar números pares Inicial · Entregado');
    expect(items[3]).toBe('Sesión 2 · Máximo de un vector Media · Con fallos');
    expect(items[7]).toBe(
      'Sesión 4 · Buscar un valor con parada temprana Ampliación · Sin empezar',
    );
  });

  it('lists the whole bank for a teacher, without sessions or status', async () => {
    await open(TEACHER_ID);

    expect(element().querySelector('#list-title')?.textContent?.trim()).toBe('Banco de ejercicios');
    expect(listItems()[0]).toBe('Contar números pares Inicial');
    expect(listItems()).toHaveLength(8);
  });

  it('says when the list is empty', async () => {
    await open(DAM_STUDENT_IDS[0], () => TestBed.inject(MockDb).update('assignments', () => []));

    expect(listItems()[0]).toBe('No hay ejercicios.');
    expect(listItems()).toHaveLength(1 + 8);
  });

  it('shows an exercise with its visible tests and the number of hidden ones', async () => {
    await open(DAW_STUDENT_IDS[0]);
    expect(text()).toContain('Elige un ejercicio de la lista.');

    await click('Suma de los elementos de un vector');

    expect(button('Suma de los elementos de un vector').getAttribute('aria-current')).toBe('true');
    expect(text()).toContain('Escribe una función `suma` que reciba un vector de números enteros');
    expect(text()).toContain('función suma');
    expect(text()).toContain('suma([1,2,3]) → 6');
    expect(text()).toContain('suma([]) → 0');
    expect(text()).toContain('Pruebas ocultas: 1');
  });

  it('lets a student try an exercise not assigned to them and shows the access rule', async () => {
    await open(DAM_STUDENT_IDS[0]);
    expect(listItems().slice(4)).toEqual([
      'Invertir un vector',
      'Contar vocales en una cadena',
      'Media de un vector con dos decimales',
      'Buscar un valor con parada temprana',
    ]);

    await click('Invertir un vector');

    expect(alertText()).toBe('No existe o no tienes acceso. (not_found) Reintentar');
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
    expect(text()).toContain('contarPares(10) → 5');
  });

  it('retries loading the list after an error', async () => {
    await open(DAW_STUDENT_IDS[0], () =>
      vi
        .spyOn(TestBed.inject(ExerciseService), 'listAssigned')
        .mockRejectedValueOnce(new DataError('rate_limited')),
    );
    expect(alertText()).toBe('Demasiadas peticiones: espera un momento. (rate_limited) Reintentar');

    await click('Reintentar');

    expect(listItems()).toHaveLength(8);
  });

  it('retries loading the session after an unexpected error', async () => {
    await open(DAW_STUDENT_IDS[0], () =>
      vi
        .spyOn(TestBed.inject(AuthService), 'currentUser')
        .mockRejectedValueOnce(new TypeError('boom')),
    );
    expect(alertText()).toBe('Error inesperado. Reintentar');

    await click('Reintentar');

    expect(text()).toContain('Sesión: Lucía Martín Gómez (alumnado)');
  });

  describe('attempt', () => {
    beforeEach(async () => {
      await open(DAW_STUDENT_IDS[0], () => TestBed.inject(MockDb).update('attempts', () => []));
      await click('Suma de los elementos de un vector');
    });

    it('goes through the transitions of 2.4 up to the submission', async () => {
      await click('Abrir o crear el intento');
      expect(textarea()?.value).toBe('// Escribe aquí la función suma\n');
      expect(text()).toContain('Estado: En curso');

      textarea()!.value = 'function suma(v) { return 0; }';
      textarea()!.dispatchEvent(new Event('input'));
      await click('Guardar código');
      expect(text()).toContain('Estado: En curso');

      await click('Simular ejecución con fallos');
      expect(text()).toContain('Estado: Con fallos');

      await click('Simular ejecución superada');
      expect(text()).toContain('Estado: Superado');
      expect(button('Suma de los elementos de un vector').textContent).toContain('Superado');

      await click('Entregar');
      expect(text()).toContain('Estado: Entregado');
      expect(textarea()?.readOnly).toBe(true);
      expect(alertText()).toBeUndefined();

      await click('Guardar código');
      expect(alertText()).toBe('La operación no está permitida en el estado actual. (invalid)');
    });

    it('does not submit an attempt that has not passed', async () => {
      await click('Abrir o crear el intento');

      await click('Entregar');

      expect(alertText()).toBe('La operación no está permitida en el estado actual. (invalid)');
      expect(text()).toContain('Estado: En curso');
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
