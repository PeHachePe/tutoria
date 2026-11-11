import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { AttemptStatus } from '../../data/attempt';
import { DataError } from '../../data/data-error';
import type { AssignedExercise, AssignedGroup, ClassBlock } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { SEED } from '../../data/mock/fixtures/seed';
import type { HintLevel } from '../../data/tutor';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { CatalogPage } from './catalog-page';

const DAW: AssignedGroup = { id: 'daw', name: '1.º DAW A', subject: SEED.subjects[0] };
const WEB: AssignedGroup = { id: 'web', name: '1.º DAW A', subject: SEED.subjects[2] };

function block(position: number, title: string, group = DAW): ClassBlock {
  return {
    id: `${group.id}-${position}`,
    groupId: group.id,
    position,
    title,
    sourceLocale: 'es',
    translations: { en: { title: `Topic ${position}` } },
    isHidden: false,
  };
}

const BLOCKS: Record<number, ClassBlock> = {
  1: block(1, 'Tema 1: Bucles y condicionales'),
  2: block(2, 'Tema 2: Vectores'),
  3: block(3, 'Recuperación del tema 2'),
};

function entry(
  index: number,
  blockPosition: number,
  status: AttemptStatus,
  {
    hintCount = 0,
    hintLevel = null as HintLevel | null,
    updatedAt = null as string | null,
    group = DAW,
  } = {},
): AssignedExercise {
  return {
    exercise: SEED.exercises[index],
    assignmentId: `assignment-${group.id}-${index}`,
    group,
    block: group === DAW ? BLOCKS[blockPosition] : block(blockPosition, 'Tema 1: Formularios', WEB),
    updatedAt,
    status,
    hintCount,
    hintLevel,
    practice: null,
    repetitions: 0,
  };
}

const ENTRIES = [
  entry(0, 1, 'submitted', { updatedAt: '2026-10-06T08:20:00.000Z' }),
  entry(1, 1, 'submitted', { hintCount: 1, hintLevel: 1, updatedAt: '2026-10-06T08:40:00.000Z' }),
  entry(2, 2, 'in_progress', { hintCount: 2, hintLevel: 3, updatedAt: '2026-10-13T08:20:00.000Z' }),
  entry(3, 2, 'passed', { updatedAt: '2026-10-13T08:50:00.000Z' }),
  entry(4, 3, 'not_started'),
];

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function blockToggle(position: number): HTMLElement {
  const title = BLOCKS[position].title;
  return screen.getByRole('button', { name: new RegExp(`^${title} `) });
}

/** Unfolds a block, as the complete ones start folded. */
async function unfold(position: number): Promise<void> {
  await userEvent.setup().click(blockToggle(position));
}

function cardOf(title: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement;
}

/** The region of the page labelled by the heading with that name. */
function regionOf(name: string | RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

describe('CatalogPage', () => {
  function renderWith(listAssigned: ExerciseService['listAssigned'], locale = 'es') {
    return render(CatalogPage, {
      providers: [
        provideSessionOf('student'),
        provideRouter([]),
        { provide: ExerciseService, useValue: { listAssigned } },
        { provide: LOCALE_ID, useValue: locale },
      ],
    });
  }

  async function renderLoaded(listAssigned: ExerciseService['listAssigned'], locale = 'es') {
    const result = await renderWith(listAssigned, locale);
    await restoreSession();
    await result.fixture.whenStable();
    return result;
  }

  it("lists the student's exercises by block, with their titles and progress", async () => {
    const listAssigned = vi.fn(() => Promise.resolve(ENTRIES));
    await renderLoaded(listAssigned);

    expect(listAssigned).toHaveBeenCalledWith('student-1');
    expect(screen.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeTruthy();
    expect(screen.getByText('Hola, Usuario.')).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Ejercicios superados' });
    expect(progress.getAttribute('aria-valuenow')).toBe('60');
    expect(screen.getByRole('region', { name: '3/5 superados' })).toBeTruthy();

    expect(
      screen.getByRole('heading', { name: 'Tema 1: Bucles y condicionales 2/2 superados' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tema 2: Vectores 1/2 superados' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Recuperación del tema 2 0/1 superados' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tema 2: Vectores' })).toBeTruthy();
    expect(
      within(regionOf(/^Tema 2: Vectores /))
        .getAllByRole('heading', { level: 3 })
        .map(text),
    ).toEqual(['Suma de los elementos de un vector', 'Máximo de un vector']);
    // With a single group there are no tabs
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('counts the exercises by status, ready to submit among them', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));

    const counters = within(screen.getByRole('region', { name: '3/5 superados' }));
    expect(counters.getAllByRole('listitem').map(text)).toEqual([
      'outbox1 listo para entregar',
      'edit1 en curso',
      'task_alt2 entregados',
    ]);
  });

  it('resumes the open attempt changed last', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));

    const next = regionOf('Continúa donde lo dejaste');
    expect(within(next).getByText('Máximo de un vector')).toBeTruthy();
    expect(text(next)).toContain('Tema 2: Vectores · Vectores · comparación · casos límite');
    expect(text(next)).not.toContain('Programación básica');
    const link = within(next).getByRole('link', { name: 'Continuar: Máximo de un vector' });
    expect(link.getAttribute('href')).toBe('/alumno/ejercicio/assignment-daw-3');
  });

  it('suggests the next exercise when none is open', async () => {
    await renderLoaded(() => Promise.resolve([ENTRIES[0], ENTRIES[4]]));

    const next = regionOf('Tu siguiente ejercicio');
    expect(text(next)).toContain('Recuperación del tema 2 · Vectores · índices · intercambio');
    expect(within(next).getByRole('link', { name: 'Empezar: Invertir un vector' })).toBeTruthy();
  });

  it('congratulates the student when everything is submitted', async () => {
    await renderLoaded(() => Promise.resolve([ENTRIES[0], ENTRIES[1]]));

    expect(screen.getByRole('heading', { level: 2, name: '¡Enhorabuena, Usuario!' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Continúa|siguiente/ })).toBeNull();
    expect(blockToggle(1).getAttribute('aria-expanded')).toBe('false');
  });

  it('folds away the blocks with everything submitted at first, and folds or unfolds any of them', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));

    expect(blockToggle(1).getAttribute('aria-expanded')).toBe('false');
    expect(blockToggle(2).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('heading', { level: 3, name: 'Contar números pares' })).toBeNull();

    await unfold(1);
    await userEvent.setup().click(blockToggle(2));

    expect(blockToggle(1).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: 'Contar números pares' })).toBeTruthy();
    expect(blockToggle(2).getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Suma de los elementos de un vector' }),
    ).toBeNull();
    const list = document.getElementById(blockToggle(2).getAttribute('aria-controls') ?? '');
    expect(list?.hidden).toBe(true);
  });

  it('shows the contents, the chips, the hints asked and what is ready to submit', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));
    await unfold(1);

    const card = cardOf('Suma de los elementos de un vector');
    expect(within(card).getByText('Vectores · acumulador · vector vacío')).toBeTruthy();
    expect(within(card).getByText('Media')).toBeTruthy();
    expect(within(card).getByText('En curso')).toBeTruthy();
    expect(within(card).getByText('2 pistas pedidas')).toBeTruthy();
    expect(within(card).getByText('· nivel 3')).toBeTruthy();
    expect(text(card)).not.toContain('Listo para entregar');
    expect(within(cardOf('Tabla de multiplicar')).getByText('1 pista pedida')).toBeTruthy();
    expect(text(cardOf('Contar números pares'))).not.toContain('pista');
    expect(within(cardOf('Máximo de un vector')).getByText('Listo para entregar')).toBeTruthy();
  });

  it('marks each exercise with its number in the block, or a tick once passed', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));

    const markerOf = (title: string) => cardOf(title).querySelector('[aria-hidden="true"]');
    expect(text(markerOf('Suma de los elementos de un vector'))).toBe('1');
    expect(text(markerOf('Máximo de un vector'))).toBe('check');
  });

  it('offers to start, continue or review each exercise, naming it', async () => {
    await renderLoaded(() => Promise.resolve(ENTRIES));
    await unfold(1);

    const links = [...document.querySelectorAll('[id^="block-list-"] a')];
    expect(links.map(text)).toEqual([
      'Repasar: Contar números pares',
      'Repasar: Tabla de multiplicar',
      'Continuar: Suma de los elementos de un vector',
      'Continuar: Máximo de un vector',
      'Empezar: Invertir un vector',
    ]);
    expect(links[4].getAttribute('href')).toBe('/alumno/ejercicio/assignment-daw-4');
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
    expect(screen.getAllByRole('button', { name: /^(Tema|Recuperación) / })).toHaveLength(3);
  });

  it('shows each exercise in the language of the interface, or in its own one without a translation', async () => {
    const untranslated = { ...entry(4, 3, 'not_started'), assignmentId: 'untranslated' };
    const untitled = { ...untranslated.block, translations: {} };
    const entries = [
      ...ENTRIES.slice(2, 4),
      {
        ...untranslated,
        block: untitled,
        exercise: { ...untranslated.exercise, translations: {} },
      },
    ];
    await renderLoaded(() => Promise.resolve(entries), 'en');

    const translated = screen.getByRole('heading', {
      level: 3,
      name: 'Sum of the elements of an array',
    });
    expect(translated.getAttribute('lang')).toBeNull();
    expect(text(translated.closest('li'))).toContain('Arrays · accumulator · empty array');
    // The next exercise: the open attempt that changed last
    expect(text(regionOf(/Continúa donde lo dejaste/))).toContain('Maximum of an array');
    const source = screen.getByRole('heading', { level: 3, name: 'Invertir un vector' });
    expect(source.getAttribute('lang')).toBe('es');
    expect(text(source.closest('li'))).toContain('Vectores · índices · intercambio');
    // The blocks too: translated, or in their own language
    // (unit tests keep the Spanish texts of the interface)
    expect(screen.getByRole('heading', { name: 'Topic 2 1/2 superados' })).toBeTruthy();
    const block = screen.getByText('Recuperación del tema 2', { selector: '[lang]' });
    expect(block.getAttribute('lang')).toBe('es');
  });

  it('counts how many times the student practised an exercise again and continues the open practice', async () => {
    const practised: AssignedExercise = {
      ...ENTRIES[0],
      practice: {
        number: 3,
        status: 'in_progress',
        updatedAt: '2026-11-02T17:00:00.000Z',
        hintCount: 0,
        hintLevel: null,
      },
      repetitions: 2,
    };
    await renderLoaded(() => Promise.resolve([practised, ENTRIES[1]]));
    await unfold(1);

    const card = cardOf('Contar números pares');
    expect(within(card).getByText('Repetido 2 veces')).toBeTruthy();
    expect(within(card).getByText('Entregado')).toBeTruthy();
    expect(
      within(card).getByRole('link', { name: 'Continuar: Contar números pares' }),
    ).toBeTruthy();
    expect(text(cardOf('Tabla de multiplicar'))).not.toContain('Repetido');
    expect(text(regionOf('Continúa donde lo dejaste'))).toContain('Contar números pares');
  });

  describe('with several groups', () => {
    const WEB_ENTRIES = [
      entry(8, 1, 'submitted', { group: WEB, updatedAt: '2026-10-29T11:20:00.000Z' }),
      entry(9, 1, 'not_started', { group: WEB }),
    ];

    it('shows a tab per group with the name of its subject, the first one at first', async () => {
      await renderLoaded(() => Promise.resolve([...ENTRIES, ...WEB_ENTRIES]));

      const tabs = within(screen.getByRole('tablist', { name: 'Asignaturas' }))
        .getAllByRole('tab')
        .map(text);
      expect(tabs).toEqual(['Programación básica', 'Desarrollo web en entorno cliente']);
      expect(
        screen.getByRole('tab', { name: 'Programación básica' }).getAttribute('aria-selected'),
      ).toBe('true');
      // The summary counts the group of the tab; the next exercise looks at all of them
      expect(screen.getByRole('region', { name: '3/5 superados' })).toBeTruthy();
      expect(text(regionOf('Continúa donde lo dejaste'))).toContain(
        'Programación básica · Tema 2: Vectores',
      );
    });

    it('links each tab to its group in the URL and shows the group asked for', async () => {
      const { fixture } = await renderLoaded(() => Promise.resolve([...ENTRIES, ...WEB_ENTRIES]));
      const tab = screen.getByRole('tab', { name: 'Desarrollo web en entorno cliente' });

      expect(tab.getAttribute('href')).toBe('/?grupo=web');
      await userEvent.setup().click(tab);
      await fixture.whenStable();

      expect(screen.getByRole('region', { name: '1/2 superados' })).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: 'Tema 1: Formularios 1/2 superados' }),
      ).toBeTruthy();
      expect(screen.queryByRole('heading', { name: /^Tema 2: Vectores/ })).toBeNull();
    });

    it('adds the group to the tab of a subject repeated in two groups', async () => {
      const dam: AssignedGroup = { ...DAW, id: 'dam', name: '1.º DAM B' };
      await renderLoaded(() =>
        Promise.resolve([ENTRIES[0], { ...ENTRIES[1], group: dam, assignmentId: 'dam-1' }]),
      );

      expect(screen.getByRole('tab', { name: 'Programación básica · 1.º DAW A' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Programación básica · 1.º DAM B' })).toBeTruthy();
    });
  });
});
