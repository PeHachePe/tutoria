import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import type { GuideFact, GuideFacts, GuideScreen } from '../../core/guide/guide-task';
import type { PlannedBlock, PlannedGroup } from '../../data/block-service';
import type { BankExercise } from '../../data/exercise-service';
import type { ManagedClass } from '../../data/group-service';

/** What the guided help reads of a teacher, from the queries their screens already make. */
export interface TeacherData {
  readonly userId: string;
  /** Their classes, of every year (`GroupService.listClasses()`). */
  readonly classes: readonly ManagedClass[];
  /** The whole bank: an exercise of theirs may be of any subject. */
  readonly bank: readonly BankExercise[];
  /** The blocks of each group of theirs in an open class. */
  readonly plans: readonly {
    readonly group: PlannedGroup;
    readonly blocks: readonly PlannedBlock[];
  }[];
  /** The page open: the detail of an attempt is a place only while it is open. */
  readonly url: string;
}

const { teacher } = APP_PATHS;

/**
 * What the data says about the teacher (2.12, D-093): only what is theirs counts (their classes and
 * subjects, their blocks, their exercises), not what the colleagues they share a class with did, so
 * a teacher who joins a prepared class still sees their first steps pending.
 */
export function teacherFacts({ userId, classes, bank, plans, url }: TeacherData): GuideFacts {
  const known = new Set<GuideFact>();
  const open = classes.filter((managed) => managed.open);
  const mine = open.flatMap((managed) => managed.groups.filter((group) => group.mine));
  if (open.some((managed) => managed.schoolClass.createdBy === userId) || mine.length > 0) {
    known.add('hasClass');
  }
  if (mine.some((group) => group.studentCount > 0)) known.add('hasStudents');
  const withBlocks = plans.filter((planned) => planned.blocks.length > 0);
  if (withBlocks.length > 0) known.add('hasBlock');
  if (withBlocks.some(({ blocks }) => blocks.some((block) => block.assignments.length > 0))) {
    known.add('hasAssignment');
  }
  const own = bank.filter(({ exercise }) => exercise.createdBy === userId && !exercise.archivedAt);
  if (own.length > 0) known.add('hasOwnExercise');

  return {
    known,
    places: {
      live: [teacher.live],
      history: [teacher.history],
      exercises: [teacher.exercises],
      newExercise: [teacher.newExercise],
      // A group with blocks first, for the tasks that work on one
      blocks: [
        ...withBlocks.map(({ group }) => `${teacher.blocks}?${TEACHER_PARAMS.group}=${group.id}`),
        teacher.blocks,
      ],
      groups: [teacher.groups],
      attempt: teacherScreen(url) === 'attempt' ? [url] : [],
    },
  };
}

/** The screen of the teacher a URL belongs to, also for the administration. */
export function teacherScreen(url: string): GuideScreen | undefined {
  const path = url.split(/[?#]/)[0];
  const under = (parent: string) => path.startsWith(`${parent}/`);
  if (path === teacher.live) return 'live';
  if (under(teacher.live)) return 'attempt';
  if (path === teacher.history) return 'history';
  if (path === teacher.exercises) return 'exercise-bank';
  if (under(teacher.exercises)) return 'exercise-form';
  if (path === teacher.blocks) return 'blocks';
  if (path === teacher.groups) return 'groups';
  return undefined;
}
