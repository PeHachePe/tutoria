import { TestBed } from '@angular/core/testing';

import { type GroupDraft, MAX_ENROLLMENT_BATCH } from '../group-service';
import { SupabaseGroupService } from './supabase-group-service';
import { FakeSupabaseServer, groupRow, provideFakeSupabase, subjectRow } from './supabase-testing';

const DRAFT: GroupDraft = {
  name: ' Taller ',
  schoolYear: '2026/27',
  teacherId: 'teacher-1',
  subjectId: 'subject-1',
};

const LUCIA = { id: 'lucia', name: 'Lucía Pérez', email: 'lucia@tutoria.test' };
const HUGO = { id: 'hugo', name: 'Hugo Sánchez', email: 'hugo@tutoria.test' };

function managedRow(overrides: Parameters<typeof groupRow>[0] = {}) {
  return { ...groupRow(overrides), subject: subjectRow(), teacher: { name: 'Marta Ibáñez' } };
}

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

  it('lists the groups the RLS gives, by name and subject, with their summary', async () => {
    server
      .on('GET', '/rest/v1/class_group', {
        body: [
          managedRow(),
          { ...managedRow({ id: 'dam', name: '1.º DAM B' }), subject: subjectRow({ name: 'Web' }) },
          { ...managedRow({ id: 'daw-web' }), subject: subjectRow({ name: 'Desarrollo web' }) },
        ],
      })
      .on('POST', '/rest/v1/rpc/group_summaries', {
        body: [{ group_id: 'daw', student_count: 24, is_started: true }],
      });

    const groups = await service.listGroups();

    expect(groups.map((row) => row.group.id)).toEqual(['dam', 'daw-web', 'daw']);
    expect(groups.filter((row) => row.group.id !== 'daw-web')).toEqual([
      expect.objectContaining({ group: expect.objectContaining({ id: 'dam' }), studentCount: 0 }),
      {
        group: {
          id: 'daw',
          name: '1.º DAW A',
          schoolYear: '2026/27',
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
        },
        subject: expect.objectContaining({ id: 'subject-1' }),
        teacherName: 'Marta Ibáñez',
        studentCount: 24,
        started: true,
      },
    ]);
    const [request] = server.sentTo('GET', '/rest/v1/class_group');
    // The teacher by their own key: class_group reaches app_user through enrollment too
    expect(request.params.get('select')).toBe(
      '*,subject(*),teacher:app_user!class_group_teacher_id_fkey(name)',
    );
  });

  it('creates a group, with the name trimmed and nobody in it', async () => {
    server.on('POST', '/rest/v1/class_group', {
      status: 201,
      body: managedRow({ name: 'Taller' }),
    });

    const saved = await service.saveGroup(DRAFT);

    expect(saved).toMatchObject({ group: { name: 'Taller' }, studentCount: 0, started: false });
    const [request] = server.sentTo('POST', '/rest/v1/class_group');
    expect(request.body).toEqual({
      name: 'Taller',
      school_year: '2026/27',
      teacher_id: 'teacher-1',
      subject_id: 'subject-1',
    });
    expect(server.sentTo('POST', '/rest/v1/rpc/group_summaries')).toHaveLength(0);
  });

  it('changes only name, year and teacher of a group, with its summary', async () => {
    server
      .on('PATCH', '/rest/v1/class_group', { body: managedRow() })
      .on('POST', '/rest/v1/rpc/group_summaries', {
        body: [
          { group_id: 'dam', student_count: 1, is_started: false },
          { group_id: 'daw', student_count: 3, is_started: true },
        ],
      });

    const saved = await service.saveGroup({ ...DRAFT, id: 'daw' });

    expect(saved).toMatchObject({ studentCount: 3, started: true });
    const [request] = server.sentTo('PATCH', '/rest/v1/class_group');
    expect(request.params.get('id')).toBe('eq.daw');
    expect(request.body).toEqual({
      name: 'Taller',
      school_year: '2026/27',
      teacher_id: 'teacher-1',
    });
  });

  it('sums up a changed group the summaries leave out as empty', async () => {
    server
      .on('PATCH', '/rest/v1/class_group', { body: managedRow() })
      .on('POST', '/rest/v1/rpc/group_summaries', { body: [] });

    await expect(service.saveGroup({ ...DRAFT, id: 'daw' })).resolves.toMatchObject({
      studentCount: 0,
      started: false,
    });
  });

  it.each([
    ['42501', 'forbidden'],
    ['23514', 'invalid'],
  ])('translates %s on saving a group into %s', async (code, kind) => {
    server.on('POST', '/rest/v1/class_group', { status: 403, body: { message: 'No', code } });

    await expect(service.saveGroup(DRAFT)).rejects.toMatchObject({ kind });
  });

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

  it('lists the students of a group by name', async () => {
    server.on('GET', '/rest/v1/class_group', {
      body: {
        id: 'daw',
        enrollment: [
          { id: 'e-1', app_user: { ...LUCIA, status: 'active' } },
          { id: 'e-2', app_user: { ...HUGO, status: 'disabled' } },
        ],
      },
    });

    await expect(service.listStudents('daw')).resolves.toEqual([
      { enrollmentId: 'e-2', student: HUGO, active: false },
      { enrollmentId: 'e-1', student: LUCIA, active: true },
    ]);
    const [request] = server.sentTo('GET', '/rest/v1/class_group');
    expect(request.params.get('id')).toBe('eq.daw');
  });

  it('does not find the students of a group the RLS hides', async () => {
    server.on('GET', '/rest/v1/class_group', {
      status: 406,
      body: { message: 'No rows', code: 'PGRST116' },
    });

    await expect(service.listStudents('dam')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('searches students with the RPC, and not with a short search', async () => {
    server.on('POST', '/rest/v1/rpc/search_students', { body: [LUCIA] });

    await expect(service.searchStudents('daw', ' lu ')).resolves.toEqual([LUCIA]);
    expect(server.sentTo('POST', '/rest/v1/rpc/search_students')[0].body).toEqual({
      search: 'lu',
      target_group_id: 'daw',
    });

    await expect(service.searchStudents('daw', ' l ')).resolves.toEqual([]);
    expect(server.sentTo('POST', '/rest/v1/rpc/search_students')).toHaveLength(1);
  });

  it('translates P0002 and 22023 on searching', async () => {
    server.on('POST', '/rest/v1/rpc/search_students', {
      status: 400,
      body: { message: 'No such group', code: 'P0002' },
    });
    await expect(service.searchStudents('dam', 'lucía')).rejects.toMatchObject({
      kind: 'not_found',
    });

    server.on('POST', '/rest/v1/rpc/search_students', {
      status: 400,
      body: { message: 'Short', code: '22023' },
    });
    await expect(service.searchStudents('daw', 'lucía')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('enrolls several students in one request', async () => {
    server.on('POST', '/rest/v1/rpc/enroll_students', {
      body: [
        { enrollment_id: 'e-1', ...LUCIA },
        { enrollment_id: 'e-2', ...HUGO },
      ],
    });

    await expect(service.enroll('daw', ['lucia', 'hugo'])).resolves.toEqual([
      { enrollmentId: 'e-1', student: LUCIA, active: true },
      { enrollmentId: 'e-2', student: HUGO, active: true },
    ]);
    const [request] = server.sentTo('POST', '/rest/v1/rpc/enroll_students');
    expect(request.body).toEqual({
      target_group_id: 'daw',
      student_ids: ['lucia', 'hugo'],
      also_group_ids: [],
    });
  });

  it('enrolls in the other groups of the class too', async () => {
    server.on('POST', '/rest/v1/rpc/enroll_students', {
      body: [{ enrollment_id: 'e-1', ...LUCIA }],
    });

    await service.enroll('daw', ['lucia'], ['daw-web']);

    const [request] = server.sentTo('POST', '/rest/v1/rpc/enroll_students');
    expect(request.body).toMatchObject({ also_group_ids: ['daw-web'] });
  });

  it.each([
    // Somebody already in the group
    ['23505', 'invalid'],
    // Not an active student (check_enrolled_student)
    ['23514', 'invalid'],
    // A group the user does not manage
    ['P0002', 'not_found'],
  ])('translates %s on enrolling into %s', async (code, kind) => {
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
  ])('does not send an enrollment of %s', async (_, userIds) => {
    await expect(service.enroll('daw', userIds)).rejects.toMatchObject({ kind: 'invalid' });
    expect(server.requests).toHaveLength(0);
  });

  it('creates the class in several subjects in one insert, in their order', async () => {
    server.on('POST', '/rest/v1/class_group', {
      status: 201,
      body: [
        managedRow({ id: 'web', name: 'Taller', subject_id: 'subject-2' }),
        managedRow({ id: 'basic', name: 'Taller', subject_id: 'subject-1' }),
      ],
    });

    const created = await service.createGroups(
      { name: ' Taller ', schoolYear: '2026/27', teacherId: 'teacher-1' },
      ['subject-1', 'subject-2'],
    );

    expect(created.map((row) => [row.group.id, row.studentCount, row.started])).toEqual([
      ['basic', 0, false],
      ['web', 0, false],
    ]);
    const [request] = server.sentTo('POST', '/rest/v1/class_group');
    expect(request.body).toEqual([
      { name: 'Taller', school_year: '2026/27', teacher_id: 'teacher-1', subject_id: 'subject-1' },
      { name: 'Taller', school_year: '2026/27', teacher_id: 'teacher-1', subject_id: 'subject-2' },
    ]);
  });

  it('duplicates groups with the RPC, and reads them as the list shows them', async () => {
    server
      .on('POST', '/rest/v1/rpc/duplicate_groups', {
        body: [groupRow({ id: 'copy-1' }), groupRow({ id: 'copy-2' })],
      })
      .on('GET', '/rest/v1/class_group', {
        body: [managedRow({ id: 'copy-2' }), managedRow({ id: 'copy-1' })],
      })
      .on('POST', '/rest/v1/rpc/group_summaries', {
        body: [{ group_id: 'copy-1', student_count: 24, is_started: false }],
      });

    const created = await service.duplicateGroups(
      ['daw', 'daw-web'],
      { name: ' 1.º DAW A ', schoolYear: '2027/28', teacherId: 'teacher-1' },
      { blocks: true, dates: false, students: true },
    );

    expect(created.map((row) => [row.group.id, row.studentCount])).toEqual([
      ['copy-1', 24],
      ['copy-2', 0],
    ]);
    const [request] = server.sentTo('POST', '/rest/v1/rpc/duplicate_groups');
    expect(request.body).toEqual({
      source_group_ids: ['daw', 'daw-web'],
      group_name: '1.º DAW A',
      group_school_year: '2027/28',
      group_teacher_id: 'teacher-1',
      with_blocks: true,
      with_dates: false,
      with_students: true,
      time_zone: 'Europe/Madrid',
    });
    expect(server.sentTo('GET', '/rest/v1/class_group')[0].params.get('id')).toBe(
      'in.(copy-1,copy-2)',
    );
  });

  it('translates a group of others on duplicating into not found', async () => {
    server.on('POST', '/rest/v1/rpc/duplicate_groups', {
      status: 400,
      body: { message: 'No such group', code: 'P0002' },
    });

    await expect(
      service.duplicateGroups(
        ['dam'],
        { name: 'Copia', schoolYear: '2027/28', teacherId: 'teacher-1' },
        { blocks: false, dates: false, students: false },
      ),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('unenrolls, and an enrollment the RLS hides is not found', async () => {
    server.on('DELETE', '/rest/v1/enrollment', { body: [{ id: 'e-1' }] });
    await expect(service.unenroll('e-1')).resolves.toBeUndefined();
    expect(server.sentTo('DELETE', '/rest/v1/enrollment')[0].params.get('id')).toBe('eq.e-1');

    server.on('DELETE', '/rest/v1/enrollment', { body: [] });
    await expect(service.unenroll('e-1')).rejects.toMatchObject({ kind: 'not_found' });
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
    expect(request.params.get('role')).toBe('eq.teacher');
    expect(request.params.get('status')).toBe('eq.active');
  });
});
