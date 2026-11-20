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
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from '../../core/i18n/language-service';
import { GroupService, type ManagedGroup, type RosterStudent } from '../../data/group-service';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { rosterNote, subjectLine } from './class-list';
import { EnrollDialog, type EnrollDialogData, type EnrollSource } from './enroll-dialog';
import { groupActionMessage } from './group-action-message';
import { filterStudents, STUDENT_FILTER_THRESHOLD } from './student-filter';

const SKELETON_ROWS = [1, 2, 3, 4];

/** A row of the list, with what it says besides the name and what the user may do with it. */
interface RosterRow {
  readonly entry: RosterStudent;
  readonly note: string | null;
  readonly actionsLabel: string;
  /** The groups of the user in the class, each with whether the student is in it. */
  readonly groups: readonly { readonly managed: ManagedGroup; readonly enrolled: boolean }[];
}

/**
 * The students of the class chosen (5.2d, D-081): load and fail on their own. Enrolling in the class
 * reaches every group of the whole class, those of other teachers too, and so does taking someone
 * out of it; in each group of the user, somebody can be left out (a convalidated subject) or put back.
 * The page reloads the counts of the groups after each change.
 */
@Component({
  selector: 'app-class-students',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
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
        <h2 class="text-title-medium" i18n="@@classStudents.heading">Alumnado ({{ members() }})</h2>
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
          (click)="enrollInClass()"
        >
          <mat-icon aria-hidden="true">group_add</mat-icon>
          <span i18n="@@classStudents.enroll">Matricular en la clase</span>
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
      } @else if (rows().length === 0) {
        <p
          class="py-8 text-center text-body-medium text-on-surface-variant"
          i18n="@@classStudents.none"
        >
          Esta clase aún no tiene alumnos
        </p>
      } @else {
        <!-- It scrolls in its own zone, with what the window leaves: never the page (5.4) -->
        <ul
          class="flex max-h-[max(9rem,calc(100dvh-36rem))] flex-col overflow-y-auto scroll-shadows sm:max-h-[max(12rem,calc(100dvh-31rem))]"
          aria-label="Alumnado"
          i18n-aria-label="@@groups.students.list"
        >
          @for (row of shown(); track row.entry.student.id) {
            <!-- pr-1: the touch target of the button is 4px wider than it, and would scroll sideways -->
            <li
              class="flex items-center justify-between gap-2 border-b border-outline-variant py-1 pr-1 last:border-b-0"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-body-large">
                  {{ row.entry.student.name }}
                  @if (!row.entry.active) {
                    <span
                      class="text-body-small text-on-surface-variant"
                      i18n="@@classStudents.disabled"
                      >(cuenta desactivada)</span
                    >
                  }
                </span>
                <span class="truncate text-body-small text-on-surface-variant">{{
                  row.entry.student.email
                }}</span>
                @if (row.note; as note) {
                  <span class="text-body-small text-on-surface-variant">{{ note }}</span>
                }
              </span>
              <button
                matIconButton
                type="button"
                [matMenuTriggerFor]="studentMenu"
                [attr.aria-label]="row.actionsLabel"
                [title]="row.actionsLabel"
              >
                <mat-icon aria-hidden="true">more_vert</mat-icon>
              </button>
              <mat-menu #studentMenu="matMenu" xPosition="before">
                @for (choice of row.groups; track choice.managed.group.id) {
                  @if (choice.enrolled) {
                    <button mat-menu-item type="button" (click)="unenroll(row, choice.managed)">
                      <mat-icon aria-hidden="true">person_remove</mat-icon>
                      <span i18n="@@classStudents.unenroll"
                        >Dar de baja de {{ lineOf(choice.managed) }}</span
                      >
                    </button>
                  } @else if (row.entry.active) {
                    <button mat-menu-item type="button" (click)="enroll(row, choice.managed)">
                      <mat-icon aria-hidden="true">person_add</mat-icon>
                      <span i18n="@@classStudents.enrollIn"
                        >Matricular en {{ lineOf(choice.managed) }}</span
                      >
                    </button>
                  }
                }
                @if (row.entry.member) {
                  <button mat-menu-item type="button" (click)="removeFromClass(row)">
                    <mat-icon aria-hidden="true">group_remove</mat-icon>
                    <span i18n="@@classStudents.remove">Quitar de la clase</span>
                  </button>
                } @else if (row.entry.active) {
                  <button mat-menu-item type="button" (click)="addToClass(row)">
                    <mat-icon aria-hidden="true">group_add</mat-icon>
                    <span i18n="@@classStudents.add">Añadir a la clase</span>
                  </button>
                }
              </mat-menu>
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
export class ClassStudents {
  private readonly service = inject(GroupService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LanguageService).locale;

  readonly classId = input.required<string>();
  /** «1.º DAW A · 2026/27»: what tells this class apart in the dialogs. */
  readonly className = input.required<string>();
  /** Every group of the class, those of other teachers too. */
  readonly groups = input.required<readonly ManagedGroup[]>();
  /** The other classes of the user: they can lend their students. */
  readonly sources = input.required<readonly EnrollSource[]>();
  /** The students of the class or of its groups changed: their counts too. */
  readonly changed = output();

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly students = resource({
    params: () => this.classId(),
    loader: ({ params }) => this.service.listRoster(params),
  });

  /** The list once loaded, which a reload after a change keeps until the new one arrives. */
  private readonly entries = computed(() =>
    this.students.hasValue() ? this.students.value() : [],
  );

  protected readonly rows = computed(() => {
    const groups = this.groups();
    const mine = groups.filter(({ mine }) => mine);
    return [...this.entries()]
      .sort((a, b) => a.student.name.localeCompare(b.student.name, this.locale))
      .map((entry): RosterRow => ({
        entry,
        note: rosterNote(entry, groups, this.locale),
        actionsLabel: $localize`:@@classStudents.actions:Acciones de ${entry.student.name}:name:`,
        groups: mine.map((managed) => ({
          managed,
          enrolled: entry.groupIds.includes(managed.group.id),
        })),
      }));
  });

  /** Those of the class, not of one subject only. */
  protected readonly members = computed(() => this.entries().filter(({ member }) => member).length);

  /** Nothing to show yet, as when another class is chosen: a skeleton. A reload keeps the list. */
  protected readonly firstLoad = computed(
    () => this.students.isLoading() && this.entries().length === 0,
  );

  /** Empty again for every class. */
  protected readonly filter = linkedSignal({ source: this.classId, computation: () => '' });
  /** Also while it filters: a list that drops to the threshold keeps its way back. */
  protected readonly showFilter = computed(
    () => this.rows().length > STUDENT_FILTER_THRESHOLD || this.filter() !== '',
  );
  protected readonly shown = computed(() => {
    const kept = new Set(
      filterStudents(
        this.rows().map(({ entry }) => entry),
        this.filter(),
      ),
    );
    return this.rows().filter(({ entry }) => kept.has(entry));
  });

  private readonly zone = viewChild.required<ElementRef<HTMLElement>>('zone');

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected lineOf(managed: ManagedGroup): string {
    return subjectLine(managed, this.locale);
  }

  /** Reloads the list: a new group of the whole class took the students of the class. */
  reload(): void {
    this.students.reload();
  }

  /**
   * Students into one group of the user only: a split, or a subject taken from another class. Those
   * of this class can be taken at once too.
   */
  async enrollInGroup(managed: ManagedGroup, line: string): Promise<void> {
    const groupId = managed.group.id;
    await this.openEnroll(
      {
        targetName: `${this.className()} · ${line}`,
        intro: $localize`:@@classStudents.enrollGroup.intro:Solo en esta asignatura: para un desdoble o para quien la cursa desde otra clase.`,
        enrolledIds: new Set(
          this.entries()
            .filter(({ groupIds }) => groupIds.includes(groupId))
            .map(({ student }) => student.id),
        ),
        search: (text) => this.service.searchStudents({ kind: 'group', id: groupId }, text),
        enroll: (chosen) =>
          this.service.enroll(
            groupId,
            chosen.map(({ id }) => id),
          ),
      },
      [{ id: this.classId(), label: this.className() }, ...this.sources()],
    );
  }

  protected async enrollInClass(): Promise<void> {
    const classId = this.classId();
    await this.openEnroll({
      targetName: this.className(),
      intro: $localize`:@@classStudents.enroll.intro:Entran en todas sus asignaturas, también las de otros docentes, salvo en los desdobles.`,
      enrolledIds: new Set(
        this.entries()
          .filter(({ member }) => member)
          .map(({ student }) => student.id),
      ),
      search: (text) => this.service.searchStudents({ kind: 'class', id: classId }, text),
      enroll: (chosen) =>
        this.service.enrollInClass(
          classId,
          chosen.map(({ id }) => id),
        ),
    });
  }

  /** One student into one group of the user: back after skipping it, or into a split. */
  protected async enroll(row: RosterRow, managed: ManagedGroup): Promise<void> {
    await this.act(
      () => this.service.enroll(managed.group.id, [row.entry.student.id]),
      'enroll',
      $localize`:@@classStudents.enrolled:${row.entry.student.name}:name: ya está en ${this.lineOf(managed)}:group:`,
    );
  }

  /** Asks first: the student stops seeing the group, though their work is kept (5.2a). */
  protected async unenroll(row: RosterRow, managed: ManagedGroup): Promise<void> {
    const { name } = row.entry.student;
    const group = this.lineOf(managed);
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@classStudents.unenroll.title:¿Dar de baja a ${name}:name: de ${group}:group:?`,
      text: $localize`:@@classStudents.unenroll.confirm:Dejará de ver esta asignatura, pero sigue en la clase. Su trabajo se conserva.`,
      confirm: $localize`:@@groups.unenroll:Dar de baja del grupo`,
    });
    if (!confirmed) return;
    await this.act(
      () => this.service.unenroll(managed.group.id, row.entry.student.id),
      'unenroll',
      $localize`:@@classStudents.unenrolled:${name}:name: ya no está en ${group}:group:`,
      true,
    );
  }

  /** Asks first: it reaches the groups of other teachers too. */
  protected async removeFromClass(row: RosterRow): Promise<void> {
    const { name } = row.entry.student;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@classStudents.remove.title:¿Quitar a ${name}:name: de la clase?`,
      text: $localize`:@@classStudents.remove.confirm:Saldrá de la clase y de todas sus asignaturas, también las de otros docentes. Su trabajo se conserva.`,
      confirm: $localize`:@@classStudents.remove:Quitar de la clase`,
    });
    if (!confirmed) return;
    await this.act(
      () => this.service.removeFromClass(this.classId(), row.entry.student.id),
      'unenroll',
      $localize`:@@classStudents.removed:${name}:name: ya no está en la clase`,
      true,
    );
  }

  /** A student of one subject only joins the class, and so its groups of the whole class. */
  protected async addToClass(row: RosterRow): Promise<void> {
    await this.act(
      () => this.service.enrollInClass(this.classId(), [row.entry.student.id]),
      'enroll',
      $localize`:@@classStudents.added:${row.entry.student.name}:name: ya está en la clase`,
    );
  }

  private async openEnroll(
    data: Omit<EnrollDialogData, 'sources' | 'studentsOf'>,
    sources: readonly EnrollSource[] = this.sources(),
  ): Promise<void> {
    const ref = this.dialog.open<EnrollDialog, EnrollDialogData, boolean>(EnrollDialog, {
      data: {
        ...data,
        sources,
        // A disabled account stays in its class, but the server would turn the whole batch down
        studentsOf: async (classId) =>
          (await this.service.listRoster(classId))
            .filter(({ active, member }) => active && member)
            .map(({ student }) => student),
        enroll: async (chosen) => {
          try {
            await data.enroll(chosen);
          } finally {
            this.refresh();
          }
        },
      },
      injector: this.injector,
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.snackBar.open($localize`:@@groups.enrolled:Matrícula guardada`);
    }
  }

  /** Runs an action on a row, says how it went and reloads; `focus` when its menu may be gone. */
  private async act(
    action: () => Promise<void>,
    kind: 'enroll' | 'unenroll',
    done: string,
    focus = false,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.snackBar.open(groupActionMessage(kind, error));
      this.refresh();
      return;
    }
    this.refresh();
    // The row, which had the focus, may be gone: the focus stays in the class, not on the body
    if (focus) {
      afterNextRender(() => this.zone().nativeElement.focus(), { injector: this.injector });
    }
    this.snackBar.open(done);
  }

  private refresh(): void {
    this.students.reload();
    this.changed.emit();
  }
}
