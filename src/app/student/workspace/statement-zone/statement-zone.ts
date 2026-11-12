import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { LanguageService } from '../../../core/i18n/language-service';
import type { ExerciseDetail } from '../../../data/exercise';
import { exerciseText, type ContentLocale } from '../../../data/localized-text';
import { formatCall, formatValue, isMultilineText } from '../../../shared/format-value';
import { LoadingSkeleton } from '../../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { splitInlineCode } from '../../../shared/split-inline-code';
import type { Pointer } from '../tutor-store';

/** Id of the zone, which the splitter under it controls. */
export const STATEMENT_ZONE_ID = 'statement-zone';

/** Example rows drawn while the exercise loads. */
const SKELETON_EXAMPLES = [1, 2, 3];

/** The name of each language inside a sentence of the interface («solo está en inglés»). */
const LOCALE_NAMES: Record<ContentLocale, string> = {
  es: $localize`:@@locale.name.es:español`,
  en: $localize`:@@locale.name.en:inglés`,
  ca: $localize`:@@locale.name.ca:catalán`,
};

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
  /** Where the tutor points: an example or the hidden checks stand out (2.5e). */
  readonly pointer = input<Pointer | null>(null);

  private readonly locale = inject(LanguageService).locale;

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
    const { statement, locale } = exerciseText(exercise, this.locale);
    // Without a translation, the source statement, never a gap, with a note that says why (D-045)
    const untranslated =
      locale === this.locale
        ? null
        : {
            lang: locale,
            note: $localize`:@@workspace.untranslated:Este enunciado solo está en ${LOCALE_NAMES[locale]}:language:.`,
          };
    return { statement, untranslated, examples, hiddenTestCount };
  });

  /** The example the tutor points at, by its position from 1. */
  protected readonly pointedExample = computed(() => {
    const pointer = this.pointer();
    return pointer?.target === 'example' ? pointer.example : undefined;
  });
  protected readonly pointedHidden = computed(() => this.pointer()?.target === 'hiddenTests');

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    // The boundary with the DOM: what the tutor points at scrolls into sight, each time it points
    afterRenderEffect(() => {
      if (!this.pointer()) return;
      host.querySelector('[data-pointed]')?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }
}
