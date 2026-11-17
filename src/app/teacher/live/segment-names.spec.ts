import type { LiveStudent } from '../../data/live-service';
import { segmentNames } from './segment-names';

const students = (...names: string[]): LiveStudent[] =>
  names.map((name, index) => ({ id: `s${index}`, name }));

describe('segmentNames', () => {
  it('names one student by their first name', () => {
    expect(segmentNames('Con fallos', students('Aya Benali'), 'es')).toBe('Con fallos: Aya');
  });

  it('names every student up to three', () => {
    expect(segmentNames('En curso', students('Aya', 'Hugo Martín', 'Lía'), 'es')).toBe(
      'En curso: Aya, Hugo y Lía',
    );
  });

  it('names two and counts the rest with more', () => {
    expect(
      segmentNames('Con fallos', students('Aya', 'Hugo', 'Lía', 'Max', 'Noa', 'Pau'), 'es'),
    ).toBe('Con fallos: Aya, Hugo y 4 más');
  });

  it('joins them with the conjunction of the language', () => {
    expect(segmentNames('Failing', students('Aya', 'Hugo', 'Lía'), 'en')).toBe(
      'Failing: Aya, Hugo, and Lía',
    );
  });
});
