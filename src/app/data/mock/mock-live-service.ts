import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  LIVE_WINDOW_MINUTES,
  type LiveAttemptDetail,
  type LiveExercise,
  type LiveGroup,
  LiveService,
  type LiveSnapshot,
  type LiveUpdate,
} from '../live-service';
import { canManageGroup, classOfGroup, findRow } from './mock-access';
import { MockDb } from './mock-db';
import type { MockTables } from './mock-tables';
import { MockNetwork } from './mock-network';
import { compareGroups } from '../group-name';

const MINUTE_MS = 60_000;

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

  snapshot(groupId: string, blockId: string | null): Promise<LiveSnapshot> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const group = findRow(tables.groups, groupId);
      const blocks = tables.classBlocks
        .filter((block) => block.groupId === groupId)
        .sort((a, b) => a.position - b.position);
      if (
        !canManageGroup(user, group) ||
        (blockId !== null && !blocks.some((block) => block.id === blockId))
      ) {
        throw new DataError('not_found');
      }
      const studentIds = new Set(
        tables.enrollments.filter((e) => e.groupId === groupId).map((e) => e.userId),
      );
      const blockOrder = blocks.map((block) => block.id);
      const assignments = tables.assignments
        .filter((assignment) => assignment.groupId === groupId)
        .sort(
          (a, b) =>
            blockOrder.indexOf(a.blockId) - blockOrder.indexOf(b.blockId) ||
            a.position - b.position,
        );
      const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
      const blockIds = new Set(
        assignments.filter((a) => a.blockId === blockId).map((assignment) => assignment.id),
      );
      const from = Date.now() - LIVE_WINDOW_MINUTES * MINUTE_MS;
      const attempts = tables.attempts.filter(
        ({ assignmentId, updatedAt }) =>
          assignmentId !== null &&
          assignmentIds.has(assignmentId) &&
          (Date.parse(updatedAt) >= from || blockIds.has(assignmentId)),
      );
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      return {
        students: tables.users
          .filter((candidate) => studentIds.has(candidate.id))
          .map(({ id, name }) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        exercises: assignments.map((assignment) => liveExercise(tables, assignment)),
        attempts,
        events: tables.events.filter((event) => attemptIds.has(event.attemptId)),
        interactions: tables.interactions.filter((i) => attemptIds.has(i.attemptId)),
      };
    });
  }

  attemptDetail(attemptId: string): Promise<LiveAttemptDetail> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const attempt = findRow(tables.attempts, attemptId);
      // An attempt without assignment belongs to no group: nothing of the panel leads to it
      const assignment = findRow(tables.assignments, attempt.assignmentId ?? '');
      if (!canManageGroup(user, findRow(tables.groups, assignment.groupId))) {
        throw new DataError('not_found');
      }
      const { id, name } = findRow(tables.users, attempt.userId);
      return {
        groupId: assignment.groupId,
        blockId: assignment.blockId,
        student: { id, name },
        exercise: liveExercise(tables, assignment),
        attempt,
        siblings: tables.attempts
          .filter(
            (other) => other.userId === attempt.userId && other.assignmentId === assignment.id,
          )
          .sort((a, b) => a.number - b.number)
          .map((other) => ({ id: other.id, number: other.number })),
        events: tables.events
          .filter((event) => event.attemptId === attemptId)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
        interactions: tables.interactions
          .filter((interaction) => interaction.attemptId === attemptId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
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
      const knownInteractions = new Set<object>(previous.interactions);
      for (const attempt of attempts.filter((row) => !known.has(row))) {
        onUpdate({ type: 'attempt', attempt });
      }
      for (const event of tables.events) {
        if (!knownEvents.has(event) && attemptIds.has(event.attemptId)) {
          onUpdate({ type: 'event', event });
        }
      }
      for (const interaction of tables.interactions) {
        if (!knownInteractions.has(interaction) && attemptIds.has(interaction.attemptId)) {
          onUpdate({ type: 'interaction', interaction });
        }
      }
    });
  }
}

/** An assignment as the panel reads it: the exercise with its tests in order, and its block. */
function liveExercise(
  tables: MockTables,
  assignment: MockTables['assignments'][number],
): LiveExercise {
  return {
    assignmentId: assignment.id,
    blockId: assignment.blockId,
    exercise: findRow(tables.exercises, assignment.exerciseId),
    tests: tables.tests
      .filter((test) => test.exerciseId === assignment.exerciseId)
      .sort((a, b) => a.position - b.position),
  };
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
      const { name, schoolYear } = classOfGroup(tables, group);
      return {
        id: group.id,
        name,
        label: group.label,
        schoolYear,
        subject,
        blocks: tables.classBlocks
          .filter((block) => block.groupId === group.id)
          .sort((a, b) => a.position - b.position),
        latestBlockId: assignments.find((a) => a.id === latest?.assignmentId)?.blockId ?? null,
      };
    })
    .sort(compareGroups);
}
