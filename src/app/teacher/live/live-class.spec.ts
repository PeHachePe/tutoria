import { LOCALE_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { AttemptStatus } from '../../data/attempt';
import type { LiveExercise, LiveStudent } from '../../data/live-service';
import { LiveClass } from './live-class';
import type { ClassStrip } from './class-strip';
import type { ClassOverview, ExerciseOverview } from './live-overview';
import { BLOCK_EXERCISES, GROUP_EXERCISES, GROUPS, STUDENTS } from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const [ana, bea, cai] = STUDENTS;

/** How an exercise goes, with these students in each status. */
function entry(
  exercise: LiveExercise,
  position: number,
  students: Partial<Record<AttemptStatus, readonly LiveStudent[]>>,
  topFailure: ExerciseOverview['topFailure'] = null,
): ExerciseOverview {
  const all = {
    not_started: [],
    in_progress: [],
    tests_failed: [],
    passed: [],
    submitted: [],
    ...students,
  };
  return {
    exercise,
    position,
    students: all,
    total: Object.values(all).flat().length,
    topFailure,
  };
}

interface Options {
  readonly blockId?: string | null;
  readonly inClass?: boolean;
  readonly locale?: string;
}

async function renderClass(overview: ClassOverview, options: Options = {}) {
  const { blockId = 'b1', inClass = true, locale = 'es' } = options;
  const filter = vi.fn();
  const blockChosen = vi.fn();
  const view = await render(LiveClass, {
    inputs: { overview, blocks: GROUPS[0].blocks, blockId, inClass },
    on: { filter, blockChosen },
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: locale }],
  });
  const region = screen.getByRole('region', { name: 'Dónde está la clase' });
  return { view, region, filter, blockChosen };
}

function itemOf(title: RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement;
}

/** The parts of the summary of an exercise, which are buttons. */
function summary(item: HTMLElement): string[] {
  return within(item)
    .getAllByRole('button')
    .filter((button) => button.closest('app-common-failure') === null)
    .map(text);
}

const SIX = [...Array(6).keys()].map((index) => ({ id: `s${index}`, name: `Alumno ${index}` }));

describe('LiveClass', () => {
  it('draws a bar per exercise of the block with the legend and its summary, without zeros', async () => {
    const { region } = await renderClass({
      elsewhere: [],
      exercises: [
        entry(BLOCK_EXERCISES[0], 1, { not_started: [cai], in_progress: [bea], submitted: [ana] }),
        entry(BLOCK_EXERCISES[1], 2, { tests_failed: [ana, bea], passed: [cai] }),
      ],
    });

    expect(text(region.querySelector('ul'))).toBe(
      'En curso Con fallos Superado Entregado Sin empezar',
    );
    expect(text(itemOf(/^1\. /).querySelector('h3'))).toMatch(/^1\. [^·]+$/);
    expect(summary(itemOf(/^1\. /))).toEqual(['1 en curso', '1 entregado', '1 sin empezar']);
    expect(summary(itemOf(/^2\. /))).toEqual(['2 con fallos', '1 superado']);
    expect(itemOf(/^2\. /).querySelectorAll('app-live-bar span')).toHaveLength(2);
  });

  it('says who is in each part and filters the table by them', async () => {
    const { view, filter } = await renderClass({
      elsewhere: [],
      exercises: [entry(BLOCK_EXERCISES[0], 1, { tests_failed: SIX, passed: [ana] })],
    });
    const tooltips = view.fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map((element) => element.injector.get(MatTooltip).message);

    expect(tooltips).toContain('Con fallos: Alumno, Alumno y 4 más');
    expect(tooltips).toContain('Superado: Ana');

    await userEvent.setup().click(screen.getByRole('button', { name: '6 con fallos' }));
    expect(filter).toHaveBeenCalledWith({
      assignmentId: 'as1',
      status: 'tests_failed',
      testId: null,
    });
  });

  it('warns to explain a test to everybody from 3 students, and shows who', async () => {
    const test = BLOCK_EXERCISES[0].tests[0];
    const { filter } = await renderClass({
      elsewhere: [],
      exercises: [
        entry(
          BLOCK_EXERCISES[0],
          1,
          { tests_failed: [ana, bea, cai] },
          {
            test,
            students: [ana, bea, cai],
          },
        ),
        entry(
          BLOCK_EXERCISES[1],
          2,
          { tests_failed: [ana, bea] },
          {
            test: BLOCK_EXERCISES[1].tests[0],
            students: [ana, bea],
          },
        ),
      ],
    });

    expect(text(itemOf(/^1\. /))).toContain('Para explicar a todos');
    expect(text(itemOf(/^1\. /))).toContain('3 alumnos fallan');
    expect(text(itemOf(/^2\. /))).not.toContain('Para explicar a todos');
    expect(text(itemOf(/^2\. /))).not.toContain('La prueba que más se falló');

    await userEvent.setup().click(screen.getByRole('button', { name: /^Ver quiénes fallan/ }));
    expect(filter).toHaveBeenCalledWith({
      assignmentId: 'as1',
      status: 'tests_failed',
      testId: test.id,
    });
  });

  it('gives the test failed most out of class, without the warning', async () => {
    const hidden = BLOCK_EXERCISES[0].tests[4];
    await renderClass(
      {
        elsewhere: [],
        exercises: [
          entry(
            BLOCK_EXERCISES[0],
            1,
            { tests_failed: [ana, bea, cai] },
            {
              test: hidden,
              students: [ana, bea, cai],
            },
          ),
          entry(
            BLOCK_EXERCISES[1],
            2,
            { tests_failed: [ana] },
            {
              test: BLOCK_EXERCISES[1].tests[0],
              students: [ana],
            },
          ),
        ],
      },
      { inClass: false },
    );

    expect(text(itemOf(/^1\. /))).not.toContain('Para explicar a todos');
    expect(text(itemOf(/^1\. /))).toMatch(
      /La prueba que más se falló: \w+\(\[4\]\) · prueba oculta · 3 alumnos/,
    );
    // One student is the queue's business, not a line here
    expect(text(itemOf(/^2\. /))).not.toContain('La prueba que más se falló');
  });

  it('names the block of each exercise with the whole class, under its title, all of them', async () => {
    const exercises = Array.from({ length: 7 }, (_, index) =>
      entry({ ...GROUP_EXERCISES[index % 3], assignmentId: `x${index}` }, index + 1, {
        in_progress: [ana],
      }),
    );
    const { region } = await renderClass({ elsewhere: [], exercises }, { blockId: null });

    expect(text(region.querySelector('ul'))).toBe(
      'En curso Con fallos Superado Entregado Sin empezar',
    );
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(text(screen.getAllByRole('heading', { level: 3 })[2])).toMatch(/ b2$/);
    expect(screen.queryByRole('button', { name: /^Ver / })).toBeNull();
  });

  it('says how many work in other blocks, each one a link that changes the block', async () => {
    const { region, blockChosen } = await renderClass({
      exercises: [entry(BLOCK_EXERCISES[0], 1, { in_progress: [ana] })],
      elsewhere: [
        { blockId: 'b1', students: 1 },
        { blockId: 'b2', students: 3 },
        { blockId: 'gone', students: 1 },
      ],
    });

    expect(text(region)).toContain('4 trabajan en otros bloques: b1 (1) · b2 (3)');
    const link = within(region).getByRole('link', { name: 'b2 (3)' });
    expect(link.getAttribute('href')).toBe('/?bloque=b2');

    await userEvent.setup().click(link);
    expect(blockChosen).toHaveBeenCalledOnce();
  });

  it('says one works in another block in singular, with a dot between blocks', async () => {
    const { region } = await renderClass({
      exercises: [entry(BLOCK_EXERCISES[0], 1, { in_progress: [ana] })],
      elsewhere: [{ blockId: 'b2', students: 1 }],
    });

    expect(text(region)).toContain('1 trabaja en otro bloque: b2 (1)');
  });

  it('says nobody works now, with a link to each block, with the whole class out of class', async () => {
    const { region, blockChosen } = await renderClass(
      { exercises: [], elsewhere: [] },
      { blockId: null, inClass: false },
    );

    const links = within(region).getAllByRole('link');
    expect(links.map(text)).toEqual(['b1', 'b2']);
    expect(links[1].getAttribute('href')).toBe('/?bloque=b2');
    await userEvent.setup().click(links[0]);
    expect(blockChosen).toHaveBeenCalledOnce();
    expect(region.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(text(region)).toContain(
      'Ahora no hay nadie trabajando. Elige un bloque para ver cómo lo lleva el grupo.',
    );
  });

  it('marks the language of the blocks to choose that are not translated', async () => {
    const { region } = await renderClass(
      { exercises: [], elsewhere: [] },
      { blockId: null, inClass: false, locale: 'ca' },
    );

    expect(within(region).getAllByRole('link')[0].querySelector('[lang="es"]')).not.toBeNull();
  });

  it('marks the language of a title that is not translated', async () => {
    const untranslated = {
      ...BLOCK_EXERCISES[0],
      exercise: { ...BLOCK_EXERCISES[0].exercise, translations: {} },
    };
    await renderClass(
      { exercises: [entry(untranslated, 1, { in_progress: [ana] })], elsewhere: [] },
      { locale: 'ca' },
    );

    expect(screen.getByRole('heading', { level: 3 }).querySelector('[lang="es"]')).not.toBeNull();
  });

  describe('with the strip of a block', () => {
    /** Twelve exercises of the block; the strip says who is at each one. */
    const TWELVE = Array.from({ length: 12 }, (_, index) => ({
      ...BLOCK_EXERCISES[0],
      assignmentId: `t${index + 1}`,
    }));
    const column = (
      position: number,
      counts: Partial<ClassStrip['columns'][number]['counts']> = {},
    ) => {
      const full = { in_progress: 0, tests_failed: 0, passed: 0, submitted: 0, ...counts };
      return {
        exercise: TWELVE[position - 1],
        position,
        total: Object.values(full).reduce((sum, count) => sum + count, 0),
        counts: full,
      };
    };
    const overview: ClassOverview = {
      elsewhere: [],
      exercises: TWELVE.map((exercise, index) =>
        entry(exercise, index + 1, { in_progress: [ana] }),
      ),
    };

    function strip(overrides: Partial<ClassStrip> = {}): ClassStrip {
      return {
        columns: TWELVE.map((_, index) =>
          index === 8
            ? column(9, { tests_failed: 4, in_progress: 2 })
            : index === 7
              ? column(8, { in_progress: 3 })
              : index === 1
                ? column(2, { tests_failed: 1 })
                : column(index + 1),
        ),
        bulk: { from: 8, to: 9 },
        outliers: [{ position: 2, side: 'behind', names: ['Hugo'] }],
        ...overrides,
      };
    }

    async function renderStrip(value: ClassStrip, inClass = true) {
      const view = await render(LiveClass, {
        inputs: {
          overview,
          strip: value,
          progress: 31,
          blocks: GROUPS[0].blocks,
          blockId: 'b1',
          inClass,
        },
        providers: [provideRouter([])],
      });
      return { view, region: screen.getByRole('region', { name: 'Dónde está la clase' }) };
    }

    it('says the progress of the block in its header', async () => {
      const { region } = await renderStrip(strip());

      expect(text(region)).toContain('Avance del bloque 31 %');
    });

    it('draws a column per exercise, each segment a share of the tallest column', async () => {
      const { region } = await renderStrip(strip());

      const columns = region.querySelectorAll('.h-16 > div');
      expect(columns).toHaveLength(12);
      const ninth = [...columns[8].querySelectorAll<HTMLElement>('span.block')];
      expect(ninth.map((segment) => segment.style.height)).toEqual([
        '33.33333333333333%',
        '66.66666666666666%',
      ]);
      expect(ninth[1].classList).toContain('bg-chart-fail');
    });

    it('reads where the class is and names who is alone far from it, over their column too', async () => {
      const { region } = await renderStrip(
        strip({
          outliers: [
            { position: 2, side: 'behind', names: ['Hugo'] },
            { position: 12, side: 'ahead', names: ['Ana', 'Lía'] },
          ],
        }),
      );

      expect(text(region)).toContain(
        'La mayoría está entre el ejercicio 8 y el 9 · Hugo sigue en el 2 · Ana y Lía van por el 12',
      );
      expect(text(region.querySelectorAll('.h-16 > div')[1])).toBe('Hugo');
    });

    it('says the bulk in one exercise, and the outliers in singular and plural', async () => {
      const { region } = await renderStrip(
        strip({
          bulk: { from: 9, to: 9 },
          outliers: [
            { position: 1, side: 'behind', names: ['Ana', 'Bea'] },
            { position: 12, side: 'ahead', names: ['Lía'] },
          ],
        }),
      );

      expect(text(region)).toContain(
        'La mayoría está en el ejercicio 9 · Ana y Bea siguen en el 1 · Lía va por el 12',
      );
    });

    it('lists the busiest exercises first, then the rest in order, in the scroll of the card', async () => {
      const { region } = await renderStrip(strip());

      const titles = within(region)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => text(heading).split('.')[0]);
      expect(titles.slice(0, 4)).toEqual(['9', '8', '2', '1']);
      expect(titles).toHaveLength(12);
      expect(region.querySelector('ol')?.classList).toContain('overflow-y-auto');
    });

    it('says nobody works in the block now', async () => {
      const { region } = await renderStrip(strip({ bulk: null, outliers: [] }));

      expect(text(region)).toContain('Ahora nadie trabaja en este bloque.');
    });

    it('says nobody started the block, out of class', async () => {
      const { region } = await renderStrip(strip({ bulk: null, outliers: [] }), false);

      expect(text(region)).toContain('Nadie ha empezado este bloque todavía.');
    });

    it('draws no strip with up to 5 exercises, but keeps its sentence', async () => {
      const few = strip({ columns: strip().columns.slice(0, 5) });
      const { region } = await renderStrip(few);

      expect(region.querySelector('.h-16')).toBeNull();
      expect(text(region)).toContain('La mayoría está entre el ejercicio 8 y el 9');
    });
  });
});
