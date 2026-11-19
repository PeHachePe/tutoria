import { datesNote } from './dates-note';

describe('datesNote', () => {
  it('says the dates are the same within the same year', () => {
    expect(datesNote('2026/27', '2026/27')).toBe('Las mismas fechas de apertura y entrega.');
  });

  it('says where they move in another year', () => {
    expect(datesNote('2026/27', '2027/28')).toBe(
      'Las fechas de apertura y entrega pasan a 2027/28, el mismo día de la semana.',
    );
  });

  it('says nothing while the year is wrong', () => {
    expect(datesNote('2026/27', '2027')).toBeNull();
    expect(datesNote('2026/27', '2027/30')).toBeNull();
  });
});
