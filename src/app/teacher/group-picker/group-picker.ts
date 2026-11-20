import { Component, computed, input, output } from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';

import { schoolYearOf } from '../../data/school-year';

/** A group as the picker offers it: its name in the selector and the year of its class. */
export interface GroupChoice {
  readonly id: string;
  readonly label: string;
  readonly schoolYear: string;
}

/**
 * The group a page shows (5.2e): the one of the URL or, without one (or an unknown one), the first of
 * the current year, the first of the nearest later one (prepared for next year) or, without either,
 * the first of the most recent. `groups` come the most recent year first (`compareGroups`).
 */
export function pickGroup<G extends Pick<GroupChoice, 'id' | 'schoolYear'>>(
  groups: readonly G[],
  groupId: string | undefined,
  today: Date,
): G | null {
  const current = schoolYearOf(today);
  return (
    groups.find(({ id }) => id === groupId) ??
    groups.find(({ schoolYear }) => schoolYear === current) ??
    // The nearest of the later years: the last of them, as the most recent come first
    [...groups].reverse().find(({ schoolYear }) => schoolYear > current) ??
    groups.at(0) ??
    null
  );
}

/**
 * The group of Bloques and Histórico in two levels, «Curso» and «Grupo», as the classes in Grupos
 * (5.2e): the groups of years ago do not crowd those of this year, and within a year the name of a
 * group is enough. The year only shows with more than one, and the group as a select with more
 * than one in the year (or as its name alone, if `nameAlone`).
 */
@Component({
  selector: 'app-group-picker',
  host: { class: 'flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto' },
  imports: [MatFormField, MatLabel, MatSelect, MatOption],
  template: `
    @if (years().length > 1) {
      <mat-form-field subscriptSizing="dynamic" class="w-36 shrink-0">
        <mat-label i18n="@@groupPicker.year">Curso</mat-label>
        <mat-select
          [panelWidth]="null"
          [value]="selected()?.schoolYear"
          (selectionChange)="selectYear($event.value)"
        >
          @for (year of years(); track year) {
            <mat-option [value]="year">{{ year }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
    @if (ofYear().length > 1) {
      <mat-form-field subscriptSizing="dynamic" class="min-w-0 flex-1 sm:w-[26rem] sm:flex-none">
        <mat-label i18n="@@groupPicker.group">Grupo</mat-label>
        <mat-select [value]="selected()?.id" (selectionChange)="choose.emit($event.value)">
          @for (option of ofYear(); track option.id) {
            <mat-option [value]="option.id">{{ option.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    } @else if (nameAlone()) {
      @if (selected(); as group) {
        <p class="min-w-0 text-title-medium">{{ group.label }}</p>
      }
    }
  `,
})
export class GroupPicker {
  /** The most recent year first, as the services sort them. */
  readonly groups = input.required<readonly GroupChoice[]>();
  /** The group shown, which the page picks with `pickGroup()`. */
  readonly selectedId = input<string | undefined>();
  /** Whether a year with a single group shows its name: Histórico has it in its title already. */
  readonly nameAlone = input(true);
  /** Another group chosen, or the first of another year. */
  readonly choose = output<string>();

  protected readonly selected = computed(
    () => this.groups().find(({ id }) => id === this.selectedId()) ?? null,
  );

  protected readonly years = computed(() => [
    ...new Set(this.groups().map(({ schoolYear }) => schoolYear)),
  ]);

  protected readonly ofYear = computed(() =>
    this.groups().filter(({ schoolYear }) => schoolYear === this.selected()?.schoolYear),
  );

  /** The years offered are those of the groups: one of them is always there. */
  protected selectYear(schoolYear: string): void {
    this.choose.emit(this.groups().find((group) => group.schoolYear === schoolYear)!.id);
  }
}
