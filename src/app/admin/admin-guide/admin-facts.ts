import { APP_PATHS } from '../../core/app-paths';
import type { GuideFact, GuideFacts, GuideScreen } from '../../core/guide/guide-task';
import {
  type TeacherData,
  teacherFacts,
  teacherScreen,
} from '../../teacher/teacher-guide/teacher-facts';

const { admin } = APP_PATHS;

/**
 * What the data says to the administration (2.12, D-096): it works with every group of the centre,
 * so a task is possible once something exists, whoever made it. Its tasks are done only by
 * finishing them: what the centre has does not say what the administration did.
 */
export function adminFacts(data: TeacherData): GuideFacts {
  const known = new Set<GuideFact>();
  const open = data.classes.filter((managed) => managed.open);
  if (open.some((managed) => managed.groups.length > 0)) known.add('hasClass');
  if (open.some((managed) => managed.groups.some((group) => group.studentCount > 0))) {
    known.add('hasStudents');
  }
  const withBlocks = data.plans.filter((planned) => planned.blocks.length > 0);
  if (withBlocks.length > 0) known.add('hasBlock');
  if (withBlocks.some(({ blocks }) => blocks.some((block) => block.assignments.length > 0))) {
    known.add('hasAssignment');
  }
  return {
    known,
    places: { ...teacherFacts(data).places, users: [admin.users], system: [admin.system] },
  };
}

/** The screen a URL belongs to: those of the teacher, then the two of the administration. */
export function adminScreen(url: string): GuideScreen | undefined {
  const path = url.split(/[?#]/)[0];
  if (path === admin.users) return 'users';
  if (path === admin.system) return 'system';
  return teacherScreen(url);
}
