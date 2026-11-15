import { inject } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language-service';
import { type AppTool, appTool, ToolError } from '../../../core/tools/app-tool';
import { exerciseText } from '../../../data/localized-text';
import { TUTOR_TOOL } from '../../../data/tutor/tutor-tools';
import { AttemptStore } from '../../../student/workspace/attempt-store';
import { exerciseStats, workspaceTools } from '../../../student/workspace/workspace-tools';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_EXERCISE } from './tryout-exercise';

/**
 * The tools of the workspace in a try (4.3e, D-061): the same ones, but `getExerciseStats` answers
 * with the try, as the teacher has no exercise assigned. There is only one exercise in a try, so it
 * is always that one.
 */
export function tryoutTools(): AppTool[] {
  const attempts = inject(TryoutAttemptService);
  const attemptStore = inject(AttemptStore);
  const exercise = inject(TRYOUT_EXERCISE).content.exercise;
  const locale = inject(LanguageService).locale;

  return [
    ...workspaceTools().filter((tool) => tool.name !== TUTOR_TOOL.getExerciseStats.name),
    appTool(TUTOR_TOOL.getExerciseStats, async () => {
      const attempt = attemptStore.attempt();
      if (!attempt) throw new ToolError('The try is not open yet');
      return exerciseStats(
        exerciseText(exercise, locale).title,
        attempt.status,
        await attempts.list(),
        await attempts.history(attempt.id),
      );
    }),
  ];
}
