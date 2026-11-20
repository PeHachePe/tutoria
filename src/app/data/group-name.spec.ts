import { compareGroups, groupName, groupTitle, type OrderedGroup } from './group-name';

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

describe('compareGroups', () => {
  function group(
    name: string,
    subject: string,
    schoolYear = '2026/27',
    label: string | null = null,
  ): OrderedGroup {
    return { name, label, schoolYear, subject: { name: subject } };
  }

  it('puts the most recent year first, then by class, subject and the whole class before its splits', () => {
    const groups = [
      group('1.º DAM B', 'Bases de datos', '2021/22'),
      group('1.º DAW A', 'Programación básica', '2026/27', 'Desdoble inglés'),
      group('1.º DAW A', 'Programación básica'),
      group('1.º DAW A', 'Desarrollo web en entorno cliente'),
      group('1.º DAM B', 'Programación básica'),
    ];
    expect(
      [...groups]
        .sort(compareGroups)
        .map(({ name, subject, schoolYear, label }) =>
          [name, subject.name, schoolYear, label].join(' / '),
        ),
    ).toEqual([
      '1.º DAM B / Programación básica / 2026/27 / ',
      '1.º DAW A / Desarrollo web en entorno cliente / 2026/27 / ',
      '1.º DAW A / Programación básica / 2026/27 / ',
      '1.º DAW A / Programación básica / 2026/27 / Desdoble inglés',
      '1.º DAM B / Bases de datos / 2021/22 / ',
    ]);
    expect(compareGroups(groups[1], groups[2])).toBeGreaterThan(0);
    expect(compareGroups(groups[2], groups[1])).toBeLessThan(0);
  });
});
