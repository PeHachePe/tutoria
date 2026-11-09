import { Component, computed, input, model } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import type { ExerciseDetail } from '../../../data/exercise';
import { formatCall, formatValue, isMultilineText } from '../../../shared/format-value';
import { LoadingSkeleton } from '../../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { splitInlineCode } from '../../../shared/split-inline-code';

/** Id of the zone, which the splitter under it controls. */
export const STATEMENT_ZONE_ID = 'statement-zone';

/** Example rows drawn while the exercise loads. */
const SKELETON_EXAMPLES = [1, 2, 3];

/**
 * The statement zone of the workspace (ficha 03): the text of the exercise, its visible tests as the
 * calls the student would write with the value each must return, and how many hidden checks it has
 * (2.5). On wide screens its heading folds it away, so the code gets the room; on phones it is a tab.
 */
@Component({
  selector: 'app-statement-zone',
  imports: [MatIcon, LoadingSkeleton, Skeleton],
  templateUrl: './statement-zone.html',
  host: {
    role: 'region',
    'aria-labelledby': 'statement-heading',
    '[id]': 'zoneId',
    class: 'flex min-h-0 flex-col gap-3 rounded-xl bg-panel p-4',
    // Open on a wide screen, it takes the share the splitter sets and shrinks before the code
    '[class]': "compact() ? 'h-full' : open() ? 'min-h-24 grow-0' : 'shrink-0'",
    '[style.flex-basis.%]': '!compact() && open() ? share() : null',
    '[attr.aria-busy]': 'loading()',
  },
})
export class StatementZone {
  /** The exercise, once it is there. */
  readonly detail = input<ExerciseDetail>();
  readonly loading = input(false);
  /** Phones: a tab of its own, which never folds. */
  readonly compact = input(false);
  /** Unfolded, on wide screens. */
  readonly open = model(true);
  /** Share of the column it takes while open on a wide screen, in percent. */
  readonly share = input<number>();

  protected readonly zoneId = STATEMENT_ZONE_ID;
  /** One text for both headings: a plain one on phones, the fold button on wide screens. */
  protected readonly heading = $localize`:@@workspace.statement:Enunciado`;
  protected readonly skeletonExamples = SKELETON_EXAMPLES;
  protected readonly splitInlineCode = splitInlineCode;

  protected readonly content = computed(() => {
    const detail = this.detail();
    if (!detail) return undefined;
    const { exercise, visibleTests, hiddenTestCount } = detail;
    const examples = visibleTests.map((test) => {
      const multiline = isMultilineText(test.expectedOutput);
      return {
        key: test.id,
        call: formatCall(exercise.functionName, test.input),
        expected: multiline ? test.expectedOutput : formatValue(test.expectedOutput),
        multiline,
      };
    });
    return { exercise, examples, hiddenTestCount };
  });

  protected toggle(): void {
    this.open.update((open) => !open);
  }
}
