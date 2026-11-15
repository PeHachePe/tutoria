import { searchable } from './searchable';

describe('searchable', () => {
  it('drops accents and capitals', () => {
    expect(searchable('Álvaro Núñez')).toBe('alvaro nunez');
  });
});
