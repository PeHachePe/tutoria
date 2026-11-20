import { TestBed } from '@angular/core/testing';

import {
  type ClassDraft,
  type DuplicateOptions,
  MAX_ENROLLMENT_BATCH,
  MAX_GROUP_BATCH,
  MAX_GROUP_LABEL_LENGTH,
  MAX_STUDENT_SEARCH_RESULTS,
} from '../group-service';
import { SEED } from './fixtures/seed';
import { ADVANCED_PROGRAMMING_ID, BASIC_PROGRAMMING_ID, WEB_CLIENT_ID } from './fixtures/subjects';
import {
  ADMIN_ID,
  DAM_ADVANCED_GROUP_ID,
  DAM_CLASS_ID,
  DAM_GROUP_ID,
  DAM_STUDENT_IDS,
  DAW_CLASS_ID,
  DAW_ENGLISH_GROUP_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  DISABLED_STUDENT_ID,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockDb } from './mock-db';
import { MockGroupService } from './mock-group-service';
import { MockNetwork } from './mock-network';

/** A class that does not exist yet. */
const NEW_CLASS: ClassDraft = { name: '  2.º DAW A ', schoolYear: '2027/28' };

/** 1.º DAW A, a year later. */
const NEXT_YEAR: ClassDraft = { name: ' 1.º DAW A ', schoolYear: '2027/28' };

const EVERYTHING: DuplicateOptions = { blocks: true, dates: true, students: true };
const NOTHING: DuplicateOptions = { blocks: false, dates: false, students: false };

/** Whole weeks closest to a year: a copy a year later keeps the weekday of each date. */
const DAYS_IN_52_WEEKS = 52 * 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Lucía, a student of 1.º DAW A. */
const LUCIA_ID = DAW_STUDENT_IDS[0];
const HUGO_ID = DAW_STUDENT_IDS[1];
/** Elena and Rubén, students of 1.º DAM B who are not in 1.º DAW A. */
const ELENA_ID = DAM_STUDENT_IDS[0];
const RUBEN_ID = DAM_STUDENT_IDS[1];

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

  const groupsOf = (classId: string) =>
    db.tables().groups.filter((group) => group.classId === classId);
  const groupById = (groupId: string) => db.tables().groups.find((group) => group.id === groupId);
  const classById = (classId: string) =>
    db.tables().classes.find((schoolClass) => schoolClass.id === classId);
  const studentsOf = (groupId: string) =>
    db
      .tables()
      .enrollments.filter((row) => row.groupId === groupId)
      .map((row) => row.userId)
      .sort();
  const membersOf = (classId: string) =>
    db
      .tables()
      .classMembers.filter((row) => row.classId === classId)
      .map((row) => row.userId)
      .sort();
  const sorted = (ids: readonly string[]) => [...ids].sort();

  function disable(userId: string): void {
    db.update('users', (users) =>
      users.map((user) => (user.id === userId ? { ...user, status: 'disabled' } : user)),
    );
  }

  /** Raúl, a disabled student, as a member of the class and a student of its group. */
  function addDisabledStudent(classId: string, groupId: string): void {
    db.update('classMembers', (rows) => [...rows, { classId, userId: DISABLED_STUDENT_ID }]);
    db.update('enrollments', (rows) => [
      ...rows,
      { id: 'raul', groupId, userId: DISABLED_STUDENT_ID },
    ]);
  }

  /** The seed is untouched: what a request that fails must leave. */
  function expectSeed(): void {
    const { classes, classMembers, groups, enrollments, classBlocks, assignments } = db.tables();
    expect({ classes, classMembers, groups, enrollments, classBlocks, assignments }).toEqual({
      classes: SEED.classes,
      classMembers: SEED.classMembers,
      groups: SEED.groups,
      enrollments: SEED.enrollments,
      classBlocks: SEED.classBlocks,
      assignments: SEED.assignments,
    });
  }

  describe('listClasses', () => {
    it('lists the class a teacher created with every group, by subject and label', async () => {
      const classes = await service.listClasses();

      expect(classes.map((row) => [row.schoolClass.id, row.canEdit])).toEqual([
        [DAW_CLASS_ID, true],
      ]);
      expect(
        classes[0].groups.map((row) => [row.group.id, row.teacherName, row.studentCount, row.mine]),
      ).toEqual([
        [DAW_WEB_GROUP_ID, 'Marta Ibáñez Soler', DAW_STUDENT_IDS.length, true],
        [DAW_GROUP_ID, 'Marta Ibáñez Soler', DAW_STUDENT_IDS.length, true],
        [DAW_ENGLISH_GROUP_ID, 'Javier Ortega Ruiz', 0, false],
      ]);
      expect(classes[0].groups.map((row) => row.subject.id)).toEqual([
        WEB_CLIENT_ID,
        BASIC_PROGRAMMING_ID,
        BASIC_PROGRAMMING_ID,
      ]);
    });

    it('tells the groups somebody started', async () => {
      const [daw] = await service.listClasses();

      expect(daw.groups.map((row) => [row.group.id, row.started])).toEqual([
        [DAW_WEB_GROUP_ID, true],
        [DAW_GROUP_ID, true],
        [DAW_ENGLISH_GROUP_ID, false],
      ]);
    });

    it('sorts the groups of one subject by label, the group of the whole class first', async () => {
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      for (const label of ['Desdoble inglés', 'Desdoble alemán', null]) {
        await service.addGroup(classId, {
          subjectId: BASIC_PROGRAMMING_ID,
          label,
          teacherId: TEACHER_ID,
        });
      }

      const [created] = await service.listClasses();

      expect(created.groups.map((row) => row.group.label)).toEqual([
        null,
        'Desdoble alemán',
        'Desdoble inglés',
      ]);
    });

    it('lists to a teacher the classes they teach in, editable only those they created', async () => {
      db.setSession(OTHER_TEACHER_ID);

      const classes = await service.listClasses();

      expect(classes.map((row) => [row.schoolClass.id, row.canEdit])).toEqual([
        [DAM_CLASS_ID, true],
        [DAW_CLASS_ID, false],
      ]);
      expect(classes[1].groups.filter((row) => row.mine).map((row) => row.group.id)).toEqual([
        DAW_ENGLISH_GROUP_ID,
      ]);
    });

    it('lists a class its creator has with no groups yet', async () => {
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);

      const classes = await service.listClasses();

      expect(classes.map((row) => [row.schoolClass.id, row.groups])).toEqual([
        [classId, []],
        [DAW_CLASS_ID, expect.any(Array)],
      ]);
    });

    it('lists every class to the administrator, the most recent year first, all theirs', async () => {
      db.setSession(ADMIN_ID);
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);

      const classes = await service.listClasses();

      expect(classes.map((row) => row.schoolClass.id)).toEqual([
        classId,
        DAM_CLASS_ID,
        DAW_CLASS_ID,
      ]);
      expect(classes.every((row) => row.canEdit)).toBe(true);
      expect(classes.flatMap((row) => row.groups).every((row) => row.mine)).toBe(true);
    });

    it('is forbidden to a student', async () => {
      db.setSession(LUCIA_ID);

      await expect(service.listClasses()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('listAllClasses', () => {
    it('lists every class of the school to a teacher, by year and name', async () => {
      await expect(service.listAllClasses()).resolves.toEqual([
        expect.objectContaining({ id: DAM_CLASS_ID, name: '1.º DAM B' }),
        expect.objectContaining({ id: DAW_CLASS_ID, name: '1.º DAW A' }),
      ]);
    });

    it('is forbidden to a student', async () => {
      db.setSession(LUCIA_ID);

      await expect(service.listAllClasses()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('createClass', () => {
    it('creates a class of the user, with the name trimmed and a group of the teacher in each subject', async () => {
      const classId = await service.createClass(
        NEW_CLASS,
        [WEB_CLIENT_ID, BASIC_PROGRAMMING_ID],
        TEACHER_ID,
      );

      expect(classById(classId)).toEqual({
        id: classId,
        name: '2.º DAW A',
        schoolYear: '2027/28',
        createdBy: TEACHER_ID,
        createdAt: expect.any(String),
      });
      expect(
        groupsOf(classId).map((group) => [group.subjectId, group.label, group.teacherId]),
      ).toEqual([
        [WEB_CLIENT_ID, null, TEACHER_ID],
        [BASIC_PROGRAMMING_ID, null, TEACHER_ID],
      ]);
    });

    it('creates only the class without subjects, whoever the teacher', async () => {
      const classId = await service.createClass(NEW_CLASS, [], OTHER_TEACHER_ID);

      expect(classById(classId)?.createdBy).toBe(TEACHER_ID);
      expect(groupsOf(classId)).toEqual([]);
    });

    it('joins the class with that name and year whatever its capitals, its groups taking its active students', async () => {
      addDisabledStudent(DAM_CLASS_ID, DAM_GROUP_ID);

      const classId = await service.createClass(
        { name: ' 1.º dam b ', schoolYear: '2026/27' },
        [WEB_CLIENT_ID],
        TEACHER_ID,
      );

      expect(classId).toBe(DAM_CLASS_ID);
      expect(db.tables().classes).toHaveLength(SEED.classes.length);
      const [web] = groupsOf(DAM_CLASS_ID).filter((group) => group.subjectId === WEB_CLIENT_ID);
      expect(web.teacherId).toBe(TEACHER_ID);
      expect(studentsOf(web.id)).toEqual(sorted(DAM_STUDENT_IDS));
      const classes = await service.listClasses();
      expect(classes.map((row) => [row.schoolClass.id, row.canEdit])).toEqual([
        [DAM_CLASS_ID, false],
        [DAW_CLASS_ID, true],
      ]);
    });

    it('lets the administrator create groups of another teacher', async () => {
      db.setSession(ADMIN_ID);

      const classId = await service.createClass(NEW_CLASS, [WEB_CLIENT_ID], OTHER_TEACHER_ID);

      expect(classById(classId)?.createdBy).toBe(ADMIN_ID);
      expect(groupsOf(classId).map((group) => group.teacherId)).toEqual([OTHER_TEACHER_ID]);
    });

    it('does not let a teacher create groups of another teacher', async () => {
      await expect(
        service.createClass(NEW_CLASS, [WEB_CLIENT_ID], OTHER_TEACHER_ID),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expectSeed();
    });

    it.each([
      ['a blank name', { name: '   ', schoolYear: '2027/28' }, [WEB_CLIENT_ID], TEACHER_ID],
      ['a year not like 2026/27', { name: '2.º DAW A', schoolYear: '2027' }, [], TEACHER_ID],
      ['a subject twice', NEW_CLASS, [WEB_CLIENT_ID, WEB_CLIENT_ID], TEACHER_ID],
      ['a subject that does not exist', NEW_CLASS, [WEB_CLIENT_ID, 'nope'], TEACHER_ID],
      [
        'more subjects than the maximum',
        NEW_CLASS,
        Array.from({ length: MAX_GROUP_BATCH + 1 }, (_, i) => `subject-${i}`),
        TEACHER_ID,
      ],
      [
        'a subject the class already has',
        { name: '1.º DAW A', schoolYear: '2026/27' },
        [WEB_CLIENT_ID],
        TEACHER_ID,
      ],
    ])('creates nothing with %s', async (_, draft, subjectIds, teacherId) => {
      await expect(service.createClass(draft, subjectIds, teacherId)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expectSeed();
    });

    it.each([
      ['a student', LUCIA_ID],
      ['the administrator', ADMIN_ID],
      ['somebody who does not exist', 'nope'],
    ])('does not make %s the teacher of the groups', async (_, teacherId) => {
      db.setSession(ADMIN_ID);

      await expect(
        service.createClass(NEW_CLASS, [WEB_CLIENT_ID], teacherId),
      ).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it('is forbidden to a student', async () => {
      db.setSession(LUCIA_ID);

      await expect(service.createClass(NEW_CLASS, [], LUCIA_ID)).rejects.toMatchObject({
        kind: 'forbidden',
      });
    });
  });

  describe('saveClass', () => {
    it('lets its creator rename it and change its year, with the name trimmed', async () => {
      await service.saveClass(DAW_CLASS_ID, { name: ' DAW mañana ', schoolYear: '2027/28' });

      expect(classById(DAW_CLASS_ID)).toEqual({
        ...SEED.classes.find((row) => row.id === DAW_CLASS_ID),
        name: 'DAW mañana',
        schoolYear: '2027/28',
      });
    });

    it('lets a class change the capitals of its own name', async () => {
      await service.saveClass(DAW_CLASS_ID, { name: '1.º daw a', schoolYear: '2026/27' });

      expect(classById(DAW_CLASS_ID)?.name).toBe('1.º daw a');
    });

    it('lets the administrator rename any class', async () => {
      db.setSession(ADMIN_ID);

      await service.saveClass(DAM_CLASS_ID, { name: '1.º DAM C', schoolYear: '2026/27' });

      expect(classById(DAM_CLASS_ID)?.name).toBe('1.º DAM C');
    });

    it('does not let another teacher of the class rename it', async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(
        service.saveClass(DAW_CLASS_ID, { name: 'Otra', schoolYear: '2026/27' }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expectSeed();
    });

    it.each([
      ['a blank name', { name: ' ', schoolYear: '2026/27' }],
      ['a year not like 2026/27', { name: '1.º DAW A', schoolYear: '26/27' }],
      [
        'the name and year of another class, whatever its capitals',
        { name: '1.º dam B', schoolYear: '2026/27' },
      ],
    ])('rejects %s', async (_, draft) => {
      await expect(service.saveClass(DAW_CLASS_ID, draft)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expectSeed();
    });

    it('does not find a class that does not exist', async () => {
      await expect(service.saveClass('nope', NEW_CLASS)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('removeClass', () => {
    it('lets its creator remove a class without groups, with its students', async () => {
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      await service.enrollInClass(classId, [ELENA_ID]);

      await service.removeClass(classId);

      expect(classById(classId)).toBeUndefined();
      expect(membersOf(classId)).toEqual([]);
      expectSeed();
    });

    it('lets the administrator remove a class of others without groups', async () => {
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      db.setSession(ADMIN_ID);

      await service.removeClass(classId);

      expect(classById(classId)).toBeUndefined();
    });

    it('keeps a class with groups', async () => {
      await expect(service.removeClass(DAW_CLASS_ID)).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it('keeps a class another teacher created', async () => {
      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.removeClass(classId)).rejects.toMatchObject({ kind: 'invalid' });
      expect(classById(classId)).toBeDefined();
    });

    it('does not find a class that does not exist', async () => {
      await expect(service.removeClass('nope')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('addGroup', () => {
    it('adds a group of the whole class to a class of others, with its active students', async () => {
      addDisabledStudent(DAM_CLASS_ID, DAM_GROUP_ID);

      const groupId = await service.addGroup(DAM_CLASS_ID, {
        subjectId: WEB_CLIENT_ID,
        label: '   ',
        teacherId: TEACHER_ID,
      });

      expect(groupById(groupId)).toEqual({
        id: groupId,
        classId: DAM_CLASS_ID,
        subjectId: WEB_CLIENT_ID,
        label: null,
        teacherId: TEACHER_ID,
      });
      expect(studentsOf(groupId)).toEqual(sorted(DAM_STUDENT_IDS));
    });

    it('adds a split of a subject the class has, with the label trimmed and nobody in it', async () => {
      const groupId = await service.addGroup(DAM_CLASS_ID, {
        subjectId: BASIC_PROGRAMMING_ID,
        label: ' Desdoble francés ',
        teacherId: TEACHER_ID,
      });

      expect(groupById(groupId)?.label).toBe('Desdoble francés');
      expect(studentsOf(groupId)).toEqual([]);
    });

    it('lets the administrator add a group of any teacher', async () => {
      db.setSession(ADMIN_ID);

      const groupId = await service.addGroup(DAW_CLASS_ID, {
        subjectId: ADVANCED_PROGRAMMING_ID,
        label: null,
        teacherId: OTHER_TEACHER_ID,
      });

      expect(groupById(groupId)?.teacherId).toBe(OTHER_TEACHER_ID);
    });

    it('does not let a teacher add a group of another teacher', async () => {
      await expect(
        service.addGroup(DAW_CLASS_ID, {
          subjectId: ADVANCED_PROGRAMMING_ID,
          label: null,
          teacherId: OTHER_TEACHER_ID,
        }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expectSeed();
    });

    it.each([
      ['a subject the class has with the same label', BASIC_PROGRAMMING_ID, ' Desdoble inglés '],
      ['a subject the class has without a label', WEB_CLIENT_ID, null],
      ['a subject that does not exist', 'nope', null],
      ['a label too long', WEB_CLIENT_ID, 'x'.repeat(MAX_GROUP_LABEL_LENGTH + 1)],
    ])('rejects %s', async (_, subjectId, label) => {
      await expect(
        service.addGroup(DAW_CLASS_ID, { subjectId, label, teacherId: TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it('takes a label of the maximum length', async () => {
      const label = 'x'.repeat(MAX_GROUP_LABEL_LENGTH);

      const groupId = await service.addGroup(DAW_CLASS_ID, {
        subjectId: WEB_CLIENT_ID,
        label,
        teacherId: TEACHER_ID,
      });

      expect(groupById(groupId)?.label).toBe(label);
    });

    it('does not make a teacher who is not active the teacher of a group', async () => {
      db.setSession(ADMIN_ID);
      disable(OTHER_TEACHER_ID);

      await expect(
        service.addGroup(DAW_CLASS_ID, {
          subjectId: ADVANCED_PROGRAMMING_ID,
          label: null,
          teacherId: OTHER_TEACHER_ID,
        }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('does not find a class that does not exist', async () => {
      await expect(
        service.addGroup('nope', { subjectId: WEB_CLIENT_ID, label: null, teacherId: TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('saveGroup', () => {
    it('changes the label of a group of the teacher, trimmed, and keeps the rest', async () => {
      await service.saveGroup(DAW_WEB_GROUP_ID, { label: ' Tarde ', teacherId: TEACHER_ID });

      expect(groupById(DAW_WEB_GROUP_ID)).toEqual({
        ...SEED.groups.find((group) => group.id === DAW_WEB_GROUP_ID),
        label: 'Tarde',
      });
    });

    it('takes a blank label as none', async () => {
      await service.saveGroup(DAW_WEB_GROUP_ID, { label: 'Tarde', teacherId: TEACHER_ID });

      await service.saveGroup(DAW_WEB_GROUP_ID, { label: '  ', teacherId: TEACHER_ID });

      expect(groupById(DAW_WEB_GROUP_ID)?.label).toBeNull();
    });

    it('does not let a teacher hand their group over', async () => {
      await expect(
        service.saveGroup(DAW_GROUP_ID, { label: null, teacherId: OTHER_TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expectSeed();
    });

    it('tells a teacher who is not valid before the hand-over, as the trigger runs before the RLS', async () => {
      await expect(
        service.saveGroup(DAW_GROUP_ID, { label: null, teacherId: LUCIA_ID }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it.each([
      ['the label of another group of its subject', 'Desdoble inglés'],
      ['a label too long', 'x'.repeat(MAX_GROUP_LABEL_LENGTH + 1)],
    ])('rejects %s', async (_, label) => {
      await expect(
        service.saveGroup(DAW_GROUP_ID, { label, teacherId: TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it('does not find a group of another teacher, nor one that does not exist', async () => {
      await expect(
        service.saveGroup(DAW_ENGLISH_GROUP_ID, { label: null, teacherId: TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'not_found' });
      await expect(
        service.saveGroup('nope', { label: null, teacherId: TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('lets the administrator change the teacher, only for an active teacher', async () => {
      db.setSession(ADMIN_ID);

      await service.saveGroup(DAM_GROUP_ID, { label: null, teacherId: TEACHER_ID });
      expect(groupById(DAM_GROUP_ID)?.teacherId).toBe(TEACHER_ID);

      for (const teacherId of [ADMIN_ID, LUCIA_ID, 'nope']) {
        await expect(
          service.saveGroup(DAM_GROUP_ID, { label: null, teacherId }),
        ).rejects.toMatchObject({ kind: 'invalid' });
      }
      disable(OTHER_TEACHER_ID);
      await expect(
        service.saveGroup(DAM_GROUP_ID, { label: null, teacherId: OTHER_TEACHER_ID }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('keeps editable a group whose teacher was disabled, until it is handed over', async () => {
      db.setSession(ADMIN_ID);
      disable(OTHER_TEACHER_ID);

      await service.saveGroup(DAM_GROUP_ID, { label: 'Tarde', teacherId: OTHER_TEACHER_ID });

      expect(groupById(DAM_GROUP_ID)).toMatchObject({
        label: 'Tarde',
        teacherId: OTHER_TEACHER_ID,
      });
    });
  });

  describe('removeGroup', () => {
    it('removes a group nobody started, with its enrollments, blocks and assignments', async () => {
      const groupId = await service.addGroup(DAM_CLASS_ID, {
        subjectId: WEB_CLIENT_ID,
        label: null,
        teacherId: TEACHER_ID,
      });
      const block = { ...SEED.classBlocks[0], id: 'b', groupId };
      const assignment = { ...SEED.assignments[0], id: 'a', groupId, blockId: 'b' };
      db.update('classBlocks', (rows) => [...rows, block]);
      db.update('assignments', (rows) => [...rows, assignment]);
      expect(studentsOf(groupId)).not.toEqual([]);

      await service.removeGroup(groupId);

      expectSeed();
    });

    it('keeps a group somebody started', async () => {
      await expect(service.removeGroup(DAW_GROUP_ID)).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it('does not find a group of another teacher', async () => {
      await expect(service.removeGroup(DAW_ENGLISH_GROUP_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });

    it('lets the administrator remove a group of any teacher', async () => {
      db.setSession(ADMIN_ID);

      await service.removeGroup(DAW_ENGLISH_GROUP_ID);

      expect(groupById(DAW_ENGLISH_GROUP_ID)).toBeUndefined();
    });
  });

  describe('duplicateClass', () => {
    const blocksOf = (groupId: string) =>
      db
        .tables()
        .classBlocks.filter((block) => block.groupId === groupId)
        .sort((a, b) => a.position - b.position);
    /** In the order of their blocks, so a copy lines up with its source. */
    const assignmentsOf = (groupId: string) =>
      blocksOf(groupId).flatMap((block) =>
        db
          .tables()
          .assignments.filter((row) => row.blockId === block.id)
          .sort((a, b) => a.position - b.position),
      );

    it('creates the class with a copy of each group, its blocks, its dates in whole weeks and its active students', async () => {
      addDisabledStudent(DAW_CLASS_ID, DAW_GROUP_ID);

      const classId = await service.duplicateClass(
        DAW_CLASS_ID,
        NEXT_YEAR,
        [DAW_GROUP_ID, DAW_WEB_GROUP_ID],
        EVERYTHING,
      );

      expect(classById(classId)).toMatchObject({
        name: '1.º DAW A',
        schoolYear: '2027/28',
        createdBy: TEACHER_ID,
      });
      const [basic, web] = groupsOf(classId);
      expect([basic, web].map((group) => [group.subjectId, group.label, group.teacherId])).toEqual([
        [BASIC_PROGRAMMING_ID, null, TEACHER_ID],
        [WEB_CLIENT_ID, null, TEACHER_ID],
      ]);
      expect(membersOf(classId)).toEqual(sorted(DAW_STUDENT_IDS));
      expect(studentsOf(basic.id)).toEqual(sorted(DAW_STUDENT_IDS));
      expect(studentsOf(web.id)).toEqual(sorted(DAW_STUDENT_IDS));

      const sourceBlocks = blocksOf(DAW_GROUP_ID);
      const copiedBlocks = blocksOf(basic.id);
      expect(copiedBlocks.map((block) => [block.title, block.isHidden])).toEqual(
        sourceBlocks.map((block) => [block.title, block.isHidden]),
      );
      const sourceDates = [
        ...sourceBlocks.map((block) => block.opensAt),
        ...assignmentsOf(DAW_GROUP_ID).map((row) => row.dueAt),
      ];
      const copiedDates = [
        ...copiedBlocks.map((block) => block.opensAt),
        ...assignmentsOf(basic.id).map((row) => row.dueAt),
      ];
      expect(copiedDates).toHaveLength(sourceDates.length);
      expect(sourceDates.some((date) => date !== null)).toBe(true);
      sourceDates.forEach((source, index) => {
        const copy = copiedDates[index];
        if (source === null) {
          expect(copy).toBeNull();
          return;
        }
        const [from, to] = [new Date(source), new Date(copy!)];
        expect(Math.round((to.getTime() - from.getTime()) / DAY_MS)).toBe(DAYS_IN_52_WEEKS);
        expect([to.getDay(), to.getHours(), to.getMinutes()]).toEqual([
          from.getDay(),
          from.getHours(),
          from.getMinutes(),
        ]);
      });
    });

    it('copies a split with its subject, label and teacher, and only its own students', async () => {
      db.setSession(OTHER_TEACHER_ID);
      await service.enroll(DAW_ENGLISH_GROUP_ID, [LUCIA_ID]);

      const classId = await service.duplicateClass(
        DAW_CLASS_ID,
        NEXT_YEAR,
        [DAW_ENGLISH_GROUP_ID],
        EVERYTHING,
      );

      const [english] = groupsOf(classId);
      expect(english).toMatchObject({
        subjectId: BASIC_PROGRAMMING_ID,
        label: 'Desdoble inglés',
        teacherId: OTHER_TEACHER_ID,
      });
      expect(studentsOf(english.id)).toEqual([LUCIA_ID]);
      expect(membersOf(classId)).toEqual(sorted(DAW_STUDENT_IDS));
    });

    it('copies blocks without their dates', async () => {
      const classId = await service.duplicateClass(DAW_CLASS_ID, NEXT_YEAR, [DAW_GROUP_ID], {
        ...NOTHING,
        blocks: true,
      });

      const [copy] = groupsOf(classId);
      expect(blocksOf(copy.id)).toHaveLength(blocksOf(DAW_GROUP_ID).length);
      expect(blocksOf(copy.id).every((block) => block.opensAt === null)).toBe(true);
      expect(assignmentsOf(copy.id)).toHaveLength(assignmentsOf(DAW_GROUP_ID).length);
      expect(assignmentsOf(copy.id).every((row) => row.dueAt === null)).toBe(true);
    });

    it('copies neither blocks nor students unless asked', async () => {
      const classId = await service.duplicateClass(DAW_CLASS_ID, NEXT_YEAR, [DAW_GROUP_ID], {
        ...NOTHING,
        dates: true,
      });

      const [copy] = groupsOf(classId);
      expect(blocksOf(copy.id)).toEqual([]);
      expect(studentsOf(copy.id)).toEqual([]);
      expect(membersOf(classId)).toEqual([]);
    });

    it('joins the class with that name and year whatever its capitals, a group of the whole class taking its students', async () => {
      const targetId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      await service.enrollInClass(targetId, [ELENA_ID]);

      const classId = await service.duplicateClass(
        DAW_CLASS_ID,
        { name: '2.º daw A', schoolYear: NEW_CLASS.schoolYear },
        [DAW_GROUP_ID],
        NOTHING,
      );

      expect(classId).toBe(targetId);
      const [copy] = groupsOf(targetId);
      expect(studentsOf(copy.id)).toEqual([ELENA_ID]);
    });

    it('lets the administrator copy the groups of every teacher, a split without the students of the class', async () => {
      db.setSession(ADMIN_ID);
      const targetId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      await service.enrollInClass(targetId, [ELENA_ID]);

      await service.duplicateClass(
        DAW_CLASS_ID,
        NEW_CLASS,
        [DAW_GROUP_ID, DAW_ENGLISH_GROUP_ID],
        NOTHING,
      );

      const [basic, english] = groupsOf(targetId);
      expect([basic.teacherId, english.teacherId]).toEqual([TEACHER_ID, OTHER_TEACHER_ID]);
      expect(studentsOf(basic.id)).toEqual([ELENA_ID]);
      expect(studentsOf(english.id)).toEqual([]);
    });

    it.each([
      ['no group', NEXT_YEAR, []],
      ['a group twice', NEXT_YEAR, [DAW_GROUP_ID, DAW_GROUP_ID]],
      [
        'more groups than the maximum',
        NEXT_YEAR,
        Array.from({ length: MAX_GROUP_BATCH + 1 }, (_, i) => `group-${i}`),
      ],
      [
        'into the same class, whatever its capitals',
        { name: '1.º daw a', schoolYear: '2026/27' },
        [DAW_GROUP_ID],
      ],
      [
        'into a class that has the subject',
        { name: '1.º DAM B', schoolYear: '2026/27' },
        [DAW_GROUP_ID],
      ],
      [
        'into a new class with a year not like 2026/27',
        { name: 'Otra', schoolYear: '2027' },
        [DAW_GROUP_ID],
      ],
    ])('copies nothing with %s', async (_, draft, groupIds) => {
      await expect(
        service.duplicateClass(DAW_CLASS_ID, draft, groupIds, EVERYTHING),
      ).rejects.toMatchObject({ kind: 'invalid' });
      expectSeed();
    });

    it.each([
      ['a group of another teacher', [DAW_GROUP_ID, DAW_ENGLISH_GROUP_ID]],
      ['a group of another class', [DAM_GROUP_ID]],
      ['a group that does not exist', ['nope']],
    ])('does not find %s, and copies nothing', async (_, groupIds) => {
      await expect(
        service.duplicateClass(DAW_CLASS_ID, NEXT_YEAR, groupIds, EVERYTHING),
      ).rejects.toMatchObject({ kind: 'not_found' });
      expectSeed();
    });

    it('does not find a group of another class even for the administrator', async () => {
      db.setSession(ADMIN_ID);

      await expect(
        service.duplicateClass(DAW_CLASS_ID, NEXT_YEAR, [DAM_ADVANCED_GROUP_ID], EVERYTHING),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('does not find a class the user does not look after', async () => {
      await expect(
        service.duplicateClass(DAM_CLASS_ID, NEXT_YEAR, [DAM_GROUP_ID], EVERYTHING),
      ).rejects.toMatchObject({ kind: 'not_found' });
      await expect(
        service.duplicateClass('nope', NEXT_YEAR, [DAM_GROUP_ID], EVERYTHING),
      ).rejects.toMatchObject({ kind: 'not_found' });
      expectSeed();
    });
  });

  describe('listRoster', () => {
    it('lists the students of the class by name, with the groups of the class they are in', async () => {
      const roster = await service.listRoster(DAW_CLASS_ID);

      expect(roster).toHaveLength(DAW_STUDENT_IDS.length);
      const names = roster.map((row) => row.student.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
      expect(roster.find((row) => row.student.id === LUCIA_ID)).toEqual({
        student: { id: LUCIA_ID, name: 'Lucía Martín Gómez', email: 'lucia.martin@tutoria.test' },
        active: true,
        member: true,
        groupIds: sorted([DAW_GROUP_ID, DAW_WEB_GROUP_ID]),
      });
    });

    it('lists a student of one group only, and a disabled one', async () => {
      db.setSession(OTHER_TEACHER_ID);
      await service.enroll(DAW_ENGLISH_GROUP_ID, [ELENA_ID]);
      db.update('classMembers', (rows) => [
        ...rows,
        { classId: DAW_CLASS_ID, userId: DISABLED_STUDENT_ID },
      ]);

      const roster = await service.listRoster(DAW_CLASS_ID);

      expect(roster.find((row) => row.student.id === ELENA_ID)).toMatchObject({
        active: true,
        member: false,
        groupIds: [DAW_ENGLISH_GROUP_ID],
      });
      expect(roster.find((row) => row.student.id === DISABLED_STUDENT_ID)).toMatchObject({
        active: false,
        member: true,
        groupIds: [],
      });
    });

    it('does not find a class the user does not look after, nor one that does not exist', async () => {
      await expect(service.listRoster(DAM_CLASS_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.listRoster('nope')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('searchStudents', () => {
    const DAW_CLASS = { kind: 'class', id: DAW_CLASS_ID } as const;
    const ELENA = {
      id: ELENA_ID,
      name: 'Elena Vázquez Lorenzo',
      email: 'elena.vazquez@tutoria.test',
    };

    it('finds active students not in the class, without accents or capitals', async () => {
      await expect(service.searchStudents(DAW_CLASS, ' VÁZQ ')).resolves.toEqual([ELENA]);
      await expect(service.searchStudents(DAW_CLASS, 'raúl')).resolves.toEqual([]);
      await expect(service.searchStudents(DAW_CLASS, 'marta')).resolves.toEqual([]);
      await expect(service.searchStudents(DAW_CLASS, 'lucía')).resolves.toEqual([]);
    });

    it('finds them by email too', async () => {
      await expect(service.searchStudents(DAW_CLASS, 'bilal.am')).resolves.toEqual([
        expect.objectContaining({ id: DAM_STUDENT_IDS[5] }),
      ]);
    });

    it('finds the students of the class who are not in a group', async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(
        service.searchStudents({ kind: 'group', id: DAW_ENGLISH_GROUP_ID }, 'lucía'),
      ).resolves.toEqual([expect.objectContaining({ id: LUCIA_ID })]);
    });

    it('finds none with a short search, and the maximum at most by name', async () => {
      await expect(service.searchStudents(DAW_CLASS, ' a ')).resolves.toEqual([]);

      const classId = await service.createClass(NEW_CLASS, [], TEACHER_ID);
      const found = await service.searchStudents({ kind: 'class', id: classId }, 'tutoria');

      expect(found).toHaveLength(MAX_STUDENT_SEARCH_RESULTS);
      const names = found.map((row) => row.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    });

    it('does not search a class the user does not look after, nor a group of others', async () => {
      await expect(
        service.searchStudents({ kind: 'class', id: DAM_CLASS_ID }, 'elena'),
      ).rejects.toMatchObject({ kind: 'not_found' });
      await expect(
        service.searchStudents({ kind: 'group', id: DAW_ENGLISH_GROUP_ID }, 'elena'),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('enrollInClass', () => {
    it('enrolls into the class and its groups without a label, those of other teachers too', async () => {
      db.setSession(ADMIN_ID);
      const javiers = await service.addGroup(DAW_CLASS_ID, {
        subjectId: ADVANCED_PROGRAMMING_ID,
        label: null,
        teacherId: OTHER_TEACHER_ID,
      });
      db.setSession(TEACHER_ID);

      await service.enrollInClass(DAW_CLASS_ID, [ELENA_ID, RUBEN_ID]);

      expect(membersOf(DAW_CLASS_ID)).toEqual(sorted([...DAW_STUDENT_IDS, ELENA_ID, RUBEN_ID]));
      for (const groupId of [DAW_GROUP_ID, DAW_WEB_GROUP_ID, javiers]) {
        expect(studentsOf(groupId)).toEqual(expect.arrayContaining([ELENA_ID, RUBEN_ID]));
      }
      expect(studentsOf(DAW_ENGLISH_GROUP_ID)).toEqual([]);
    });

    it('skips who is already in the class or in a group', async () => {
      await service.enroll(DAW_WEB_GROUP_ID, [ELENA_ID]);
      const before = db.tables().enrollments.length;

      await service.enrollInClass(DAW_CLASS_ID, [LUCIA_ID, ELENA_ID]);

      expect(membersOf(DAW_CLASS_ID)).toEqual(sorted([...DAW_STUDENT_IDS, ELENA_ID]));
      expect(studentsOf(DAW_WEB_GROUP_ID)).toEqual(sorted([...DAW_STUDENT_IDS, ELENA_ID]));
      expect(studentsOf(DAW_GROUP_ID)).toEqual(sorted([...DAW_STUDENT_IDS, ELENA_ID]));
      expect(db.tables().enrollments).toHaveLength(before + 1);
    });

    it.each([
      ['nobody', []],
      ['the same student twice', [ELENA_ID, ELENA_ID]],
      ['too many at once', Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, (_, i) => `u-${i}`)],
      ['a teacher', [ELENA_ID, OTHER_TEACHER_ID]],
      ['a disabled student', [ELENA_ID, DISABLED_STUDENT_ID]],
      ['somebody who does not exist', [ELENA_ID, 'nope']],
    ])('enrolls nobody with %s', async (_, userIds) => {
      await expect(service.enrollInClass(DAW_CLASS_ID, userIds)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expectSeed();
    });

    it('does not find a class the user does not look after', async () => {
      await expect(service.enrollInClass(DAM_CLASS_ID, [LUCIA_ID])).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });
  });

  describe('removeFromClass', () => {
    it('takes a student out of the class and every group of it, keeping their attempts', async () => {
      db.setSession(OTHER_TEACHER_ID);
      await service.enroll(DAW_ENGLISH_GROUP_ID, [LUCIA_ID]);
      await service.enroll(DAM_GROUP_ID, [LUCIA_ID]);
      db.setSession(TEACHER_ID);
      const attempts = db.tables().attempts;

      await service.removeFromClass(DAW_CLASS_ID, LUCIA_ID);

      expect(membersOf(DAW_CLASS_ID)).not.toContain(LUCIA_ID);
      for (const groupId of [DAW_GROUP_ID, DAW_WEB_GROUP_ID, DAW_ENGLISH_GROUP_ID]) {
        expect(studentsOf(groupId)).not.toContain(LUCIA_ID);
      }
      expect(studentsOf(DAM_GROUP_ID)).toContain(LUCIA_ID);
      expect(db.tables().attempts).toEqual(attempts);
    });

    it('takes out a student of one group only', async () => {
      db.setSession(OTHER_TEACHER_ID);
      await service.enroll(DAW_ENGLISH_GROUP_ID, [ELENA_ID]);
      db.setSession(TEACHER_ID);

      await service.removeFromClass(DAW_CLASS_ID, ELENA_ID);

      expect(studentsOf(DAW_ENGLISH_GROUP_ID)).toEqual([]);
    });

    it('does not find a student who is not in the class', async () => {
      await expect(service.removeFromClass(DAW_CLASS_ID, ELENA_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });

    it('does not find a class the user does not look after', async () => {
      await expect(service.removeFromClass(DAM_CLASS_ID, ELENA_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });
  });

  describe('enroll', () => {
    it('enrolls several students into one group only', async () => {
      db.setSession(OTHER_TEACHER_ID);

      await service.enroll(DAW_ENGLISH_GROUP_ID, [LUCIA_ID, ELENA_ID]);

      expect(studentsOf(DAW_ENGLISH_GROUP_ID)).toEqual(sorted([LUCIA_ID, ELENA_ID]));
      expect(membersOf(DAW_CLASS_ID)).toEqual(sorted(DAW_STUDENT_IDS));
      expect(studentsOf(DAW_GROUP_ID)).toEqual(sorted(DAW_STUDENT_IDS));
    });

    it.each([
      ['nobody', []],
      ['the same student twice', [ELENA_ID, ELENA_ID]],
      ['too many at once', Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, (_, i) => `u-${i}`)],
      ['a teacher', [ELENA_ID, OTHER_TEACHER_ID]],
      ['a disabled student', [ELENA_ID, DISABLED_STUDENT_ID]],
      ['somebody already in the group', [ELENA_ID, LUCIA_ID]],
    ])('enrolls nobody with %s', async (_, userIds) => {
      await expect(service.enroll(DAW_GROUP_ID, userIds)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expectSeed();
    });

    it('does not find a group of another teacher', async () => {
      await expect(service.enroll(DAW_ENGLISH_GROUP_ID, [LUCIA_ID])).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });
  });

  describe('unenroll', () => {
    it('takes a student out of one group and keeps their attempts', async () => {
      const attempts = db.tables().attempts;

      await service.unenroll(DAW_GROUP_ID, LUCIA_ID);

      expect(studentsOf(DAW_GROUP_ID)).not.toContain(LUCIA_ID);
      expect(studentsOf(DAW_WEB_GROUP_ID)).toContain(LUCIA_ID);
      expect(membersOf(DAW_CLASS_ID)).toContain(LUCIA_ID);
      expect(db.tables().attempts).toEqual(attempts);
    });

    it('does not find a student who is not in the group, nor a group of another teacher', async () => {
      await expect(service.unenroll(DAW_GROUP_ID, ELENA_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.unenroll(DAM_GROUP_ID, ELENA_ID)).rejects.toMatchObject({
        kind: 'not_found',
      });
      expectSeed();
    });
  });

  describe('listTeachers', () => {
    it('lists the active teachers by name to the administrator', async () => {
      db.setSession(ADMIN_ID);

      await expect(service.listTeachers()).resolves.toEqual([
        { id: OTHER_TEACHER_ID, name: 'Javier Ortega Ruiz', email: 'javier.ortega@tutoria.test' },
        { id: TEACHER_ID, name: 'Marta Ibáñez Soler', email: 'marta.ibanez@tutoria.test' },
      ]);
      disable(OTHER_TEACHER_ID);
      await expect(service.listTeachers()).resolves.toEqual([
        expect.objectContaining({ id: TEACHER_ID }),
      ]);
    });

    it('lists only themselves to a teacher, and is forbidden to a student', async () => {
      await expect(service.listTeachers()).resolves.toEqual([
        expect.objectContaining({ id: TEACHER_ID }),
      ]);
      db.setSession(HUGO_ID);
      await expect(service.listTeachers()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });
});
