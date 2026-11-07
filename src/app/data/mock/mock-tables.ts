import type { AiProviderSetting } from '../ai-provider-setting';
import type { Attempt } from '../attempt';
import type { Exercise, ExerciseAssignment, Test } from '../exercise';
import type { ProcessEvent } from '../process-event';
import type { TutorInteraction } from '../tutor';
import type { AppUser, ClassGroup, Enrollment } from '../user';

/** Every table of the data model (2.3), as the mock data keeps them. */
export interface MockTables {
  readonly users: readonly AppUser[];
  readonly groups: readonly ClassGroup[];
  readonly enrollments: readonly Enrollment[];
  readonly exercises: readonly Exercise[];
  readonly tests: readonly Test[];
  readonly assignments: readonly ExerciseAssignment[];
  readonly attempts: readonly Attempt[];
  readonly interactions: readonly TutorInteraction[];
  readonly events: readonly ProcessEvent[];
  /** Row `ai_provider` of table `app_setting`. */
  readonly aiProvider: AiProviderSetting;
}
