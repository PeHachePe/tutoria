import { SCHOOL_YEAR_PATTERN } from './group-service';
import {
  isOpenClass,
  isPastSchoolYear,
  isSchoolYear,
  nextSchoolYear,
  schoolYearChoices,
  schoolYearOf,
  shiftSchoolYear,
} from './school-year';

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

describe('isPastSchoolYear', () => {
  it('is a year before the current one, which changes on 1 September', () => {
    const lastDayOf2025 = new Date(2026, 7, 31);
    const firstDayOf2026 = new Date(2026, 8, 1);

    expect(isPastSchoolYear('2025/26', lastDayOf2025)).toBe(false);
    expect(isPastSchoolYear('2025/26', firstDayOf2026)).toBe(true);
    expect(isPastSchoolYear('2026/27', firstDayOf2026)).toBe(false);
    expect(isPastSchoolYear('2027/28', firstDayOf2026)).toBe(false);
  });
});

describe('isOpenClass', () => {
  const today = new Date(2026, 10, 21);

  it('is open of this year or a later one, and closed of a past one (5.2e)', () => {
    expect(isOpenClass({ schoolYear: '2026/27', reopened: false }, today)).toBe(true);
    expect(isOpenClass({ schoolYear: '2027/28', reopened: false }, today)).toBe(true);
    expect(isOpenClass({ schoolYear: '2025/26', reopened: false }, today)).toBe(false);
  });

  it('is open of a past year once the administration reopens it', () => {
    expect(isOpenClass({ schoolYear: '2025/26', reopened: true }, today)).toBe(true);
  });
});

describe('isSchoolYear', () => {
  it('takes two years in a row, also across the century', () => {
    expect(isSchoolYear('2026/27')).toBe(true);
    expect(isSchoolYear('2099/00')).toBe(true);
  });

  it('refuses another shape or years apart', () => {
    expect(isSchoolYear('2026-27')).toBe(false);
    expect(isSchoolYear('2026/99')).toBe(false);
  });
});

describe('shiftSchoolYear and schoolYearChoices', () => {
  it('moves a year forward or back, across a century', () => {
    expect(shiftSchoolYear('2026/27', 1)).toBe('2027/28');
    expect(shiftSchoolYear('2026/27', -1)).toBe('2025/26');
    expect(shiftSchoolYear('2099/00', 1)).toBe('2100/01');
  });

  it('offers the year before, the one given and the one after', () => {
    expect(schoolYearChoices('2026/27')).toEqual(['2025/26', '2026/27', '2027/28']);
  });
});

describe('nextSchoolYear', () => {
  it('is the year after that of the group', () => {
    expect(nextSchoolYear('2026/27', new Date(2026, 10, 19))).toBe('2027/28');
    expect(nextSchoolYear('2099/00', new Date(2099, 10, 19))).toBe('2100/01');
  });

  it('or the current one, if the group is older', () => {
    expect(nextSchoolYear('2024/25', new Date(2026, 10, 19))).toBe('2026/27');
  });
});
