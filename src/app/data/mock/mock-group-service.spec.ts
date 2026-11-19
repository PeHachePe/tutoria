import { TestBed } from '@angular/core/testing';

import {
  type GroupDraft,
  MAX_ENROLLMENT_BATCH,
  MAX_STUDENT_SEARCH_RESULTS,
} from '../group-service';
import { SEED } from './fixtures/seed';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAM_STUDENT_IDS,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DISABLED_STUDENT_ID,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockDb } from './mock-db';
import { MockGroupService } from './mock-group-service';
import { MockNetwork } from './mock-network';

const SUBJECT_ID = SEED.subjects[0].id;

const DRAFT: GroupDraft = {
  name: '  Taller de algoritmos ',
  schoolYear: '2026/27',
  teacherId: TEACHER_ID,
  subjectId: SUBJECT_ID,
};

/** Elena, a student of 1.º DAM B who is not in 1.º DAW A. */
const ELENA_ID = DAM_STUDENT_IDS[0];

describe('MockGroupService', () => {
  let service: MockGroupService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockGroupService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockGroupService);
    db.setSession(TEACHER_ID);
  });

  afterEach(() => localStorage.clear());

  describe('listGroups', () => {
    it('lists the groups of the teacher by name and subject, with teacher, students and whether started', async () => {
      const groups = await service.listGroups();

      expect(
        groups.map((row) => [row.group.name, row.subject.name, row.teacherName, row.started]),
      ).toEqual([
        [
          '1.º DAW A',
          'Desarrollo web en entorno cliente',
          'Marta Ibáñez Soler',
          expect.any(Boolean),
        ],
        ['1.º DAW A', 'Programación básica', 'Marta Ibáñez Soler', true],
      ]);
      const daw = groups.find((row) => row.group.id === DAW_GROUP_ID);
      expect(daw?.studentCount).toBe(
        SEED.enrollments.filter((enrollment) => enrollment.groupId === DAW_GROUP_ID).length,
      );
    });

    it('lists every group to the administrator, and none to a student', async () => {
      db.setSession(ADMIN_ID);
      await expect(service.listGroups()).resolves.toHaveLength(SEED.groups.length);

      db.setSession(DAW_STUDENT_IDS[0]);
      await expect(service.listGroups()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('saveGroup', () => {
    it('creates a group of the teacher, with the name trimmed and nobody in it', async () => {
      const saved = await service.saveGroup(DRAFT);

      expect(saved).toMatchObject({
        group: { name: 'Taller de algoritmos', teacherId: TEACHER_ID },
        studentCount: 0,
        started: false,
      });
      expect(db.tables().groups).toContainEqual(saved.group);
    });

    it('does not let a teacher create or hand over a group for another', async () => {
      await expect(
        service.saveGroup({ ...DRAFT, teacherId: OTHER_TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      const daw = SEED.groups.find((group) => group.id === DAW_GROUP_ID);
      await expect(
        service.saveGroup({ ...daw!, teacherId: OTHER_TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('does not change a group of another teacher', async () => {
      const dam = SEED.groups.find((group) => group.id === DAM_GROUP_ID)!;
      await expect(service.saveGroup({ ...dam, teacherId: TEACHER_ID })).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('changes the name and year but keeps the subject', async () => {
      const daw = SEED.groups.find((group) => group.id === DAW_GROUP_ID)!;
      const other = SEED.subjects.find((subject) => subject.id !== daw.subjectId)!;

      const saved = await service.saveGroup({
        ...daw,
        name: 'DAW mañana',
        schoolYear: '2027/28',
        subjectId: other.id,
      });

      expect(saved.group).toEqual({ ...daw, name: 'DAW mañana', schoolYear: '2027/28' });
    });

    it.each([
      ['an empty name', { name: '  ' }],
      ['a year not like 2026/27', { schoolYear: '2026' }],
      ['an unknown subject', { subjectId: 'nope' }],
    ])('rejects %s', async (_, changes) => {
      await expect(service.saveGroup({ ...DRAFT, ...changes })).rejects.toMatchObject({
        kind: 'invalid',
      });
    });

    it('lets the administrator change the teacher, only for an active teacher', async () => {
      db.setSession(ADMIN_ID);
      const dam = SEED.groups.find((group) => group.id === DAM_GROUP_ID)!;

      await expect(service.saveGroup({ ...dam, teacherId: TEACHER_ID })).resolves.toMatchObject({
        teacherName: 'Marta Ibáñez Soler',
      });
      for (const teacherId of [ADMIN_ID, DAW_STUDENT_IDS[0], 'nope']) {
        await expect(service.saveGroup({ ...dam, teacherId })).rejects.toMatchObject({
          kind: 'invalid',
        });
      }
      db.update('users', (users) =>
        users.map((user) =>
          user.id === OTHER_TEACHER_ID ? { ...user, status: 'disabled' } : user,
        ),
      );
      await expect(
        service.saveGroup({ ...dam, teacherId: OTHER_TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('removeGroup', () => {
    it('removes a group nobody started, with its enrollments, blocks and assignments', async () => {
      const { group } = await service.saveGroup(DRAFT);
      await service.enroll(group.id, [ELENA_ID]);

      await service.removeGroup(group.id);

      const tables = db.tables();
      expect(tables.groups.some((row) => row.id === group.id)).toBe(false);
      expect(tables.enrollments.some((row) => row.groupId === group.id)).toBe(false);
    });

    it('takes the blocks and assignments of the group', async () => {
      const { group } = await service.saveGroup(DRAFT);
      const block = { ...SEED.classBlocks[0], id: 'b', groupId: group.id };
      const assignment = { ...SEED.assignments[0], id: 'a', groupId: group.id, blockId: 'b' };
      db.update('classBlocks', (rows) => [...rows, block]);
      db.update('assignments', (rows) => [...rows, assignment]);

      await service.removeGroup(group.id);

      expect(db.tables().classBlocks).not.toContainEqual(block);
      expect(db.tables().assignments).not.toContainEqual(assignment);
    });

    it('keeps a started group, and one of another teacher is not found', async () => {
      await expect(service.removeGroup(DAW_GROUP_ID)).rejects.toMatchObject({ kind: 'invalid' });
      await expect(service.removeGroup(DAM_GROUP_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('students', () => {
    it('lists the students of the group by name', async () => {
      const students = await service.listStudents(DAW_GROUP_ID);
      const names = students.map((row) => row.student.name);

      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
      expect(students).toHaveLength(
        SEED.enrollments.filter((enrollment) => enrollment.groupId === DAW_GROUP_ID).length,
      );
      await expect(service.listStudents(DAM_GROUP_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('finds active students of the whole school who are not in the group, without accents or capitals', async () => {
      await expect(service.searchStudents(DAW_GROUP_ID, ' VÁZQ ')).resolves.toEqual([
        { id: ELENA_ID, name: 'Elena Vázquez Lorenzo', email: 'elena.vazquez@tutoria.test' },
      ]);
      await expect(service.searchStudents(DAW_GROUP_ID, 'raúl')).resolves.toEqual([]);
      await expect(service.searchStudents(DAW_GROUP_ID, 'marta')).resolves.toEqual([]);
      await expect(service.searchStudents(DAW_GROUP_ID, 'lucía')).resolves.toEqual([]);
    });

    it('finds none with a short search, and twenty at most by name', async () => {
      await expect(service.searchStudents(DAW_GROUP_ID, ' a ')).resolves.toEqual([]);

      const { group } = await service.saveGroup(DRAFT);
      const found = await service.searchStudents(group.id, 'tutoria');
      expect(found).toHaveLength(MAX_STUDENT_SEARCH_RESULTS);
      const names = found.map((row) => row.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    });

    it('does not search for a group of another teacher', async () => {
      await expect(service.searchStudents(DAM_GROUP_ID, 'elena')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('enrolls several students at once', async () => {
      const { group } = await service.saveGroup(DRAFT);

      const enrolled = await service.enroll(group.id, [ELENA_ID, DAW_STUDENT_IDS[0]]);

      expect(enrolled.map((row) => row.student.id)).toEqual([ELENA_ID, DAW_STUDENT_IDS[0]]);
      await expect(service.listStudents(group.id)).resolves.toHaveLength(2);
    });

    it.each([
      ['a teacher', [OTHER_TEACHER_ID]],
      ['a disabled student', [DISABLED_STUDENT_ID]],
      ['somebody already in the group', [DAW_STUDENT_IDS[0]]],
      ['the same student twice', [ELENA_ID, ELENA_ID]],
      ['nobody', []],
      ['too many at once', Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, () => ELENA_ID)],
    ])('does not enroll %s', async (_, userIds) => {
      await expect(service.enroll(DAW_GROUP_ID, userIds)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expect(db.tables().enrollments).toEqual(SEED.enrollments);
    });

    it('does not enroll in a group of another teacher', async () => {
      await expect(service.enroll(DAM_GROUP_ID, [DAW_STUDENT_IDS[0]])).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('unenrolls a student and keeps their attempts', async () => {
      const lucia = SEED.enrollments.find(
        (row) => row.groupId === DAW_GROUP_ID && row.userId === DAW_STUDENT_IDS[0],
      )!;
      const attempts = db.tables().attempts.filter((row) => row.userId === lucia.userId);

      await service.unenroll(lucia.id);

      expect(db.tables().enrollments).not.toContainEqual(lucia);
      expect(db.tables().attempts.filter((row) => row.userId === lucia.userId)).toEqual(attempts);
    });

    it('does not unenroll from a group of another teacher', async () => {
      const elena = SEED.enrollments.find((row) => row.userId === ELENA_ID)!;
      await expect(service.unenroll(elena.id)).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('listTeachers', () => {
    it('lists the active teachers by name to the administrator', async () => {
      db.setSession(ADMIN_ID);

      await expect(service.listTeachers()).resolves.toEqual([
        { id: OTHER_TEACHER_ID, name: 'Javier Ortega Ruiz', email: 'javier.ortega@tutoria.test' },
        { id: TEACHER_ID, name: 'Marta Ibáñez Soler', email: 'marta.ibanez@tutoria.test' },
      ]);
    });

    it('lists only themselves to a teacher, and is forbidden to a student', async () => {
      await expect(service.listTeachers()).resolves.toEqual([
        expect.objectContaining({ id: TEACHER_ID }),
      ]);
      db.setSession(DAW_STUDENT_IDS[0]);
      await expect(service.listTeachers()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });
});
