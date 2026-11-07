import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { AttemptStatus } from '../../data/attempt';
import { DataError } from '../../data/data-error';
import type { AssignedExercise } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { SEED } from '../../data/mock/fixtures/seed';
import type { HintLevel } from '../../data/tutor';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { CatalogPage } from './catalog-page';

function entry(
  index: number,
  session: number,
  status: AttemptStatus,
  hintCount = 0,
  hintLevel: HintLevel | null = null,
): AssignedExercise {
  return {
    exercise: SEED.exercises[index],
    assignmentId: `assignment-${index}`,
    session,
    status,
    hintCount,
    hintLevel,
  };
}

const ENTRIES = [
  entry(0, 1, 'submitted'),
  entry(1, 1, 'passed', 1, 1),
  entry(2, 2, 'in_progress', 2, 3),
  entry(3, 2, 'not_started'),
];

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function sessionToggle(session: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Sesión ${session} `) });
}

/** Unfolds a session, as the complete ones start folded. */
async function unfold(session: number): Promise<void> {
  await userEvent.setup().click(sessionToggle(session));
}

function cardOf(title: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement;
}

describe('CatalogPage', () => {
  function renderWith(listAssigned: ExerciseService['listAssigned']) {
    return render(CatalogPage, {
      providers: [
        provideSessionOf('student'),
        provideRouter([]),
        { provide: ExerciseService, useValue: { listAssigned } },
      ],
    });
  }

  async function renderLoaded(listAssigned: ExerciseService['listAssigned']) {
    const result = await renderWith(listAssigned);
    await restoreSession();
    await result.fixture.whenStable();
    return result;
  }

  it("lists the student's exercises by session with their progress", async () => {
    const listAssigned = vi.fn(() => Promise.resolve(ENTRIES));
    await renderLoaded(listAssigned);

    expect(listAssigned).toHaveBeenCalledWith('student-1');
    expect(screen.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: '2/4 superados' });
    expect(progress.getAttribute('aria-valuenow')).toBe('50');

    const [first, second] = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.closest('section') as HTMLElement);
    expect(within(first).getByRole('heading', { name: 'Sesión 1 2/2 superados' })).toBeTruthy();
    expect(within(second).getByRole('heading', { name: 'Sesión 2 0/2 superados' })).toBeTruthy();
    expect(within(second).getAllByRole('heading', { level: 3 }).map(text)).toEqual([
      'Suma de los elementos de un vector',
      'Máximo de un vector',
    ]);
  });

  it('folds away the complete sessions at first, and folds or unfolds any of them', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));

    expect(sessionToggle(1).getAttribute('aria-expanded')).toBe('false');
    expect(sessionToggle(2).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('heading', { level: 3, name: 'Contar números pares' })).toBeNull();

    await unfold(1);
    await userEvent.setup().click(sessionToggle(2));

    expect(sessionToggle(1).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: 'Contar números pares' })).toBeTruthy();
    expect(sessionToggle(2).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('heading', { level: 3, name: 'Máximo de un vector' })).toBeNull();
    const list = document.getElementById(sessionToggle(2).getAttribute('aria-controls') ?? '');
    expect(list?.hidden).toBe(true);
  });

  it('shows the contents, the chips and the hints asked of each exercise', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));
    await unfold(1);

    const card = cardOf('Suma de los elementos de un vector');
    expect(within(card).getByText('Vectores · acumulador · vector vacío')).toBeTruthy();
    expect(within(card).getByText('Media')).toBeTruthy();
    expect(within(card).getByText('En curso')).toBeTruthy();
    expect(within(card).getByText('2 pistas pedidas')).toBeTruthy();
    expect(within(card).getByText('· nivel 3')).toBeTruthy();
    expect(within(cardOf('Tabla de multiplicar')).getByText('1 pista pedida')).toBeTruthy();
    expect(text(cardOf('Contar números pares'))).not.toContain('pista');
  });

  it('offers to start, continue or review each exercise, naming it', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));
    await unfold(1);

    const links = screen.getAllByRole('link');
    expect(links.map(text)).toEqual([
      'Repasar: Contar números pares',
      'Continuar: Tabla de multiplicar',
      'Continuar: Suma de los elementos de un vector',
      'Empezar: Máximo de un vector',
    ]);
    expect(links[3].getAttribute('href')).toBe(`/alumno/ejercicio/${SEED.exercises[3].id}`);
  });

  it('shows the skeletons and announces the wait only past the threshold', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, container } = await renderWith(() => new Promise(() => undefined));
      await restoreSession();
      fixture.detectChanges();

      expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(container.querySelector('app-skeleton')).toBeNull();

      vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
      fixture.detectChanges();

      expect(container.querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
      expect(text(screen.getByRole('status'))).toBe('Cargando los ejercicios…');
      expect(screen.queryByRole('progressbar')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the student has no exercises', async () => {
    await renderLoaded(() => Promise.resolve([]));

    expect(screen.getByText('Aún no tienes ejercicios asignados')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the error and loads again on retry', async () => {
    const listAssigned = vi
      .fn<ExerciseService['listAssigned']>()
      .mockRejectedValueOnce(new DataError('network'))
      .mockResolvedValueOnce(ENTRIES);
    const { fixture } = await renderLoaded(listAssigned);

    expect(text(screen.getByRole('alert'))).toContain('No hay conexión');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });
});
