import { activityAge } from './activity-age';
import { ago, NOW } from './live-testing';

describe('activityAge', () => {
  it('says nothing without activity', () => {
    expect(activityAge(null, NOW)).toEqual({ kind: 'none' });
  });

  it('says now within the first minute, also for a clock a little behind', () => {
    expect(activityAge(NOW - 59_000, NOW)).toEqual({ kind: 'now' });
    expect(activityAge(NOW + 5000, NOW)).toEqual({ kind: 'now' });
  });

  it('counts the minutes within the hour', () => {
    expect(activityAge(ago(59), NOW)).toEqual({ kind: 'minutes', minutes: 59 });
  });

  it('gives the date from an hour on', () => {
    expect(activityAge(ago(60), NOW)).toEqual({ kind: 'date', at: ago(60) });
  });
});
