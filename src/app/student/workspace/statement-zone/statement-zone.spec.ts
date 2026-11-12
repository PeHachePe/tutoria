import { LOCALE_ID } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import type { ExerciseDetail } from '../../../data/exercise';
import { SEED } from '../../../data/mock/fixtures/seed';
import type { Pointer } from '../tutor-store';
import { StatementZone } from './statement-zone';

const EXERCISE = SEED.exercises[2];

const DETAIL: ExerciseDetail = {
  exercise: EXERCISE,
  assignmentId: SEED.assignments[2].id,
  group: { id: SEED.groups[0].id, name: SEED.groups[0].name, subject: SEED.subjects[0] },
  block: SEED.classBlocks[1],
  visibleTests: SEED.tests.filter((test) => test.exerciseId === EXERCISE.id && !test.isHidden),
  hiddenTestCount: 2,
};

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

// The workspace page tests the zone with its exercise (workspace-page.spec.ts); this covers it alone.
describe('StatementZone', () => {
  // Inside a template: as the root of the test, the id the zone gives its host would replace the
  // one TestBed uses to remove it afterwards, and it would stay in the page for the next tests
  function renderZone(detail: ExerciseDetail | undefined, locale = 'es') {
    return render('<app-statement-zone [detail]="detail" />', {
      imports: [StatementZone],
      componentProperties: { detail },
      providers: [{ provide: LOCALE_ID, useValue: locale }],
    });
  }

  it('shows only its heading while there is no exercise', async () => {
    await renderZone(undefined);

    expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the statement in the language of the interface, with the same code', async () => {
    await renderZone(DETAIL, 'en');

    const zone = screen.getByRole('region', { name: 'Enunciado' });
    expect(text(zone)).toContain('Write a function sum that takes an array of integers');
    expect(text(zone)).toContain('sum([1, 2, 3])');
    expect(text(zone)).not.toContain('solo está en');
  });

  it('shows the source statement with a note when there is no translation', async () => {
    const exercise = { ...EXERCISE, translations: {} };
    await renderZone({ ...DETAIL, exercise }, 'en');

    const zone = screen.getByRole('region', { name: 'Enunciado' });
    expect(text(zone)).toContain('Este enunciado solo está en español.');
    const statement = screen.getByText(/que reciba un vector de números enteros/);
    expect(statement.closest('[lang]')?.getAttribute('lang')).toBe('es');
  });

  it('makes the example or the hidden checks the tutor points at stand out, and shows them (2.5e)', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = await render(
      '<app-statement-zone [detail]="detail" [pointer]="pointer" />',
      {
        imports: [StatementZone],
        componentProperties: {
          detail: DETAIL,
          pointer: { target: 'example', example: 2, id: 'p1' } as Pointer | null,
        },
      },
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[1].hasAttribute('data-pointed')).toBe(true);
    expect(rows[0].hasAttribute('data-pointed')).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    await rerender({
      componentProperties: { detail: DETAIL, pointer: { target: 'hiddenTests', id: 'p2' } },
    });
    expect(
      screen
        .getByText(/comprobaciones ocultas/)
        .closest('p')
        ?.hasAttribute('data-pointed'),
    ).toBe(true);

    scrollIntoView.mockClear();
    await rerender({ componentProperties: { detail: DETAIL, pointer: null } });
    expect(scrollIntoView).not.toHaveBeenCalled();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });
});
