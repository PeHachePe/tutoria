import { Component, computed, inject, signal } from '@angular/core';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { Router } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { blockTitle, subjectName } from '../../data/localized-text';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { LiveClass } from './live-class';
import { LiveQueue } from './live-queue';
import { LiveStore } from './live-store';
import { LiveTable } from './live-table';

/** A name without accents nor capitals, so «alvaro» finds «Álvaro». */
function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * The live session (/docente/en-vivo, ficha 06): how a group works now in a block (RF-11, CU-04).
 * It answers the two decisions of the teacher in class (D-054): who to help now (a queue, where
 * the tutor does not reach) and whether to explain something to everybody (the class exercise by
 * exercise, with the test that fails most). Below, every student in a table. It moves by itself.
 */
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

  protected readonly blockOptions = computed(() =>
    (this.store.selection()?.group.blocks ?? []).map((block) => {
      const title = blockTitle(block, this.locale);
      return {
        id: block.id,
        title: title.title,
        lang: title.locale === this.locale ? null : title.locale,
        hidden: block.isHidden,
      };
    }),
  );

  /** «1.º DAW A · Tema 1: Bucles», for the caption of the table. */
  protected readonly caption = computed(() => {
    const selection = this.store.selection();
    const block = this.blockOptions().find((option) => option.id === selection?.blockId);
    // Only shown with a selection, whose block is among the options
    return `${selection?.group.name} · ${block?.title}`;
  });

  protected readonly tableRows = computed(() => {
    const search = searchable(this.search().trim());
    return this.store.rows().filter((row) => searchable(row.student.name).includes(search));
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** A new group starts at its latest block: the block of the previous one is not in it. */
  protected selectGroup(groupId: string): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectBlock(blockId: string): void {
    void this.router.navigate([], {
      queryParams: {
        [TEACHER_PARAMS.group]: this.store.selection()?.group.id,
        [TEACHER_PARAMS.block]: blockId,
      },
      queryParamsHandling: 'merge',
    });
  }
}
