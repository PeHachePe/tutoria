import { groupName, groupTitle } from './group-name';

describe('groupName', () => {
  it('is the class of a group of the whole class', () => {
    expect(groupName('1.º DAW A', null)).toBe('1.º DAW A');
  });

  it('adds the label of a split', () => {
    expect(groupName('1.º DAW A', 'Desdoble inglés')).toBe('1.º DAW A · Desdoble inglés');
  });
});

describe('groupTitle', () => {
  it('is the class and the subject', () => {
    expect(groupTitle('1.º DAW A', 'Programación básica', null)).toBe(
      '1.º DAW A · Programación básica',
    );
  });

  it('with the label of a split after the subject', () => {
    expect(groupTitle('1.º DAW A', 'Programación básica', 'Desdoble inglés')).toBe(
      '1.º DAW A · Programación básica · Desdoble inglés',
    );
  });
});
