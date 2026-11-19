import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type ClassDraft,
  type DuplicateOptions,
  type EnrolledStudent,
  type GroupDraft,
  GroupService,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  MIN_STUDENT_SEARCH_LENGTH,
  type UserRef,
} from '../group-service';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import { type Row, toClassGroup, toSubject } from './supabase-rows';
import { localTimeZone } from './time-zone';

/**
 * The group with its subject and the name of its teacher, by its own key: through `enrollment`,
 * `class_group` reaches `app_user` too.
 */
const MANAGED_GROUP = '*, subject(*), teacher:app_user!class_group_teacher_id_fkey(name)';

type ManagedRow = Row<'class_group'> & {
  readonly subject: Row<'subject'>;
  readonly teacher: { readonly name: string };
};

interface Summary {
  readonly studentCount: number;
  readonly started: boolean;
}

const EMPTY: Summary = { studentCount: 0, started: false };

/**
 * Groups and enrollment in Supabase (5.2a). The RLS decides who changes them, and the triggers
 * `check_group_teacher` and `check_enrolled_student` who may be their teacher and their students.
 */
@Service({ autoProvided: false })
export class SupabaseGroupService extends GroupService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Two requests at once: the groups the RLS gives, and how many students and whether started. */
  async listGroups(): Promise<ManagedGroup[]> {
    const [groups, summaries] = await Promise.all([
      this.supabase.from('class_group').select(MANAGED_GROUP),
      this.summaries(),
    ]);
    return unwrap(groups)
      .map((row) => toManaged(row, summaries.get(row.id) ?? EMPTY))
      .sort(
        (a, b) =>
          a.group.name.localeCompare(b.group.name, 'es') ||
          a.subject.name.localeCompare(b.subject.name, 'es'),
      );
  }

  async saveGroup({ id, ...draft }: GroupDraft): Promise<ManagedGroup> {
    const changes = {
      name: draft.name.trim(),
      school_year: draft.schoolYear,
      teacher_id: draft.teacherId,
    };
    if (id === undefined) {
      const row = unwrap(
        await this.supabase
          .from('class_group')
          .insert({ ...changes, subject_id: draft.subjectId })
          .select(MANAGED_GROUP)
          .single(),
      );
      return toManaged(row, EMPTY);
    }
    // The subject is left out: the column privileges keep it (a group never changes subject)
    const row = unwrap(
      await this.supabase
        .from('class_group')
        .update(changes)
        .eq('id', id)
        .select(MANAGED_GROUP)
        .single(),
    );
    const summaries = await this.summaries();
    return toManaged(row, summaries.get(id) ?? EMPTY);
  }

  /** In one insert, so all or none. */
  async createGroups(draft: ClassDraft, subjectIds: readonly string[]): Promise<ManagedGroup[]> {
    const rows = unwrap(
      await this.supabase
        .from('class_group')
        .insert(
          subjectIds.map((subjectId) => ({
            name: draft.name.trim(),
            school_year: draft.schoolYear,
            teacher_id: draft.teacherId,
            subject_id: subjectId,
          })),
        )
        .select(MANAGED_GROUP),
    );
    return inOrder(rows, subjectIds, (row) => row.subject_id).map((row) => toManaged(row, EMPTY));
  }

  /**
   * With the RPC `duplicate_groups`, in one transaction (the dates move in the zone of the
   * browser), and then the new groups as the list shows them.
   */
  async duplicateGroups(
    sourceGroupIds: readonly string[],
    draft: ClassDraft,
    options: DuplicateOptions,
  ): Promise<ManagedGroup[]> {
    const created = unwrap(
      await this.supabase.rpc('duplicate_groups', {
        source_group_ids: [...sourceGroupIds],
        group_name: draft.name.trim(),
        group_school_year: draft.schoolYear,
        group_teacher_id: draft.teacherId,
        with_blocks: options.blocks,
        with_dates: options.dates,
        with_students: options.students,
        time_zone: localTimeZone(),
      }),
    );
    const ids = created.map((row) => row.id);
    const [groups, summaries] = await Promise.all([
      this.supabase.from('class_group').select(MANAGED_GROUP).in('id', ids),
      this.summaries(),
    ]);
    return inOrder(unwrap(groups), ids, (row) => row.id).map((row) =>
      toManaged(row, summaries.get(row.id) ?? EMPTY),
    );
  }

  /**
   * The RLS deletes no row, without an error, of a group somebody started or of one the user does
   * not manage: only then a second request tells them apart, as the mock service does.
   */
  async removeGroup(groupId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('class_group').delete().eq('id', groupId).select('id'),
    );
    if (deleted.length > 0) return;
    const seen = unwrap(await this.supabase.from('class_group').select('id').eq('id', groupId));
    throw seen.length > 0
      ? new DataError('invalid', 'A group somebody started keeps their attempts')
      : new DataError('not_found');
  }

  /** Through the group, so one the RLS hides is `not_found` and not an empty list. */
  async listStudents(groupId: string): Promise<EnrolledStudent[]> {
    const group = unwrap(
      await this.supabase
        .from('class_group')
        .select('id, enrollment(id, app_user(id, name, email, status))')
        .eq('id', groupId)
        .single(),
    );
    return group.enrollment
      .map(toEnrolled)
      .sort((a, b) => a.student.name.localeCompare(b.student.name, 'es'));
  }

  async searchStudents(groupId: string, search: string): Promise<UserRef[]> {
    const text = search.trim();
    if (text.length < MIN_STUDENT_SEARCH_LENGTH) return [];
    return unwrap(
      await this.supabase.rpc('search_students', { search: text, target_group_id: groupId }),
    );
  }

  /**
   * With the RPC `enroll_students`, all or none: an insert with `returning` cannot read the
   * students, as their new enrollments are what lets the teacher read them. The limits are checked
   * here too, so a batch the server would reject is not sent.
   */
  async enroll(
    groupId: string,
    userIds: readonly string[],
    alsoGroupIds: readonly string[] = [],
  ): Promise<EnrolledStudent[]> {
    if (
      userIds.length === 0 ||
      userIds.length > MAX_ENROLLMENT_BATCH ||
      new Set(userIds).size !== userIds.length
    ) {
      throw new DataError('invalid', 'Between one and the maximum, each student once');
    }
    const rows = unwrap(
      await this.supabase.rpc('enroll_students', {
        target_group_id: groupId,
        student_ids: [...userIds],
        also_group_ids: [...alsoGroupIds],
      }),
    );
    // Only an active student can be enrolled
    return rows.map(({ enrollment_id, ...student }) => ({
      enrollmentId: enrollment_id,
      student,
      active: true,
    }));
  }

  async unenroll(enrollmentId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('enrollment').delete().eq('id', enrollmentId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('not_found');
  }

  async listTeachers(): Promise<UserRef[]> {
    const rows = unwrap(
      await this.supabase
        .from('app_user')
        .select('id, name, email')
        .eq('role', 'teacher')
        .eq('status', 'active'),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private async summaries(): Promise<ReadonlyMap<string, Summary>> {
    const rows = unwrap(await this.supabase.rpc('group_summaries'));
    return new Map(
      rows.map((row) => [
        row.group_id,
        { studentCount: row.student_count, started: row.is_started },
      ]),
    );
  }
}

function toManaged({ subject, teacher, ...group }: ManagedRow, summary: Summary): ManagedGroup {
  return {
    group: toClassGroup(group),
    subject: toSubject(subject),
    teacherName: teacher.name,
    ...summary,
  };
}

/** The rows in the order of `keys`: a response does not promise one. */
function inOrder<T>(rows: readonly T[], keys: readonly string[], keyOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => keys.indexOf(keyOf(a)) - keys.indexOf(keyOf(b)));
}

function toEnrolled(row: {
  readonly id: string;
  readonly app_user: UserRef & { readonly status: string };
}): EnrolledStudent {
  const { status, ...student } = row.app_user;
  return { enrollmentId: row.id, student, active: status === 'active' };
}
