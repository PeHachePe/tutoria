import { localTimeZone } from './time-zone';

describe('localTimeZone', () => {
  it('is the zone of the browser, Madrid in the tests (D-074)', () => {
    expect(localTimeZone()).toBe('Europe/Madrid');
  });
});
