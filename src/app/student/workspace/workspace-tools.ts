import { inject } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../core/i18n/language-service';
import { type AppTool, appTool, ToolError } from '../../core/tools/app-tool';
import { AttemptService } from '../../data/attempt-service';
import { ExerciseService } from '../../data/exercise-service';
import { exerciseText } from '../../data/localized-text';
import type { RunDetail } from '../../data/process-event';
import { reachedHintLevel } from '../../data/tutor';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import { findAssigned } from '../tools/assigned-queries';
import { AttemptStore } from './attempt-store';
import { TutorStore } from './tutor-store';

/**
 * The tools of the workspace (2.5e), provided by its route: how the student is doing with an
 * exercise, and marking the code or pointing at a part of the screen. The layout is the page's own
 * (`setLayout`, in WorkspacePage). Open to WebMCP as the contract says.
 */
export function workspaceTools(): AppTool[] {
  const exercises = inject(ExerciseService);
  const attempts = inject(AttemptService);
  const attemptStore = inject(AttemptStore);
  const tutor = inject(TutorStore);
  const userId = inject(AuthStore).userId;
  const locale = inject(LanguageService).locale;

  return [
    appTool(TUTOR_TOOL.getExerciseStats, async ({ exercise }) => {
      const id = userId();
      if (!id) throw new ToolError('The student is not signed in');
      const entries = await exercises.listAssigned(id);
      const current = attemptStore.attempt()?.assignmentId;
      const entry = exercise
        ? findAssigned(entries, exercise, locale)
        : entries.find((each) => each.assignmentId === current);
      if (!entry) throw new ToolError(`No assigned exercise matches «${exercise ?? 'this one'}»`);
      const list = await attempts.list(entry.assignmentId);
      const latest = list.at(-1);
      const history = latest ? await attempts.history(latest.id) : null;
      const runs = (history?.events ?? [])
        .filter((event) => event.type === 'run')
        .map((event) => event.detail as RunDetail);
      const interactions = history?.interactions ?? [];
      return {
        exercise: exerciseText(entry.exercise, locale).title,
        status: entry.status,
        attempts: list.map(({ number, status }) => ({ number, status })),
        runs: runs.length,
        failedRuns: runs.filter((run) => run.failed > 0).length,
        lastRun: runs.at(-1) ? { passed: runs.at(-1)!.passed, failed: runs.at(-1)!.failed } : null,
        hints: interactions.filter((interaction) => interaction.trigger === 'hint').length,
        hintLevel: reachedHintLevel(interactions),
      };
    }),
    appTool(TUTOR_TOOL.highlightLines, ({ lines }) => {
      tutor.mark(lines);
      return { marked: lines.map((mark) => mark.line) };
    }),
    appTool(TUTOR_TOOL.pointAt, ({ target, example }) => {
      if (target === 'example' && example === undefined) {
        throw new ToolError('Say which example, from 1');
      }
      tutor.pointAt(target, target === 'example' ? example : undefined);
      return { pointed: target };
    }),
  ];
}
