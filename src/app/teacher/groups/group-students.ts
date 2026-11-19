import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  resource,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { type EnrolledStudent, GroupService, type UserRef } from '../../data/group-service';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { EnrollDialog, type EnrollDialogData, type EnrollSource } from './enroll-dialog';
import { groupActionMessage } from './group-action-message';
import { filterStudents, STUDENT_FILTER_THRESHOLD } from './student-filter';

const SKELETON_ROWS = [1, 2, 3, 4];

function byStudentName(a: EnrolledStudent, b: EnrolledStudent): number {
  return a.student.name.localeCompare(b.student.name, 'es');
}

/**
 * The enrollment of the group chosen (ficha 11): loads and fails on its own, enrolls (also the
 * students of another group) and unenrolls, and tells the page how many there are.
 */
@Component({
  selector: 'app-group-students',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  template: `
    <!-- Focusable from code: it takes the focus of a row that leaves -->
    <div
      #zone
      tabindex="-1"
      class="flex flex-col gap-3 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      [attr.aria-busy]="students.isLoading()"
    >
      <div class="flex flex-wrap items-center gap-3">
        @if (showFilter()) {
          <mat-form-field subscriptSizing="dynamic" class="w-full sm:w-72">
            <mat-label i18n="@@groups.filter">Filtrar alumnos</mat-label>
            <mat-icon matPrefix aria-hidden="true">search</mat-icon>
            <input
              matInput
              type="search"
              autocomplete="off"
              [value]="filter()"
              (input)="onFilter($event)"
            />
          </mat-form-field>
        }
        <button
          matButton="tonal"
          type="button"
          class="sm:ml-auto"
          [disabled]="!students.hasValue()"
          (click)="enroll()"
        >
          <mat-icon aria-hidden="true">group_add</mat-icon>
          <span i18n="@@groups.enroll">Matricular alumnos</span>
        </button>
      </div>

      @if (students.error(); as error) {
        <app-load-error [error]="error" (retry)="students.reload()" />
      } @else if (firstLoad()) {
        <app-loading-skeleton label="Cargando el alumnado…" i18n-label="@@groups.students.loading">
          <div class="flex flex-col gap-2">
            @for (row of skeletonRows; track row) {
              <app-skeleton class="h-12 w-full" />
            }
          </div>
        </app-loading-skeleton>
      } @else if (entries().length === 0) {
        <p
          class="py-8 text-center text-body-medium text-on-surface-variant"
          i18n="@@groups.noStudents"
        >
          Este grupo aún no tiene alumnos
        </p>
      } @else {
        <!-- It scrolls in its own zone, with what the window leaves: never the page (5.4) -->
        <ul
          class="flex max-h-[max(12rem,calc(100dvh-25rem))] flex-col overflow-y-auto scroll-shadows"
          aria-label="Alumnado"
          i18n-aria-label="@@groups.students.list"
        >
          @for (row of shown(); track row.enrollmentId) {
            <li
              class="flex items-center justify-between gap-2 border-b border-outline-variant py-1 last:border-b-0"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-body-large">{{ row.student.name }}</span>
                <span class="truncate text-body-small text-on-surface-variant">{{
                  row.student.email
                }}</span>
              </span>
              <button
                matIconButton
                type="button"
                [attr.aria-label]="unenrollLabel(row.student)"
                [title]="unenrollLabel(row.student)"
                (click)="unenroll(row)"
              >
                <mat-icon aria-hidden="true">person_remove</mat-icon>
              </button>
            </li>
          } @empty {
            <li
              class="py-4 text-center text-body-medium text-on-surface-variant"
              i18n="@@groups.filter.none"
            >
              Nadie coincide
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class GroupStudents {
  private readonly service = inject(GroupService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  readonly groupId = input.required<string>();
  /** «Name · subject»: what tells this group apart in the dialogs. */
  readonly groupName = input.required<string>();
  /** Every group of the user: the others can lend their students. */
  readonly groups = input.required<readonly EnrollSource[]>();
  /** How many are enrolled, after each load or change. */
  readonly countChange = output<number>();

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly students = resource({
    params: () => this.groupId(),
    // Each load says the count too: after a reload it may have changed in another session
    loader: async ({ params }) => {
      const students = await this.service.listStudents(params);
      this.countChange.emit(students.length);
      return students;
    },
  });

  /** Changed in place after each action until the next load. */
  protected readonly entries = linkedSignal<readonly EnrolledStudent[]>(() =>
    this.students.hasValue() ? this.students.value() : [],
  );

  /** Nothing to show yet, as when another group is chosen: a skeleton. A reload keeps the list. */
  protected readonly firstLoad = computed(
    () => this.students.isLoading() && this.entries().length === 0,
  );

  /** Empty again for every group. */
  protected readonly filter = linkedSignal({ source: this.groupId, computation: () => '' });
  /** Also while it filters: a list that drops to the threshold keeps its way back. */
  protected readonly showFilter = computed(
    () => this.entries().length > STUDENT_FILTER_THRESHOLD || this.filter() !== '',
  );
  protected readonly shown = computed(() => filterStudents(this.entries(), this.filter()));

  private readonly zone = viewChild.required<ElementRef<HTMLElement>>('zone');

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected unenrollLabel(student: UserRef): string {
    return $localize`:@@groups.unenroll.of:Dar de baja a ${student.name}:name: del grupo`;
  }

  protected async enroll(): Promise<void> {
    const groupId = this.groupId();
    const ref = this.dialog.open<EnrollDialog, EnrollDialogData, boolean>(EnrollDialog, {
      data: {
        groupName: this.groupName(),
        enrolledIds: new Set(this.entries().map(({ student }) => student.id)),
        sources: this.groups().filter(({ id }) => id !== groupId),
        studentsOf: async (sourceId) =>
          (await this.service.listStudents(sourceId)).map(({ student }) => student),
        search: (text) => this.service.searchStudents(groupId, text),
        enroll: async (chosen) => {
          try {
            const enrolled = await this.service.enroll(
              groupId,
              chosen.map(({ id }) => id),
            );
            this.change((entries) => [...entries, ...enrolled].sort(byStudentName));
          } catch (error) {
            this.students.reload();
            throw error;
          }
        },
      },
      injector: this.injector,
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.snackBar.open($localize`:@@groups.enrolled:Matrícula guardada`);
    }
  }

  /** Asks first: the student stops seeing the group, though their work is kept (5.2a). */
  protected async unenroll(row: EnrolledStudent): Promise<void> {
    const { name } = row.student;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@groups.unenroll.title:¿Dar de baja a ${name}:name:?`,
      text: $localize`:@@groups.unenroll.confirm:${name}:name: dejará de ver este grupo. Su trabajo se conserva.`,
      confirm: $localize`:@@groups.unenroll:Dar de baja del grupo`,
    });
    if (!confirmed) return;
    try {
      await this.service.unenroll(row.enrollmentId);
    } catch (error) {
      this.snackBar.open(groupActionMessage('unenroll', error));
      this.students.reload();
      return;
    }
    this.change((entries) =>
      entries.filter(({ enrollmentId }) => enrollmentId !== row.enrollmentId),
    );
    // Its button, which had the focus, is gone: the focus stays in the group, not on the body
    afterNextRender(() => this.zone().nativeElement.focus(), { injector: this.injector });
    this.snackBar.open($localize`:@@groups.unenrolled:${name}:name: ya no está en el grupo`);
  }

  private change(
    update: (entries: readonly EnrolledStudent[]) => readonly EnrolledStudent[],
  ): void {
    this.entries.update(update);
    this.countChange.emit(this.entries().length);
  }
}
