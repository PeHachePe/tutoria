import { SCHOOL_YEAR_PATTERN } from '../../data/group-service';
import { schoolYearOf } from './school-year';

describe('schoolYearOf', () => {
  it('is still the previous year on 31 August', () => {
    expect(schoolYearOf(new Date(2027, 7, 31))).toBe('2026/27');
  });

  it('starts the new year on 1 September', () => {
    expect(schoolYearOf(new Date(2026, 8, 1))).toBe('2026/27');
  });

  it('pads the suffix at the turn of the century', () => {
    expect(schoolYearOf(new Date(2099, 9, 1))).toBe('2099/00');
    expect(schoolYearOf(new Date(2008, 9, 1))).toBe('2008/09');
  });

  it('matches the pattern of the database', () => {
    expect(schoolYearOf(new Date(2026, 10, 19))).toMatch(SCHOOL_YEAR_PATTERN);
  });
});
