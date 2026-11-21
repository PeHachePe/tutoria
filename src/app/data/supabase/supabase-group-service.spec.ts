import { TestBed } from '@angular/core/testing';

import { type DuplicateOptions, MAX_ENROLLMENT_BATCH } from '../group-service';
import { SupabaseGroupService } from './supabase-group-service';
import { FakeSupabaseServer, provideFakeSupabase, subjectRow } from './supabase-testing';
import { localTimeZone } from './time-zone';

const LUCIA = { id: 'lucia', name: 'Lucía Pérez', email: 'lucia@tutoria.test' };
const HUGO = { id: 'hugo', name: 'Hugo Sánchez', email: 'hugo@tutoria.test' };

/** A row of `school_class`. */
const DAW_ROW = {
  id: 'daw',
  name: '1.º DAW A',
  school_year: '2026/27',
  created_by: 'teacher-1',
  created_at: '2026-09-01T08:00:00+00:00',
  reopened: false,
};

/** A row of `managed_classes`: a class with whether the user may edit it and whether it is open. */
function classRow(
  overrides: Partial<typeof DAW_ROW & { can_edit: boolean; is_open: boolean }> = {},
) {
  return { ...DAW_ROW, can_edit: true, is_open: true, ...overrides };
}

/** A row of `class_overview`: a group of a class with its summary. */
const DAW_BASIC_OVERVIEW = {
  group_id: 'daw-basic',
  class_id: 'daw',
  label: null as string | null,
  teacher_id: 'teacher-1',
  subject_id: 'subject-1',
  teacher_name: 'Marta Ibáñez',
  student_count: 24,
  is_started: true,
  is_mine: true,
};

function overviewRow(overrides: Partial<typeof DAW_BASIC_OVERVIEW> = {}) {
  return { ...DAW_BASIC_OVERVIEW, ...overrides };
}

const OPTIONS: DuplicateOptions = { blocks: true, dates: false, students: true };

describe('SupabaseGroupService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseGroupService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseGroupService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseGroupService);
  });

  describe('listClasses', () => {
    it('lists the classes by year and name, each with its groups by subject and label', async () => {
      server
        .on('POST', '/rest/v1/rpc/managed_classes', {
          body: [
            classRow(),
            classRow({ id: 'next', name: '1.º DAW A', school_year: '2027/28' }),
            classRow({ id: 'dam', name: '1.º DAM B', can_edit: false }),
            classRow({ id: 'old', school_year: '2020/21', is_open: false }),
          ],
        })
        .on('POST', '/rest/v1/rpc/class_overview', {
          body: [
            overviewRow({ group_id: 'daw-english', label: 'Desdoble inglés', is_mine: false }),
            overviewRow(),
            overviewRow({ group_id: 'daw-web', subject_id: 'subject-2' }),
            overviewRow({ group_id: 'dam-basic', class_id: 'dam' }),
          ],
        })
        .on('GET', '/rest/v1/subject', {
          body: [subjectRow(), subjectRow({ id: 'subject-2', name: 'Desarrollo web' })],
        });

      const classes = await service.listClasses();

      expect(classes.map((row) => [row.schoolClass.id, row.canEdit, row.open])).toEqual([
        ['next', true, true],
        ['dam', false, true],
        ['daw', true, true],
        ['old', true, false],
      ]);
      expect(classes[0].groups).toEqual([]);
      expect(classes[1].groups.map((row) => row.group.id)).toEqual(['dam-basic']);
      expect(classes[2].groups.map((row) => row.group.id)).toEqual([
        'daw-web',
        'daw-basic',
        'daw-english',
      ]);
      expect(classes[2].schoolClass).toEqual({
        id: 'daw',
        name: '1.º DAW A',
        schoolYear: '2026/27',
        createdBy: 'teacher-1',
        createdAt: '2026-09-01T08:00:00.000Z',
        reopened: false,
      });
      expect(classes[2].groups[2]).toEqual({
        group: {
          id: 'daw-english',
          classId: 'daw',
          label: 'Desdoble inglés',
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
        },
        subject: expect.objectContaining({ id: 'subject-1', name: 'Programación básica' }),
        teacherName: 'Marta Ibáñez',
        studentCount: 24,
        started: true,
        mine: false,
      });
    });

    it('sorts a split after the group of the whole class whatever order they come in', async () => {
      server
        .on('POST', '/rest/v1/rpc/managed_classes', { body: [classRow()] })
        .on('POST', '/rest/v1/rpc/class_overview', {
          body: [
            overviewRow({ group_id: 'b', label: 'B' }),
            overviewRow({ group_id: 'whole' }),
            overviewRow({ group_id: 'a', label: 'A' }),
          ],
        })
        .on('GET', '/rest/v1/subject', { body: [subjectRow()] });

      const [daw] = await service.listClasses();

      expect(daw.groups.map((row) => row.group.id)).toEqual(['whole', 'a', 'b']);
    });

    it('fails as any of its requests does', async () => {
      server
        .on('POST', '/rest/v1/rpc/managed_classes', {
          status: 403,
          body: { message: 'No', code: '42501' },
        })
        .on('POST', '/rest/v1/rpc/class_overview', { body: [] })
        .on('GET', '/rest/v1/subject', { body: [] });

      await expect(service.listClasses()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  it('lists every class of the school, in the order of the RPC, with all its groups', async () => {
    server.on('POST', '/rest/v1/rpc/school_classes', {
      body: [
        { ...DAW_ROW, id: 'dam', name: '1.º DAM B', class_groups: [] },
        {
          ...DAW_ROW,
          class_groups: [
            { subject_id: 's-1', label: null, teacher_name: 'Marta' },
            { subject_id: 's-1', label: 'Desdoble inglés', teacher_name: 'Javier' },
          ],
        },
      ],
    });

    const classes = await service.listAllClasses();

    expect(classes.map(({ schoolClass }) => schoolClass.id)).toEqual(['dam', 'daw']);
    expect(classes[1]).toEqual({
      schoolClass: {
        id: 'daw',
        name: '1.º DAW A',
        schoolYear: '2026/27',
        createdBy: 'teacher-1',
        createdAt: '2026-09-01T08:00:00.000Z',
        reopened: false,
      },
      groups: [
        { subjectId: 's-1', label: null, teacherName: 'Marta' },
        { subjectId: 's-1', label: 'Desdoble inglés', teacherName: 'Javier' },
      ],
    });
  });

  describe('createClass', () => {
    it('creates or joins the class with the RPC, with the name trimmed', async () => {
      server.on('POST', '/rest/v1/rpc/create_class', { body: 'class-1' });

      await expect(
        service.createClass({ name: ' 2.º DAW A ', schoolYear: '2027/28' }, ['s-1', 's-2'], 't-1'),
      ).resolves.toBe('class-1');
      expect(server.sentTo('POST', '/rest/v1/rpc/create_class')[0].body).toEqual({
        class_name: '2.º DAW A',
        class_school_year: '2027/28',
        subject_ids: ['s-1', 's-2'],
        group_teacher_id: 't-1',
      });
    });

    it.each([
      ['42501', 'forbidden'],
      ['22023', 'invalid'],
      ['23505', 'invalid'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/create_class', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(
        service.createClass({ name: 'Taller', schoolYear: '2027/28' }, [], 't-1'),
      ).rejects.toMatchObject({ kind });
    });
  });

  describe('saveClass', () => {
    it('renames a class, with the name trimmed', async () => {
      server.on('PATCH', '/rest/v1/school_class', { body: [{ id: 'daw' }] });

      await expect(
        service.saveClass('daw', { name: ' DAW mañana ', schoolYear: '2027/28' }),
      ).resolves.toBeUndefined();
      const [request] = server.sentTo('PATCH', '/rest/v1/school_class');
      expect(request.params.get('id')).toBe('eq.daw');
      expect(request.body).toEqual({ name: 'DAW mañana', school_year: '2027/28' });
    });

    it('tells a class the RLS does not let change as forbidden', async () => {
      server.on('PATCH', '/rest/v1/school_class', { body: [] });

      await expect(
        service.saveClass('dam', { name: 'Otra', schoolYear: '2026/27' }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('translates a name and year taken into invalid', async () => {
      server.on('PATCH', '/rest/v1/school_class', {
        status: 409,
        body: { message: 'Taken', code: '23505' },
      });

      await expect(
        service.saveClass('daw', { name: '1.º DAM B', schoolYear: '2026/27' }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('reopenClass', () => {
    it('reopens a class or closes it again with the RPC', async () => {
      server.on('POST', '/rest/v1/rpc/reopen_class', { status: 204 });

      await service.reopenClass('old', true);
      await service.reopenClass('old', false);
      expect(server.sentTo('POST', '/rest/v1/rpc/reopen_class').map(({ body }) => body)).toEqual([
        { target_class_id: 'old', reopen: true },
        { target_class_id: 'old', reopen: false },
      ]);
    });

    it.each([
      ['42501', 'forbidden'],
      ['P0002', 'not_found'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/reopen_class', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(service.reopenClass('old', true)).rejects.toMatchObject({ kind });
    });
  });

  describe('removeClass', () => {
    it('removes a class', async () => {
      server.on('DELETE', '/rest/v1/school_class', { body: [{ id: 'daw' }] });

      await expect(service.removeClass('daw')).resolves.toBeUndefined();
      expect(server.sentTo('DELETE', '/rest/v1/school_class')[0].params.get('id')).toBe('eq.daw');
      expect(server.sentTo('GET', '/rest/v1/school_class')).toHaveLength(0);
    });

    it('keeps a class it still sees as invalid, and one it does not see is not found', async () => {
      server
        .on('DELETE', '/rest/v1/school_class', { body: [] })
        .on('GET', '/rest/v1/school_class', { body: [{ id: 'daw' }] });
      await expect(service.removeClass('daw')).rejects.toMatchObject({ kind: 'invalid' });
      expect(server.sentTo('GET', '/rest/v1/school_class')[0].params.get('id')).toBe('eq.daw');

      server.on('GET', '/rest/v1/school_class', { body: [] });
      await expect(service.removeClass('nope')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('addGroup', () => {
    it('adds a split with the RPC', async () => {
      server.on('POST', '/rest/v1/rpc/add_class_group', { body: 'group-1' });

      await expect(
        service.addGroup('daw', { subjectId: 's-1', label: ' Desdoble ', teacherId: 't-1' }),
      ).resolves.toBe('group-1');
      expect(server.sentTo('POST', '/rest/v1/rpc/add_class_group')[0].body).toEqual({
        target_class_id: 'daw',
        target_subject_id: 's-1',
        group_label: ' Desdoble ',
        group_teacher_id: 't-1',
      });
    });

    it('sends a group of the whole class with an empty label', async () => {
      server.on('POST', '/rest/v1/rpc/add_class_group', { body: 'group-1' });

      await service.addGroup('daw', { subjectId: 's-1', label: null, teacherId: 't-1' });

      expect(server.sentTo('POST', '/rest/v1/rpc/add_class_group')[0].body).toMatchObject({
        group_label: '',
      });
    });

    it.each([
      ['42501', 'forbidden'],
      ['P0002', 'not_found'],
      ['23505', 'invalid'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/add_class_group', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(
        service.addGroup('daw', { subjectId: 's-1', label: null, teacherId: 't-1' }),
      ).rejects.toMatchObject({ kind });
    });
  });

  describe('saveGroup', () => {
    it('changes the label, trimmed, and the teacher of a group', async () => {
      server.on('PATCH', '/rest/v1/class_group', { body: [{ id: 'daw' }] });

      await expect(
        service.saveGroup('daw', { label: ' Tarde ', teacherId: 't-2' }),
      ).resolves.toBeUndefined();
      const [request] = server.sentTo('PATCH', '/rest/v1/class_group');
      expect(request.params.get('id')).toBe('eq.daw');
      expect(request.body).toEqual({ label: 'Tarde', teacher_id: 't-2' });
    });

    it.each([
      ['a blank label', '  '],
      ['no label', null],
    ])('sends %s as none', async (_, label) => {
      server.on('PATCH', '/rest/v1/class_group', { body: [{ id: 'daw' }] });

      await service.saveGroup('daw', { label, teacherId: 't-1' });

      expect(server.sentTo('PATCH', '/rest/v1/class_group')[0].body).toEqual({
        label: null,
        teacher_id: 't-1',
      });
    });

    it('does not find a group the RLS hides', async () => {
      server.on('PATCH', '/rest/v1/class_group', { body: [] });

      await expect(
        service.saveGroup('dam', { label: null, teacherId: 't-1' }),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });

    it.each([
      ['42501', 'forbidden'],
      ['23514', 'invalid'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('PATCH', '/rest/v1/class_group', { status: 403, body: { message: 'No', code } });

      await expect(
        service.saveGroup('daw', { label: null, teacherId: 't-2' }),
      ).rejects.toMatchObject({ kind });
    });
  });

  describe('removeGroup', () => {
    it('removes a group', async () => {
      server.on('DELETE', '/rest/v1/class_group', { body: [{ id: 'daw' }] });

      await expect(service.removeGroup('daw')).resolves.toBeUndefined();
      expect(server.sentTo('DELETE', '/rest/v1/class_group')[0].params.get('id')).toBe('eq.daw');
      expect(server.sentTo('GET', '/rest/v1/class_group')).toHaveLength(0);
    });

    it('keeps a started group it still sees as invalid, and one it does not see is not found', async () => {
      server
        .on('DELETE', '/rest/v1/class_group', { body: [] })
        .on('GET', '/rest/v1/class_group', { body: [{ id: 'daw' }] });
      await expect(service.removeGroup('daw')).rejects.toMatchObject({ kind: 'invalid' });
      expect(server.sentTo('GET', '/rest/v1/class_group')[0].params.get('id')).toBe('eq.daw');

      server.on('GET', '/rest/v1/class_group', { body: [] });
      await expect(service.removeGroup('dam')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('duplicateClass', () => {
    it('duplicates the class with the RPC, in the time zone of the browser', async () => {
      server.on('POST', '/rest/v1/rpc/duplicate_class', { body: 'next' });

      await expect(
        service.duplicateClass(
          'daw',
          { name: ' 1.º DAW A ', schoolYear: '2027/28' },
          ['daw-basic', 'daw-web'],
          OPTIONS,
        ),
      ).resolves.toBe('next');
      expect(server.sentTo('POST', '/rest/v1/rpc/duplicate_class')[0].body).toEqual({
        source_class_id: 'daw',
        class_name: '1.º DAW A',
        class_school_year: '2027/28',
        source_group_ids: ['daw-basic', 'daw-web'],
        with_blocks: true,
        with_dates: false,
        with_students: true,
        time_zone: localTimeZone(),
      });
    });

    it.each([
      ['P0002', 'not_found'],
      ['22023', 'invalid'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/duplicate_class', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(
        service.duplicateClass('dam', { name: 'Copia', schoolYear: '2027/28' }, ['dam'], OPTIONS),
      ).rejects.toMatchObject({ kind });
    });
  });

  describe('listRoster', () => {
    it('lists the students of a class as the RPC gives them', async () => {
      server.on('POST', '/rest/v1/rpc/class_roster', {
        body: [
          {
            ...HUGO,
            is_active: false,
            is_member: false,
            outcome: null,
            other_class_name: '1.º DAM B',
            group_ids: ['daw-english'],
          },
          {
            ...LUCIA,
            is_active: true,
            is_member: true,
            outcome: 'repeats',
            other_class_name: null,
            group_ids: ['daw-basic', 'daw-web'],
          },
        ],
      });

      await expect(service.listRoster('daw')).resolves.toEqual([
        {
          student: HUGO,
          active: false,
          member: false,
          outcome: null,
          otherClass: '1.º DAM B',
          groupIds: ['daw-english'],
        },
        {
          student: LUCIA,
          active: true,
          member: true,
          outcome: 'repeats',
          otherClass: null,
          groupIds: ['daw-basic', 'daw-web'],
        },
      ]);
      expect(server.sentTo('POST', '/rest/v1/rpc/class_roster')[0].body).toEqual({
        target_class_id: 'daw',
      });
    });

    it('does not find a class the user does not look after', async () => {
      server.on('POST', '/rest/v1/rpc/class_roster', {
        status: 400,
        body: { message: 'No such class', code: 'P0002' },
      });

      await expect(service.listRoster('dam')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('listCandidates', () => {
    it('asks for the students without a class in the year of the class, with their last one', async () => {
      server.on('POST', '/rest/v1/rpc/class_candidates', {
        body: [
          {
            ...LUCIA,
            last_class_name: '1.º DAW A',
            last_school_year: '2025/26',
            last_outcome: 'promotes',
          },
          { ...HUGO, last_class_name: null, last_school_year: null, last_outcome: null },
        ],
      });

      await expect(service.listCandidates('daw')).resolves.toEqual([
        {
          student: LUCIA,
          previous: { name: '1.º DAW A', schoolYear: '2025/26', outcome: 'promotes' },
        },
        { student: HUGO, previous: null },
      ]);
      expect(server.sentTo('POST', '/rest/v1/rpc/class_candidates')[0].body).toEqual({
        target_class_id: 'daw',
      });
    });
  });

  describe('setOutcomes (5.2g)', () => {
    it('sends the students and their outcome, or null to take it back', async () => {
      server.on('POST', '/rest/v1/rpc/set_class_outcomes', { body: 2 });

      await service.setOutcomes('daw', ['lucia', 'hugo'], 'graduates');
      await service.setOutcomes('daw', ['lucia'], null);

      expect(
        server.sentTo('POST', '/rest/v1/rpc/set_class_outcomes').map(({ body }) => body),
      ).toEqual([
        { target_class_id: 'daw', student_ids: ['lucia', 'hugo'], new_outcome: 'graduates' },
        { target_class_id: 'daw', student_ids: ['lucia'], new_outcome: null },
      ]);
    });

    it('does not find a student who is not in the class', async () => {
      server.on('POST', '/rest/v1/rpc/set_class_outcomes', {
        status: 400,
        body: { message: 'Not a student of the class', code: 'P0002' },
      });

      await expect(service.setOutcomes('daw', ['elena'], 'promotes')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  /** The last class of a student who never had one (5.2g). */
  const NO_CLASS = { last_class_name: null, last_school_year: null, last_outcome: null };

  describe('matchStudents', () => {
    it('sends the lines and keeps each student with its line', async () => {
      server.on('POST', '/rest/v1/rpc/match_students', {
        body: [
          {
            entry: 'lucia@x',
            ...LUCIA,
            last_class_name: '2.º DAW A',
            last_school_year: '2025/26',
            last_outcome: 'graduates',
          },
        ],
      });

      await expect(service.matchStudents('daw', ['lucia@x', 'nadie'])).resolves.toEqual([
        {
          entry: 'lucia@x',
          student: LUCIA,
          previous: { name: '2.º DAW A', schoolYear: '2025/26', outcome: 'graduates' },
        },
      ]);
      expect(server.sentTo('POST', '/rest/v1/rpc/match_students')[0].body).toEqual({
        target_class_id: 'daw',
        entries: ['lucia@x', 'nadie'],
      });
    });
  });

  describe('searchStudents', () => {
    it('searches the students of the school not in a class', async () => {
      server.on('POST', '/rest/v1/rpc/search_class_students', {
        body: [{ ...LUCIA, ...NO_CLASS }],
      });

      await expect(service.searchStudents({ kind: 'class', id: 'daw' }, ' lu ')).resolves.toEqual([
        { student: LUCIA, previous: null },
      ]);
      expect(server.sentTo('POST', '/rest/v1/rpc/search_class_students')[0].body).toEqual({
        search: 'lu',
        target_class_id: 'daw',
      });
    });

    it('searches the students not in a group', async () => {
      server.on('POST', '/rest/v1/rpc/search_students', {
        body: [
          {
            ...HUGO,
            last_class_name: '1.º DAW A',
            last_school_year: '2026/27',
            last_outcome: null,
          },
        ],
      });

      await expect(
        service.searchStudents({ kind: 'group', id: 'daw-english' }, 'hugo'),
      ).resolves.toEqual([
        { student: HUGO, previous: { name: '1.º DAW A', schoolYear: '2026/27', outcome: null } },
      ]);
      expect(server.sentTo('POST', '/rest/v1/rpc/search_students')[0].body).toEqual({
        search: 'hugo',
        target_group_id: 'daw-english',
      });
    });

    it('does not search with a short search', async () => {
      await expect(service.searchStudents({ kind: 'class', id: 'daw' }, ' l ')).resolves.toEqual(
        [],
      );
      expect(server.requests).toHaveLength(0);
    });

    it('translates P0002 into not found', async () => {
      server.on('POST', '/rest/v1/rpc/search_class_students', {
        status: 400,
        body: { message: 'No such class', code: 'P0002' },
      });

      await expect(
        service.searchStudents({ kind: 'class', id: 'dam' }, 'lucía'),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('enrollInClass', () => {
    it('enrolls several students into the class in one request', async () => {
      server.on('POST', '/rest/v1/rpc/enroll_class_members', { status: 204 });

      await expect(service.enrollInClass('daw', ['lucia', 'hugo'])).resolves.toBeUndefined();
      expect(server.sentTo('POST', '/rest/v1/rpc/enroll_class_members')[0].body).toEqual({
        target_class_id: 'daw',
        student_ids: ['lucia', 'hugo'],
      });
    });

    it.each([
      // Not an active student (check_enrolled_student)
      ['23514', 'invalid'],
      // A class the user does not look after
      ['P0002', 'not_found'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/enroll_class_members', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(service.enrollInClass('daw', ['lucia'])).rejects.toMatchObject({ kind });
    });

    it.each([
      ['nobody', []],
      ['the same student twice', ['lucia', 'lucia']],
      ['too many at once', Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, (_, i) => `u-${i}`)],
    ])('does not send %s', async (_, userIds) => {
      await expect(service.enrollInClass('daw', userIds)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expect(server.requests).toHaveLength(0);
    });
  });

  describe('removeFromClass', () => {
    it('takes a student out of the class with the RPC', async () => {
      server.on('POST', '/rest/v1/rpc/remove_class_member', { status: 204 });

      await expect(service.removeFromClass('daw', 'lucia')).resolves.toBeUndefined();
      expect(server.sentTo('POST', '/rest/v1/rpc/remove_class_member')[0].body).toEqual({
        target_class_id: 'daw',
        student_id: 'lucia',
      });
    });

    it('does not find a student not in the class', async () => {
      server.on('POST', '/rest/v1/rpc/remove_class_member', {
        status: 400,
        body: { message: 'Not in the class', code: 'P0002' },
      });

      await expect(service.removeFromClass('daw', 'elena')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('enroll', () => {
    it('enrolls several students into one group in one request', async () => {
      server.on('POST', '/rest/v1/rpc/enroll_students', { status: 204 });

      await expect(service.enroll('daw-english', ['lucia', 'hugo'])).resolves.toBeUndefined();
      expect(server.sentTo('POST', '/rest/v1/rpc/enroll_students')[0].body).toEqual({
        target_group_id: 'daw-english',
        student_ids: ['lucia', 'hugo'],
      });
    });

    it.each([
      // Somebody already in the group
      ['23505', 'invalid'],
      // Not an active student (check_enrolled_student)
      ['23514', 'invalid'],
      // A group the user does not manage
      ['P0002', 'not_found'],
    ])('translates %s into %s', async (code, kind) => {
      server.on('POST', '/rest/v1/rpc/enroll_students', {
        status: 400,
        body: { message: 'No', code },
      });

      await expect(service.enroll('daw', ['lucia'])).rejects.toMatchObject({ kind });
    });

    it.each([
      ['nobody', []],
      ['the same student twice', ['lucia', 'lucia']],
      ['too many at once', Array.from({ length: MAX_ENROLLMENT_BATCH + 1 }, (_, i) => `u-${i}`)],
    ])('does not send %s', async (_, userIds) => {
      await expect(service.enroll('daw', userIds)).rejects.toMatchObject({ kind: 'invalid' });
      expect(server.requests).toHaveLength(0);
    });
  });

  it('unenrolls a student from a group, and one the RLS hides is not found', async () => {
    server.on('DELETE', '/rest/v1/enrollment', { body: [{ id: 'e-1' }] });
    await expect(service.unenroll('daw', 'lucia')).resolves.toBeUndefined();
    const [request] = server.sentTo('DELETE', '/rest/v1/enrollment');
    expect(request.params.get('group_id')).toBe('eq.daw');
    expect(request.params.get('user_id')).toBe('eq.lucia');

    server.on('DELETE', '/rest/v1/enrollment', { body: [] });
    await expect(service.unenroll('dam', 'lucia')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('lists the active teachers by name', async () => {
    server.on('GET', '/rest/v1/app_user', {
      body: [
        { id: 'marta', name: 'Marta', email: 'marta@tutoria.test' },
        { id: 'javier', name: 'Javier', email: 'javier@tutoria.test' },
      ],
    });

    const teachers = await service.listTeachers();

    expect(teachers.map((teacher) => teacher.id)).toEqual(['javier', 'marta']);
    const [request] = server.sentTo('GET', '/rest/v1/app_user');
    expect(request.params.get('select')).toBe('id,name,email');
    expect(request.params.get('role')).toBe('eq.teacher');
    expect(request.params.get('status')).toBe('eq.active');
  });
});
