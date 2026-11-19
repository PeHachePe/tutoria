import { schoolYearShiftDays, shiftDate } from './school-year-shift';

describe('schoolYearShiftDays', () => {
  it('moves a year later by 52 weeks, so the weekday is kept', () => {
    expect(schoolYearShiftDays('2026/27', '2027/28')).toBe(364);
  });

  it('does not move within the same year', () => {
    expect(schoolYearShiftDays('2026/27', '2026/27')).toBe(0);
  });

  it('moves backwards too', () => {
    expect(schoolYearShiftDays('2026/27', '2024/25')).toBe(-728);
  });
});

describe('shiftDate', () => {
  it('keeps the weekday and the local time a year later', () => {
    // Friday 06/11/2026 23:59 in Madrid
    const moved = new Date(shiftDate('2026-11-06T22:59:00.000Z', 364) ?? '');

    expect([moved.getDay(), moved.getDate(), moved.getMonth(), moved.getHours()]).toEqual([
      5, 5, 10, 23,
    ]);
  });

  it('keeps the local time across a change of time', () => {
    // Wednesday 28/10/2026 23:59 (winter) is Wednesday 27/10/2027 23:59 (summer)
    expect(shiftDate('2026-10-28T22:59:00.000Z', 364)).toBe('2027-10-27T21:59:00.000Z');
  });

  it('gives no date without days or without a date', () => {
    expect(shiftDate('2026-11-06T22:59:00.000Z', null)).toBeNull();
    expect(shiftDate(null, 364)).toBeNull();
  });
});
