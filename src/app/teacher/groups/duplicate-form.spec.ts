import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { toDuplicateFormModel, toDuplicateOptions } from './duplicate-form';

const TODAY = new Date(2026, 10, 19);

function managed(index: number): ManagedGroup {
  return {
    group: GROUPS[index],
    subject: SUBJECTS[0],
    teacherName: 'Marta',
    studentCount: 0,
    started: false,
  };
}

const MARTA = { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' };

describe('toDuplicateFormModel', () => {
  it('keeps the name, goes to the next year and takes the whole class with its blocks', () => {
    expect(
      toDuplicateFormModel(managed(0), [managed(0), managed(2)], null, TEACHER_ID, TODAY),
    ).toEqual({
      name: '1.º DAW A',
      schoolYear: '2027/28',
      teacherId: TEACHER_ID,
      groupIds: [GROUPS[0].id, GROUPS[2].id],
      blocks: true,
      dates: true,
      students: false,
    });
  });

  it('offers an administrator the teacher of the group while it is active', () => {
    expect(toDuplicateFormModel(managed(0), [], [MARTA], undefined, TODAY).teacherId).toBe(
      TEACHER_ID,
    );
    const javier = { ...MARTA, id: OTHER_TEACHER_ID };
    expect(toDuplicateFormModel(managed(0), [], [javier], undefined, TODAY).teacherId).toBe('');
  });
});

describe('toDuplicateOptions', () => {
  it('brings no dates without the blocks', () => {
    const model = toDuplicateFormModel(managed(0), [], null, TEACHER_ID, TODAY);
    expect(toDuplicateOptions({ ...model, blocks: false })).toEqual({
      blocks: false,
      dates: false,
      students: false,
    });
    expect(toDuplicateOptions({ ...model, students: true })).toEqual({
      blocks: true,
      dates: true,
      students: true,
    });
  });
});
