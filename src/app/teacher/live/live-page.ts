import { Component, computed, inject, signal } from '@angular/core';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { Router } from '@angular/router';

import { TEACHER_ALL_BLOCKS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { blockTitle, subjectName } from '../../data/localized-text';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { searchable } from '../../shared/searchable';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { LiveActivity } from './live-activity';
import { LiveClass } from './live-class';
import { LiveFeedList } from './live-feed-list';
import { LiveQueue } from './live-queue';
import { LiveStore } from './live-store';
import { LiveTable } from './live-table';

/**
 * The live session (/docente/en-vivo, ficha 06): how a group works now (RF-11, CU-04). It answers
 * the decisions of the teacher in class (D-054, D-068): who to help now (a queue of the whole group,
 * where the tutor does not reach) and whether to explain something to everybody (the class exercise
 * by exercise in a block, or in the whole class, with the test that fails most). Below, every
 * student in a table. It moves by itself. The new screen comes in the 4.1e.
 */
const ALL_BLOCKS_LABEL = $localize`:@@live.block.all:Toda la clase`;

@Component({
  selector: 'app-live-page',
  imports: [
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSelect,
    MatOption,
    MatIcon,
    MatInput,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    LiveQueue,
    LiveClass,
    LiveActivity,
    LiveFeedList,
    LiveTable,
  ],
  templateUrl: './live-page.html',
})
export class LivePage {
  protected readonly store = inject(LiveStore);
  private readonly router = inject(Router);
  private readonly locale = inject(LanguageService).locale;

  protected readonly search = signal('');

  protected readonly groupOptions = computed(() =>
    this.store.groups().map((group) => ({
      id: group.id,
      label: `${group.name} · ${subjectName(group.subject, this.locale).name}`,
    })),
  );

  /** «Toda la clase», then every block of the group, hidden ones included. */
  protected readonly blockOptions = computed(() => [
    { id: TEACHER_ALL_BLOCKS, title: ALL_BLOCKS_LABEL, lang: null, hidden: false },
    ...this.store.blocks().map((block) => {
      const title = blockTitle(block, this.locale);
      return {
        id: block.id,
        title: title.title,
        lang: title.locale === this.locale ? null : title.locale,
        hidden: block.isHidden,
      };
    }),
  ]);

  /** The option of the block shown, `todos` with the whole class; none while it is picked. */
  protected readonly blockValue = computed(() => {
    const selection = this.store.selection();
    return selection && (selection.blockId ?? TEACHER_ALL_BLOCKS);
  });

  /** «1.º DAW A · Tema 1: Bucles» or «1.º DAW A · Toda la clase», for the caption of the table. */
  protected readonly caption = computed(() => {
    const value = this.blockValue();
    const block = this.blockOptions().find((option) => option.id === value);
    // Only shown with a selection, whose block is among the options
    return `${this.store.group()?.name} · ${block?.title}`;
  });

  /** Students who did something in the session window. */
  protected readonly inSession = computed(
    () => this.store.figures().working + this.store.figures().stopped,
  );

  protected readonly tableRows = computed(() => {
    const search = searchable(this.search().trim());
    return this.store.rows().filter((row) => searchable(row.student.name).includes(search));
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** A new group starts at the block the store picks: the block of the previous one is not in it. */
  protected selectGroup(groupId: string): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: null },
      queryParamsHandling: 'merge',
    });
  }

  /** A block of the group, or `todos` for the whole class. */
  protected selectBlock(blockId: string): void {
    void this.router.navigate([], {
      queryParams: {
        [TEACHER_PARAMS.group]: this.store.group()?.id,
        [TEACHER_PARAMS.block]: blockId,
      },
      queryParamsHandling: 'merge',
    });
  }
}
