import type { PreviousClass } from '../data/group-service';
import {
  CLASS_OUTCOMES,
  candidateSections,
  isFinished,
  outcomeCount,
  outcomeLook,
  outcomeSummary,
  previousClassLabel,
  previousClassLine,
} from './class-outcome';

const DAW: PreviousClass = { name: '1.º DAW A', schoolYear: '2025/26', outcome: 'promotes' };

describe('the final evaluation as it shows (5.2g)', () => {
  it('names each outcome, and none, with an icon and the colours of its chip', () => {
    expect([...CLASS_OUTCOMES, null].map((outcome) => outcomeLook(outcome).label)).toEqual([
      'Promociona',
      'Repite',
      'Titula',
      'Baja',
      'Sin evaluar',
    ]);
    for (const outcome of [...CLASS_OUTCOMES, null]) {
      expect(outcomeLook(outcome).icon).not.toBe('');
      expect(outcomeLook(outcome).chip).toMatch(/text-/);
    }
  });

  it('counts each outcome, in singular and plural', () => {
    expect(CLASS_OUTCOMES.map((outcome) => outcomeCount(outcome, 1))).toEqual([
      '1 promociona',
      '1 repite',
      '1 titula',
      '1 baja',
    ]);
    expect(CLASS_OUTCOMES.map((outcome) => outcomeCount(outcome, 3))).toEqual([
      '3 promocionan',
      '3 repiten',
      '3 titulan',
      '3 bajas',
    ]);
  });

  it('sums up how far the evaluation went, with the outcomes somebody has', () => {
    expect(outcomeSummary([null, null])).toBe('Evaluación final: 0 de 2');
    expect(outcomeSummary(['repeats', 'promotes', null, 'promotes'])).toBe(
      'Evaluación final: 3 de 4 · 2 promocionan · 1 repite',
    );
  });

  it('tells who finished the cycle or left the school', () => {
    expect(CLASS_OUTCOMES.filter(isFinished)).toEqual(['graduates', 'leaves']);
    expect(isFinished(null)).toBe(false);
  });

  it('says the last class of a student, with its outcome if it has one', () => {
    expect(previousClassLine(DAW)).toBe('Promociona · 1.º DAW A · 2025/26');
    expect(previousClassLine({ ...DAW, outcome: null })).toBe('1.º DAW A · 2025/26');
  });

  it('heads those who come from the same place', () => {
    expect(previousClassLabel(DAW)).toBe('Promocionan de 1.º DAW A · 2025/26');
    expect(previousClassLabel({ ...DAW, outcome: 'repeats' })).toBe('Repiten 1.º DAW A · 2025/26');
    expect(previousClassLabel({ ...DAW, outcome: null })).toBe(
      'Sin evaluar en 1.º DAW A · 2025/26',
    );
    expect(previousClassLabel(null)).toBe('Sin clase anterior');
  });

  it('groups those without a class by where they come from: the latest year first, and nowhere last', () => {
    const candidate = (name: string, previous: PreviousClass | null) => ({ name, previous });
    const sections = candidateSections([
      candidate('Ana', null),
      candidate('Bea', { ...DAW, name: '2.º DAM B', outcome: 'repeats' }),
      candidate('Carla', DAW),
      candidate('Dani', { ...DAW, schoolYear: '2024/25' }),
      candidate('Elsa', { ...DAW, outcome: 'repeats' }),
      candidate('Fran', { ...DAW, outcome: null }),
      candidate('Gael', DAW),
    ]);

    expect(
      sections.map(({ label, candidates }) => [label, candidates.map(({ name }) => name)]),
    ).toEqual([
      ['Promocionan de 1.º DAW A · 2025/26', ['Carla', 'Gael']],
      ['Sin evaluar en 1.º DAW A · 2025/26', ['Fran']],
      ['Repiten 1.º DAW A · 2025/26', ['Elsa']],
      ['Repiten 2.º DAM B · 2025/26', ['Bea']],
      ['Promocionan de 1.º DAW A · 2024/25', ['Dani']],
      ['Sin clase anterior', ['Ana']],
    ]);
  });
});
