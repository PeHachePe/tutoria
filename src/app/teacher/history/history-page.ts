import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource } from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { Router } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { BlockService } from '../../data/block-service';
import { subjectName } from '../../data/localized-text';
import { type GroupHistory, StatsService } from '../../data/stats-service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { BlockDetail } from './block-detail';
import { HintChart } from './hint-chart';
import { hintTrend } from './hint-trend';
import { averageHints, formatAverage, isStarted, pickBlock } from './history-figures';

const EMPTY_HISTORY: GroupHistory = { students: 0, blocks: [], deadlines: [] };

/**
 * The history of a group (/docente/historico?grupo=&bloque=, ficha 09, D-073): what already
 * happened, for two decisions out of class (D-068). Whether the group gains autonomy: the chart of
 * hints, block by block, and the sentence that reads it. What to go over: the chosen block, with its
 * figures, its due date and who missed it (D-054), and its exercises one by one. Nothing ranks
 * anybody: lists of people go by name. Its state is its own (no store, 4.5): two resources, and
 * picking a block asks the server nothing.
 */
@Component({
  selector: 'app-history-page',
  imports: [
    NgTemplateOutlet,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    BlockDetail,
    EmptyState,
    HintChart,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  templateUrl: './history-page.html',
})
export class HistoryPage {
  private readonly blockService = inject(BlockService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);
  private readonly locale = inject(LanguageService).locale;

  /** The group and the block of the URL (withComponentInputBinding). */
  readonly grupo = input<string>();
  readonly bloque = input<string>();

  protected readonly groups = resource({
    loader: () => this.blockService.listGroups(),
    defaultValue: [],
  });

  /** The groups once loaded; none while they fail, when reading the value would throw. */
  private readonly groupList = computed(() => (this.groups.hasValue() ? this.groups.value() : []));

  /** The group of the URL or, without one (or an unknown one), the first. */
  protected readonly group = computed(() => {
    const groups = this.groupList();
    return groups.find((group) => group.id === this.grupo()) ?? groups.at(0) ?? null;
  });

  protected readonly subject = computed(() => {
    const group = this.group();
    if (!group) return null;
    const { name, locale } = subjectName(group.subject, this.locale);
    return { name, lang: locale === this.locale ? null : locale };
  });

  protected readonly groupOptions = computed(() =>
    this.groupList().map((group) => ({
      id: group.id,
      label: `${group.name} · ${subjectName(group.subject, this.locale).name}`,
    })),
  );

  protected readonly history = resource({
    params: () => this.group()?.id,
    loader: ({ params }) => this.statsService.groupHistory(params),
    defaultValue: EMPTY_HISTORY,
  });

  /** Only read once the history arrives: the template shows its error instead. */
  private readonly data = computed(() => this.history.value());

  protected readonly students = computed(() => this.data().students);

  /** The blocks somebody started, in order: the bars of the chart. */
  protected readonly started = computed(() => this.data().blocks.filter(isStarted));

  protected readonly selected = computed(() =>
    pickBlock(this.data().blocks, this.students(), this.bloque()),
  );

  /** The sentence that reads the chart, or null with fewer than two blocks to compare. */
  protected readonly trend = computed(() => {
    const trend = hintTrend(this.data().blocks, this.students());
    if (!trend) return null;
    const primero = formatAverage(averageHints(trend.first), this.locale);
    const ultimo = formatAverage(averageHints(trend.last), this.locale);
    switch (trend.kind) {
      case 'falling':
        return $localize`:@@history.trend.falling:Las pistas bajan de ${primero}:primero: a ${ultimo}:ultimo: por ejercicio: el grupo recurre cada vez menos a la ayuda.`;
      case 'rising':
        return $localize`:@@history.trend.rising:Las pistas suben de ${primero}:primero: a ${ultimo}:ultimo: por ejercicio: los últimos bloques piden más ayuda.`;
      default:
        return $localize`:@@history.trend.steady:El grupo pide las mismas pistas que al principio: unas ${ultimo}:ultimo: por ejercicio.`;
    }
  });

  /** The due dates of the chosen block, by date. */
  protected readonly selectedDeadlines = computed(() => {
    const blockId = this.selected()?.block.id;
    return this.data()
      .deadlines.filter((deadline) => deadline.blockId === blockId)
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  });

  protected selectGroup(groupId: string): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: null },
      queryParamsHandling: 'merge',
    });
  }
}
