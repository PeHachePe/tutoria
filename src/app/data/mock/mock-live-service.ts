import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import type { LiveGroup, LiveSnapshot, LiveUpdate } from '../live-service';
import { LiveService } from '../live-service';
import { canManageGroup, findRow } from './mock-access';
import { MockDb } from './mock-db';
import type { MockTables } from './mock-tables';
import { MockNetwork } from './mock-network';

/**
 * The live panel over MockDb. `watch()` compares the tables after each change: they are immutable,
 * so a row that is not the same object as before is new or changed. With the simulator of the dev
 * toolbar, or a student in another tab, the panel moves as with Realtime.
 */
@Service({ autoProvided: false })
export class MockLiveService extends LiveService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listGroups(): Promise<LiveGroup[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      return mockLiveGroups(this.db.tables(), (group) => canManageGroup(user, group));
    });
  }

  snapshot(groupId: string, blockId: string): Promise<LiveSnapshot> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const group = findRow(tables.groups, groupId);
      const block = findRow(tables.classBlocks, blockId);
      if (!canManageGroup(user, group) || block.groupId !== groupId) {
        throw new DataError('not_found');
      }
      const studentIds = new Set(
        tables.enrollments.filter((e) => e.groupId === groupId).map((e) => e.userId),
      );
      const assignments = tables.assignments
        .filter((assignment) => assignment.blockId === blockId)
        .sort((a, b) => a.id.localeCompare(b.id));
      const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
      const attempts = tables.attempts.filter(
        (attempt) => attempt.assignmentId !== null && assignmentIds.has(attempt.assignmentId),
      );
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      return {
        students: tables.users
          .filter((candidate) => studentIds.has(candidate.id))
          .map(({ id, name }) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        exercises: assignments.map((assignment) => ({
          assignmentId: assignment.id,
          exercise: findRow(tables.exercises, assignment.exerciseId),
          tests: tables.tests
            .filter((test) => test.exerciseId === assignment.exerciseId)
            .sort((a, b) => a.position - b.position),
        })),
        attempts,
        events: tables.events.filter((event) => attemptIds.has(event.attemptId)),
      };
    });
  }

  watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void {
    const user = this.db.currentUser();
    const group = this.db.tables().groups.find((candidate) => candidate.id === groupId);
    if (!user || !group || !canManageGroup(user, group)) {
      return () => undefined; // as the row level security, it sees nothing of the group
    }
    return this.db.onChange((tables, previous) => {
      const assignmentIds = new Set(
        tables.assignments.filter((a) => a.groupId === groupId).map((a) => a.id),
      );
      const known = new Set<object>(previous.attempts);
      const attempts = tables.attempts.filter(
        (attempt) => attempt.assignmentId !== null && assignmentIds.has(attempt.assignmentId),
      );
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      const knownEvents = new Set<object>(previous.events);
      for (const attempt of attempts.filter((row) => !known.has(row))) {
        onUpdate({ type: 'attempt', attempt });
      }
      for (const event of tables.events) {
        if (!knownEvents.has(event) && attemptIds.has(event.attemptId)) {
          onUpdate({ type: 'event', event });
        }
      }
    });
  }
}

/**
 * The groups `canSee` lets through, as the live panel lists them: by name and subject, with their
 * blocks in order and the block that moved last. The simulator of the dev toolbar uses it too.
 */
export function mockLiveGroups(
  tables: MockTables,
  canSee: (group: MockTables['groups'][number]) => boolean,
): LiveGroup[] {
  return tables.groups
    .filter(canSee)
    .map((group) => {
      const subject = findRow(tables.subjects, group.subjectId);
      const assignments = tables.assignments.filter((a) => a.groupId === group.id);
      const latest = tables.attempts
        .filter((attempt) => assignments.some((a) => a.id === attempt.assignmentId))
        .reduce<MockTables['attempts'][number] | null>(
          (best, attempt) => (best === null || attempt.updatedAt > best.updatedAt ? attempt : best),
          null,
        );
      return {
        id: group.id,
        name: group.name,
        subject,
        blocks: tables.classBlocks
          .filter((block) => block.groupId === group.id)
          .sort((a, b) => a.position - b.position),
        latestBlockId: assignments.find((a) => a.id === latest?.assignmentId)?.blockId ?? null,
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'es') || a.subject.name.localeCompare(b.subject.name, 'es'),
    );
}
