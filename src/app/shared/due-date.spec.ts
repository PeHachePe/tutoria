import { DEFAULT_DUE_TIME, dueDistance, withTime } from './due-date';

describe('dueDistance', () => {
  // Local time: the tests run with TZ=Europe/Madrid or any other, so they build local dates
  const now = new Date(2026, 10, 15, 10, 30).getTime();

  it('is today for a due date later or earlier on the same day', () => {
    expect(dueDistance(new Date(2026, 10, 15, 23, 59).toISOString(), now)).toEqual({
      kind: 'today',
      days: 0,
    });
    expect(dueDistance(new Date(2026, 10, 15, 8, 0).toISOString(), now)).toEqual({
      kind: 'today',
      days: 0,
    });
  });

  it('counts calendar days, not 24 hours, to a coming due date', () => {
    expect(dueDistance(new Date(2026, 10, 16, 0, 5).toISOString(), now)).toEqual({
      kind: 'upcoming',
      days: 1,
    });
    expect(dueDistance(new Date(2026, 10, 20, 23, 59).toISOString(), now)).toEqual({
      kind: 'upcoming',
      days: 5,
    });
  });

  it('counts the days since a past due date', () => {
    expect(dueDistance(new Date(2026, 10, 6, 23, 59).toISOString(), now)).toEqual({
      kind: 'past',
      days: 9,
    });
  });

  it('counts a change of daylight saving time as one more day', () => {
    // Europe/Madrid leaves summer time on 25 October 2026
    const before = new Date(2026, 9, 24, 12, 0).getTime();
    expect(dueDistance(new Date(2026, 9, 26, 12, 0).toISOString(), before)).toEqual({
      kind: 'upcoming',
      days: 2,
    });
  });
});

describe('withTime', () => {
  it('puts the time of one date on the day of another', () => {
    const day = new Date(2026, 10, 20);
    const time = new Date(2000, 0, 1, 18, 45, 30);

    expect(withTime(day, time)).toEqual(new Date(2026, 10, 20, 18, 45));
  });

  it('gives the end of the day without a time', () => {
    expect(withTime(new Date(2026, 10, 20, 9, 0), null)).toEqual(
      new Date(2026, 10, 20, DEFAULT_DUE_TIME.hours, DEFAULT_DUE_TIME.minutes),
    );
  });
});
