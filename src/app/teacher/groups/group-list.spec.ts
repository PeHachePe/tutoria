import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { GROUPS } from '../../data/mock/fixtures/users';
import { labelGroups, sortGroups } from './group-list';

const [basic, , web] = SUBJECTS;

function managed(id: string, name: string, schoolYear: string, subject = basic): ManagedGroup {
  return {
    group: { ...GROUPS[0], id, name, schoolYear, subjectId: subject.id },
    subject,
    teacherName: 'Marta',
    studentCount: 0,
    started: false,
  };
}

const OLD = managed('old', '1.º DAW A', '2025/26');
const WEB = managed('web', '1.º DAW A', '2026/27', web);
const BASIC = managed('basic', '1.º DAW A', '2026/27');
const DAM = managed('dam', '1.º DAM B', '2026/27');

describe('sortGroups', () => {
  it('puts the current year first, then by name and by subject', () => {
    expect(sortGroups([OLD, WEB, BASIC, DAM], 'es').map(({ group }) => group.id)).toEqual([
      'dam',
      'web',
      'basic',
      'old',
    ]);
  });

  it('orders the subjects as the interface names them', () => {
    // In Spanish «Desarrollo web…» goes before «Programación básica»; in English, after
    expect(sortGroups([WEB, BASIC], 'en').map(({ group }) => group.id)).toEqual(['basic', 'web']);
  });
});

describe('labelGroups', () => {
  it('names a group by its name and subject, with its year only when they repeat', () => {
    expect(labelGroups([DAM, BASIC, OLD], 'es').map(({ label }) => label)).toEqual([
      '1.º DAM B · Programación básica',
      '1.º DAW A · Programación básica · 2026/27',
      '1.º DAW A · Programación básica · 2025/26',
    ]);
  });
});
