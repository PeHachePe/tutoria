import type { AiProviderSetting } from '../ai-provider-setting';
import type { Attempt } from '../attempt';
import type { ClassBlock, Exercise, ExerciseAssignment, Test } from '../exercise';
import type { ProcessEvent } from '../process-event';
import type { ExerciseSubject, Subject } from '../subject';
import type { TutorInteraction } from '../tutor';
import type { AppUser, ClassGroup, Enrollment } from '../user';

/** Every table of the data model (2.3), as the mock data keeps them. */
export interface MockTables {
  readonly users: readonly AppUser[];
  readonly subjects: readonly Subject[];
  readonly groups: readonly ClassGroup[];
  readonly enrollments: readonly Enrollment[];
  readonly classBlocks: readonly ClassBlock[];
  readonly exercises: readonly Exercise[];
  readonly exerciseSubjects: readonly ExerciseSubject[];
  readonly tests: readonly Test[];
  readonly assignments: readonly ExerciseAssignment[];
  readonly attempts: readonly Attempt[];
  readonly interactions: readonly TutorInteraction[];
  readonly events: readonly ProcessEvent[];
  /** Row `ai_provider` of table `app_setting`. */
  readonly aiProvider: AiProviderSetting;
}
