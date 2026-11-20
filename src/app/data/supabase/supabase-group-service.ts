import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type ClassDraft,
  type DuplicateOptions,
  type EnrollTarget,
  type GroupChanges,
  type GroupDraft,
  GroupService,
  type ManagedClass,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  MIN_STUDENT_SEARCH_LENGTH,
  type RosterStudent,
  type SchoolClassEntry,
  type StudentMatch,
  type ClassSubject,
  type UserRef,
} from '../group-service';
import type { SchoolClass } from '../user';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import { toSchoolClass, toSubject } from './supabase-rows';
import { localTimeZone } from './time-zone';

/**
 * Classes, groups and enrollment in Supabase (5.2a, 5.2d). A group and the students of a class are
 * written through functions, which give a new group the students of its class; the RLS decides who
 * renames or deletes a class and who changes or deletes a group, and the triggers who may be the
 * teacher of a group and its students.
 */
@Service({ autoProvided: false })
export class SupabaseGroupService extends GroupService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Three requests at once: the classes, every group of them (those of other teachers too, which the
   * RLS of `class_group` hides) and the subjects.
   */
  async listClasses(): Promise<ManagedClass[]> {
    const [classes, groups, subjects] = await Promise.all([
      this.supabase.rpc('managed_classes'),
      this.supabase.rpc('class_overview'),
      this.supabase.from('subject').select(),
    ]);
    const subjectById = new Map(unwrap(subjects).map((row) => [row.id, toSubject(row)]));
    const managed = unwrap(groups).map((row): ManagedGroup => ({
      group: {
        id: row.group_id,
        classId: row.class_id,
        label: row.label,
        teacherId: row.teacher_id,
        subjectId: row.subject_id,
      },
      // Every group has a subject that exists (foreign key)
      subject: subjectById.get(row.subject_id)!,
      teacherName: row.teacher_name,
      studentCount: row.student_count,
      started: row.is_started,
      mine: row.is_mine,
    }));
    return sortClasses(
      unwrap(classes).map(({ can_edit, is_open, ...row }) => ({ row, can_edit, is_open })),
    ).map(({ schoolClass, canEdit, open }) => ({
      schoolClass,
      groups: managed
        .filter(({ group }) => group.classId === schoolClass.id)
        .sort(
          (a, b) =>
            a.subject.name.localeCompare(b.subject.name, 'es') ||
            (a.group.label ?? '').localeCompare(b.group.label ?? '', 'es'),
        ),
      canEdit,
      open,
    }));
  }

  /** With the RPC `school_classes`: the RLS of `class_group` hides the groups of others. */
  async listAllClasses(): Promise<SchoolClassEntry[]> {
    const rows = unwrap(await this.supabase.rpc('school_classes'));
    return rows.map(({ class_groups, ...row }) => ({
      schoolClass: toSchoolClass(row),
      // The function builds it with this shape
      groups: (
        class_groups as { subject_id: string; label: string | null; teacher_name: string }[]
      ).map(({ subject_id, label, teacher_name }): ClassSubject => ({
        subjectId: subject_id,
        label,
        teacherName: teacher_name,
      })),
    }));
  }

  async createClass(
    draft: ClassDraft,
    subjectIds: readonly string[],
    teacherId: string,
  ): Promise<string> {
    return unwrap(
      await this.supabase.rpc('create_class', {
        class_name: draft.name.trim(),
        class_school_year: draft.schoolYear,
        subject_ids: [...subjectIds],
        group_teacher_id: teacherId,
      }),
    );
  }

  /** The RLS changes no row of a class of others, without an error. */
  async saveClass(classId: string, draft: ClassDraft): Promise<void> {
    const changed = unwrap(
      await this.supabase
        .from('school_class')
        .update({ name: draft.name.trim(), school_year: draft.schoolYear })
        .eq('id', classId)
        .select('id'),
    );
    if (changed.length === 0) throw new DataError('forbidden');
  }

  /**
   * The RLS deletes no row, without an error, of a class with groups or of others: every teacher
   * sees every class, so only one that does not exist is `not_found`.
   */
  async removeClass(classId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('school_class').delete().eq('id', classId).select('id'),
    );
    if (deleted.length > 0) return;
    const seen = unwrap(await this.supabase.from('school_class').select('id').eq('id', classId));
    throw seen.length > 0
      ? new DataError('invalid', 'Only its creator or the administration, while empty')
      : new DataError('not_found');
  }

  /** With the RPC `reopen_class`: only the administration, and `reopened` is not granted. */
  async reopenClass(classId: string, reopened: boolean): Promise<void> {
    unwrap(await this.supabase.rpc('reopen_class', { target_class_id: classId, reopen: reopened }));
  }

  async addGroup(classId: string, draft: GroupDraft): Promise<string> {
    return unwrap(
      await this.supabase.rpc('add_class_group', {
        target_class_id: classId,
        target_subject_id: draft.subjectId,
        // The function trims it and takes a blank one as none
        group_label: draft.label ?? '',
        group_teacher_id: draft.teacherId,
      }),
    );
  }

  /** A group of others is not found: the RLS of `class_group` hides it. */
  async saveGroup(groupId: string, changes: GroupChanges): Promise<void> {
    const changed = unwrap(
      await this.supabase
        .from('class_group')
        .update({ label: changes.label?.trim() || null, teacher_id: changes.teacherId })
        .eq('id', groupId)
        .select('id'),
    );
    if (changed.length === 0) throw new DataError('not_found');
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

  /** With the RPC `duplicate_class`, in one transaction (the dates move in the zone of the browser). */
  async duplicateClass(
    classId: string,
    draft: ClassDraft,
    groupIds: readonly string[],
    options: DuplicateOptions,
  ): Promise<string> {
    return unwrap(
      await this.supabase.rpc('duplicate_class', {
        source_class_id: classId,
        class_name: draft.name.trim(),
        class_school_year: draft.schoolYear,
        source_group_ids: [...groupIds],
        with_blocks: options.blocks,
        with_dates: options.dates,
        with_students: options.students,
        time_zone: localTimeZone(),
      }),
    );
  }

  async listRoster(classId: string): Promise<RosterStudent[]> {
    const rows = unwrap(await this.supabase.rpc('class_roster', { target_class_id: classId }));
    return rows.map((row) => ({
      student: { id: row.id, name: row.name, email: row.email },
      active: row.is_active,
      member: row.is_member,
      groupIds: row.group_ids,
    }));
  }

  async listCandidates(classId: string): Promise<UserRef[]> {
    return unwrap(await this.supabase.rpc('class_candidates', { target_class_id: classId }));
  }

  async matchStudents(classId: string, entries: readonly string[]): Promise<StudentMatch[]> {
    const rows = unwrap(
      await this.supabase.rpc('match_students', {
        target_class_id: classId,
        entries: [...entries],
      }),
    );
    return rows.map(({ entry, ...student }) => ({ entry, student }));
  }

  async searchStudents(target: EnrollTarget, search: string): Promise<UserRef[]> {
    const text = search.trim();
    if (text.length < MIN_STUDENT_SEARCH_LENGTH) return [];
    return unwrap(
      target.kind === 'class'
        ? await this.supabase.rpc('search_class_students', {
            search: text,
            target_class_id: target.id,
          })
        : await this.supabase.rpc('search_students', { search: text, target_group_id: target.id }),
    );
  }

  /** The limits are checked here too, so a batch the server would reject is not sent. */
  async enrollInClass(classId: string, userIds: readonly string[]): Promise<void> {
    checkBatch(userIds);
    unwrap(
      await this.supabase.rpc('enroll_class_members', {
        target_class_id: classId,
        student_ids: [...userIds],
      }),
    );
  }

  async removeFromClass(classId: string, userId: string): Promise<void> {
    unwrap(
      await this.supabase.rpc('remove_class_member', {
        target_class_id: classId,
        student_id: userId,
      }),
    );
  }

  /** With the RPC `enroll_students`, all or none, as `enrollInClass`. */
  async enroll(groupId: string, userIds: readonly string[]): Promise<void> {
    checkBatch(userIds);
    unwrap(
      await this.supabase.rpc('enroll_students', {
        target_group_id: groupId,
        student_ids: [...userIds],
      }),
    );
  }

  async unenroll(groupId: string, userId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase
        .from('enrollment')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .select('id'),
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
}

/** Between one and the maximum, each student once. */
function checkBatch(userIds: readonly string[]): void {
  if (
    userIds.length === 0 ||
    userIds.length > MAX_ENROLLMENT_BATCH ||
    new Set(userIds).size !== userIds.length
  ) {
    throw new DataError('invalid', 'Between one and the maximum, each student once');
  }
}

/** The most recent year first, then by name, as the mock service. */
function sortClasses(
  rows: readonly {
    readonly row: Parameters<typeof toSchoolClass>[0];
    readonly can_edit: boolean;
    readonly is_open: boolean;
  }[],
): { schoolClass: SchoolClass; canEdit: boolean; open: boolean }[] {
  return rows
    .map(({ row, can_edit, is_open }) => ({
      schoolClass: toSchoolClass(row),
      canEdit: can_edit,
      open: is_open,
    }))
    .sort(
      (a, b) =>
        b.schoolClass.schoolYear.localeCompare(a.schoolClass.schoolYear) ||
        a.schoolClass.name.localeCompare(b.schoolClass.name, 'es'),
    );
}
