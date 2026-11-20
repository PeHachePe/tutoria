import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
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
import { MatCheckbox, type MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import {
  GroupService,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  type RosterStudent,
  type UserRef,
} from '../../data/group-service';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { downloadCsv } from '../../shared/download-text';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { type RosterColumn, rosterColumns, rosterCsv, rosterFileName } from './class-list';
import { inBatches } from './enroll-choice';
import { EnrollDialog, type EnrollDialogData, type EnrollSource } from './enroll-dialog';
import { groupActionMessage } from './group-action-message';
import { filterStudents, STUDENT_FILTER_THRESHOLD } from './student-filter';

const SKELETON_ROWS = [1, 2, 3, 4];
/** The enrollment dialog: as wide as a page of the app reads well, never wider than the window. */
const ENROLL_DIALOG_WIDTH = '56rem';
const ENROLL_DIALOG_MAX_WIDTH = 'calc(100vw - 2rem)';
/** Always as tall, whatever the tab shows: room for a long list, never beyond the window. */
const ENROLL_DIALOG_HEIGHT = 'min(44rem, calc(100vh - 2rem))';

/** A column of the table, with what its head needs: the menu of the group or who teaches it. */
interface GroupColumn extends RosterColumn {
  /** Under the initials: the label of a split, the teacher and how many students. */
  readonly head: string;
  readonly actionsLabel: string;
  /** For a group of another teacher: «La da Javier Ortega Ruiz». */
  readonly ownerLabel: string;
  readonly blocksQuery: Readonly<Record<string, string>>;
}

/** A cell of the table: whether the student is in the group, and what it says of it. */
interface RosterCell {
  readonly column: GroupColumn;
  readonly enrolled: boolean;
  readonly label: string;
}

/** A row of the table, with what the user may do with it. */
interface RosterRow {
  readonly entry: RosterStudent;
  readonly cells: readonly RosterCell[];
  readonly actionsLabel: string;
}

/**
 * The students of the class chosen as a table of enrollment (5.2d, D-081): a row per student and a
 * column per group, with the initials of its subject. In the groups of the user (all, for an
 * administrator) a checkbox enrolls or unenrolls at once, with «Deshacer» in the notice; in those of
 * other teachers it only shows. Enrolling in the class reaches every group of the whole class, and
 * taking somebody out of it, every group. The list goes out as a CSV, or its emails to the
 * clipboard, the shape a pasted list takes. The page reloads the counts of the groups after each
 * change.
 */
@Component({
  selector: 'app-class-students',
  // As tall as its panel: the table takes what the bar leaves and scrolls inside
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  imports: [
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    RouterLink,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  template: `
    <!-- Focusable from code: it takes the focus of a row that leaves -->
    <div
      #zone
      tabindex="-1"
      class="flex min-h-0 flex-1 flex-col gap-3 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      [attr.aria-busy]="students.isLoading()"
    >
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-title-medium" i18n="@@classStudents.heading">Alumnado ({{ members() }})</h2>
        @if (showFilter()) {
          <mat-form-field subscriptSizing="dynamic" class="w-full sm:w-64">
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
        <div class="flex items-center gap-1 sm:ml-auto">
          @if (!readOnly()) {
            <button
              matButton="tonal"
              type="button"
              [disabled]="!students.hasValue()"
              (click)="enrollInClass()"
            >
              <mat-icon aria-hidden="true">group_add</mat-icon>
              <span i18n="@@classStudents.enroll">Matricular en la clase</span>
            </button>
            <button
              matButton="tonal"
              type="button"
              [disabled]="!canAddGroup()"
              (click)="addGroup.emit()"
            >
              <mat-icon aria-hidden="true">add</mat-icon>
              <span i18n="@@groups.group.add">Añadir asignatura</span>
            </button>
          }
          <button
            matIconButton
            type="button"
            [disabled]="rows().length === 0"
            [matMenuTriggerFor]="exportMenu"
            aria-label="Exportar el alumnado"
            i18n-aria-label="@@classStudents.export"
          >
            <mat-icon aria-hidden="true">download</mat-icon>
          </button>
          <mat-menu #exportMenu="matMenu" xPosition="before">
            <button mat-menu-item type="button" (click)="downloadList()">
              <mat-icon aria-hidden="true">table_view</mat-icon>
              <span i18n="@@classStudents.download">Descargar la lista (CSV)</span>
            </button>
            <button mat-menu-item type="button" (click)="copyEmails()">
              <mat-icon aria-hidden="true">content_copy</mat-icon>
              <span i18n="@@classStudents.copyEmails">Copiar los correos</span>
            </button>
          </mat-menu>
        </div>
      </div>

      @if (columns().length === 0) {
        <p class="text-body-medium text-on-surface-variant" i18n="@@groups.subjects.none">
          Aún no tiene asignaturas. Añade las tuyas.
        </p>
      }
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
      } @else if (rows().length === 0 && columns().length === 0) {
        <p class="py-8 text-center text-body-medium text-on-surface-variant">
          <span i18n="@@classStudents.none">Esta clase aún no tiene alumnos</span>
        </p>
      } @else {
        <!-- Also without students: the heads of the columns hold the menus of the subjects -->
        <!-- It scrolls in its own zone, both ways, with all the height the panel has; the names stay -->
        <div class="min-h-0 flex-1 overflow-auto scroll-shadows">
          <!-- The whole width: the names take what is left, each subject a column of its own width -->
          <table class="w-full border-collapse text-body-medium">
            <caption class="sr-only" i18n="@@classStudents.caption">
              Alumnado de
              {{
                className()
              }}
              y sus asignaturas
            </caption>
            <thead class="sticky top-0 z-10 bg-panel">
              <tr class="border-b border-outline-variant">
                <th
                  scope="col"
                  class="sticky left-0 z-[2] w-full min-w-40 bg-panel-column sm:min-w-56 py-2 pr-4 pl-3 text-left text-title-small"
                >
                  <span i18n="@@classStudents.student">Alumno</span>
                </th>
                @for (column of columns(); track column.managed.group.id) {
                  <th
                    scope="col"
                    class="min-w-28 px-3 py-1 text-center align-bottom whitespace-nowrap"
                    [title]="column.title"
                  >
                    <span class="sr-only">{{ column.title }}</span>
                    <span class="flex items-center justify-center">
                      <span aria-hidden="true" class="text-title-small">{{ column.initials }}</span>
                      @if (column.managed.mine) {
                        <button
                          matIconButton
                          type="button"
                          [matMenuTriggerFor]="groupMenu"
                          [attr.aria-label]="column.actionsLabel"
                        >
                          <mat-icon aria-hidden="true">more_vert</mat-icon>
                        </button>
                        <mat-menu #groupMenu="matMenu">
                          @if (!readOnly()) {
                            <button
                              mat-menu-item
                              type="button"
                              (click)="editGroup.emit(column.managed)"
                            >
                              <mat-icon aria-hidden="true">edit</mat-icon>
                              <span i18n="@@groups.edit">Editar</span>
                            </button>
                          }
                          <a
                            mat-menu-item
                            [routerLink]="blocksPath"
                            [queryParams]="column.blocksQuery"
                          >
                            <mat-icon aria-hidden="true">view_list</mat-icon>
                            <span i18n="@@groups.blocks">Ver sus bloques</span>
                          </a>
                          @if (!readOnly()) {
                            <button
                              mat-menu-item
                              type="button"
                              (click)="enrollInGroup(column.managed, column.title)"
                            >
                              <mat-icon aria-hidden="true">person_add</mat-icon>
                              <span i18n="@@groups.group.enroll">Matricular solo aquí…</span>
                            </button>
                          }
                          <!-- A closed class: only its blocks are left to see -->
                          @if (!readOnly() && column.managed.started) {
                            <!-- Its students' work is kept (5.2a): it says why, at sight, and keeps the focus -->
                            <button mat-menu-item type="button" disabled disabledInteractive>
                              <mat-icon aria-hidden="true">delete</mat-icon>
                              <span class="flex max-w-64 flex-col py-2">
                                <span i18n="@@groups.remove">Eliminar</span>
                                <span class="text-body-small" i18n="@@groups.remove.started"
                                  >No se puede eliminar: ya hay alumnos con trabajo en este
                                  grupo.</span
                                >
                              </span>
                            </button>
                          } @else if (!readOnly()) {
                            <button
                              mat-menu-item
                              type="button"
                              (click)="removeGroup.emit(column.managed)"
                            >
                              <mat-icon aria-hidden="true">delete</mat-icon>
                              <span i18n="@@groups.remove">Eliminar</span>
                            </button>
                          }
                        </mat-menu>
                      } @else {
                        <!-- Of another teacher: it says whose, at sight and to a screen reader -->
                        <mat-icon class="mx-3 text-on-surface-variant" aria-hidden="true"
                          >lock</mat-icon
                        >
                        <span class="sr-only">{{ column.ownerLabel }}</span>
                      }
                    </span>
                    <span
                      aria-hidden="true"
                      class="block text-label-small text-on-surface-variant"
                      >{{ column.head }}</span
                    >
                  </th>
                }
                <th scope="col" class="w-10">
                  <span class="sr-only" i18n="@@classStudents.actionsColumn">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of shown(); track row.entry.student.id) {
                <tr class="border-b border-outline-variant last:border-b-0">
                  <th
                    scope="row"
                    class="sticky left-0 z-[1] max-w-40 bg-panel-column sm:max-w-56 py-1 pr-2 pl-3 text-left font-normal"
                  >
                    <span
                      class="block truncate text-body-large"
                      [title]="row.entry.student.email"
                      >{{ row.entry.student.name }}</span
                    >
                    @if (!row.entry.active) {
                      <span
                        class="block text-body-small text-on-surface-variant"
                        i18n="@@classStudents.disabled"
                        >(cuenta desactivada)</span
                      >
                    } @else if (!row.entry.member) {
                      <span
                        class="block text-body-small text-on-surface-variant"
                        i18n="@@classStudents.otherClass"
                        >De otra clase</span
                      >
                    }
                  </th>
                  @for (cell of row.cells; track cell.column.managed.group.id) {
                    <td class="px-3 text-center">
                      @if (cell.column.managed.mine && !readOnly()) {
                        <mat-checkbox
                          [checked]="cell.enrolled"
                          [disabled]="!cell.enrolled && !row.entry.active"
                          [aria-label]="cell.label"
                          (change)="toggle(row, cell, $event)"
                        />
                      } @else if (cell.enrolled) {
                        <mat-icon
                          class="text-on-surface-variant"
                          role="img"
                          aria-hidden="false"
                          [attr.aria-label]="cell.label"
                          >check</mat-icon
                        >
                      } @else {
                        <span
                          class="text-on-surface-variant"
                          role="img"
                          [attr.aria-label]="cell.label"
                          >—</span
                        >
                      }
                    </td>
                  }
                  <td class="pr-1 text-right">
                    @if (!readOnly() && (row.entry.member || row.entry.active)) {
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
                        @if (row.entry.member) {
                          <button mat-menu-item type="button" (click)="removeFromClass(row)">
                            <mat-icon aria-hidden="true">group_remove</mat-icon>
                            <span i18n="@@classStudents.remove">Quitar de la clase</span>
                          </button>
                        } @else {
                          <button mat-menu-item type="button" (click)="addToClass(row)">
                            <mat-icon aria-hidden="true">group_add</mat-icon>
                            <span i18n="@@classStudents.add">Añadir a la clase</span>
                          </button>
                        }
                      </mat-menu>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td
                    [attr.colspan]="columns().length + 2"
                    class="py-4 text-center text-body-medium text-on-surface-variant"
                  >
                    @if (rows().length === 0) {
                      <!-- What to do next, not only that it is empty -->
                      <span class="flex flex-col items-center gap-1 py-6">
                        <mat-icon aria-hidden="true">group_add</mat-icon>
                        <span class="text-title-small text-on-surface" i18n="@@classStudents.none"
                          >Esta clase aún no tiene alumnos</span
                        >
                        @if (!readOnly()) {
                          <span i18n="@@classStudents.none.hint"
                            >Matricúlalos con «Matricular en la clase»: los que no tienen clase, una
                            lista pegada u otra clase.</span
                          >
                        }
                      </span>
                    } @else {
                      <span i18n="@@groups.filter.none">Nadie coincide</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ClassStudents {
  private readonly service = inject(GroupService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LanguageService).locale;

  readonly classId = input.required<string>();
  /** «1.º DAW A · 2026/27»: what tells this class apart in the dialogs. */
  readonly className = input.required<string>();
  /** Its name and year, for the name of the file. */
  readonly schoolClass = input.required<{ readonly name: string; readonly schoolYear: string }>();
  /** Every group of the class, those of other teachers too, in the order of their columns. */
  readonly groups = input.required<readonly ManagedGroup[]>();
  /** The other classes of the user: they can lend their students. */
  readonly sources = input.required<readonly EnrollSource[]>();
  /** Whether a subject can be added: the page has what its dialog needs. */
  readonly canAddGroup = input(false);
  /**
   * A class of a past year (5.2e): its students and groups are only shown, without checkboxes nor
   * anything that changes them; the blocks of the user's groups are still a link away.
   */
  readonly readOnly = input(false);
  /** The students of the class or of its groups changed: their counts too. */
  readonly changed = output();
  /** «Añadir asignatura», «Editar» and «Eliminar» of a group: the page opens their dialogs. */
  readonly addGroup = output();
  readonly editGroup = output<ManagedGroup>();
  readonly removeGroup = output<ManagedGroup>();

  protected readonly blocksPath = APP_PATHS.teacher.blocks;

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly students = resource({
    params: () => this.classId(),
    loader: ({ params }) => this.service.listRoster(params),
  });

  /** The list once loaded, which a reload after a change keeps until the new one arrives. */
  private readonly entries = computed(() =>
    this.students.hasValue() ? this.students.value() : [],
  );

  protected readonly columns = computed(() =>
    rosterColumns(this.groups(), this.locale).map((column): GroupColumn => ({
      ...column,
      head: `${column.detail} · ${column.managed.studentCount}`,
      actionsLabel: $localize`:@@groups.actions:Acciones de ${`${this.schoolClass().name} · ${column.title}`}:name:`,
      ownerLabel: $localize`:@@classStudents.owner:La da ${column.managed.teacherName}:name:`,
      blocksQuery: { [TEACHER_PARAMS.group]: column.managed.group.id },
    })),
  );

  protected readonly rows = computed(() => {
    const columns = this.columns();
    return [...this.entries()]
      .sort((a, b) => a.student.name.localeCompare(b.student.name, this.locale))
      .map((entry): RosterRow => ({
        entry,
        actionsLabel: $localize`:@@classStudents.actions:Acciones de ${entry.student.name}:name:`,
        cells: columns.map((column) => {
          const enrolled = entry.groupIds.includes(column.managed.group.id);
          const name = entry.student.name;
          const group = column.title;
          return {
            column,
            enrolled,
            label: enrolled
              ? $localize`:@@classStudents.cell.in:${name}:name: está en ${group}:group:`
              : $localize`:@@classStudents.cell.out:${name}:name: no está en ${group}:group:`,
          };
        }),
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
    await this.openEnroll({
      targetName: `${this.className()} · ${line}`,
      intro: $localize`:@@classStudents.enrollGroup.intro:Solo en esta asignatura: para un desdoble o para quien la cursa desde otra clase.`,
      enrolledIds: new Set(
        this.entries()
          .filter(({ groupIds }) => groupIds.includes(groupId))
          .map(({ student }) => student.id),
      ),
      // Those of this class who are not in it: a split, or back after leaving it
      candidates: {
        label: $localize`:@@classStudents.candidates.group:De esta clase`,
        empty: $localize`:@@classStudents.candidates.group.none:Toda la clase está ya en este grupo.`,
        load: async () =>
          this.entries()
            .filter(
              ({ active, member, groupIds }) => active && member && !groupIds.includes(groupId),
            )
            .map(({ student }) => student),
      },
      search: (text) => this.service.searchStudents({ kind: 'group', id: groupId }, text),
      enroll: (chosen) => this.inBatches(chosen, (ids) => this.service.enroll(groupId, ids)),
    });
  }

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
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
      candidates: {
        label: $localize`:@@enrollDialog.tab.candidates:Sin clase este curso`,
        empty: $localize`:@@enrollDialog.candidates.none:Todo el alumnado activo tiene ya una clase este curso.`,
        load: () => this.service.listCandidates(classId),
      },
      search: (text) => this.service.searchStudents({ kind: 'class', id: classId }, text),
      enroll: (chosen) => this.inBatches(chosen, (ids) => this.service.enrollInClass(classId, ids)),
    });
  }

  /**
   * A checkbox of a group of the user: enrolls or unenrolls at once, and the notice offers to undo
   * it. A failure puts the checkbox back.
   */
  protected async toggle(
    row: RosterRow,
    cell: RosterCell,
    event: MatCheckboxChange,
  ): Promise<void> {
    const groupId = cell.column.managed.group.id;
    const userId = row.entry.student.id;
    const enroll = () => this.service.enroll(groupId, [userId]);
    const unenroll = () => this.service.unenroll(groupId, userId);
    const { name } = row.entry.student;
    const group = cell.column.title;
    if (
      !(await this.act(event.checked ? enroll : unenroll, event.checked ? 'enroll' : 'unenroll'))
    ) {
      // After a render, which draws the click: setting it before would leave the box as clicked,
      // as its binding would not change
      afterNextRender(() => (event.source.checked = !event.checked), { injector: this.injector });
      return;
    }
    const notice = this.snackBar.open(
      event.checked
        ? $localize`:@@classStudents.enrolledShort:Alta de ${name}:name: en ${group}:group:`
        : $localize`:@@classStudents.unenrolledShort:Baja de ${name}:name: en ${group}:group:`,
      $localize`:@@classStudents.undo:Deshacer`,
    );
    const { dismissedByAction } = await firstValueFrom(notice.afterDismissed());
    if (dismissedByAction) {
      await this.act(event.checked ? unenroll : enroll, event.checked ? 'unenroll' : 'enroll');
    }
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
    const done = await this.act(
      () => this.service.removeFromClass(this.classId(), row.entry.student.id),
      'unenroll',
    );
    if (!done) return;
    // The row, which had the focus, is gone: the focus stays in the class, not on the body
    afterNextRender(() => this.zone().nativeElement.focus(), { injector: this.injector });
    this.snackBar.open($localize`:@@classStudents.removed:${name}:name: ya no está en la clase`);
  }

  /** A student of one subject only joins the class, and so its groups of the whole class. */
  protected async addToClass(row: RosterRow): Promise<void> {
    const { name } = row.entry.student;
    const done = await this.act(
      () => this.service.enrollInClass(this.classId(), [row.entry.student.id]),
      'enroll',
    );
    if (done)
      this.snackBar.open($localize`:@@classStudents.added:${name}:name: ya está en la clase`);
  }

  /** The list as a CSV file: name, email, the class and each group. */
  protected downloadList(): void {
    const { name, schoolYear } = this.schoolClass();
    downloadCsv(
      this.document,
      rosterFileName(name, schoolYear),
      rosterCsv(
        this.rows().map(({ entry }) => entry),
        this.columns(),
      ),
    );
  }

  /** The emails of the class, one per line: what «Pegar una lista» takes. */
  protected copyEmails(): void {
    const emails = this.rows()
      .filter(({ entry }) => entry.member)
      .map(({ entry }) => entry.student.email);
    this.clipboard.copy(emails.join('\n'));
    this.snackBar.open($localize`:@@classStudents.copied:${emails.length}:count: correos copiados`);
  }

  private async openEnroll(
    data: Omit<EnrollDialogData, 'sources' | 'studentsOf' | 'match'>,
  ): Promise<void> {
    const ref = this.dialog.open<EnrollDialog, EnrollDialogData, boolean>(EnrollDialog, {
      // Wide: four tabs, long lists and many chosen at once, beyond the width of a usual dialog
      width: ENROLL_DIALOG_WIDTH,
      maxWidth: ENROLL_DIALOG_MAX_WIDTH,
      height: ENROLL_DIALOG_HEIGHT,
      panelClass: 'app-fixed-dialog',
      data: {
        ...data,
        sources: this.sources(),
        // A disabled account stays in its class, but the server would turn the whole batch down
        studentsOf: async (classId) =>
          (await this.service.listRoster(classId))
            .filter(({ active, member }) => active && member)
            .map(({ student }) => student),
        match: (entries) => this.service.matchStudents(this.classId(), entries),
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

  /** In requests of the size the server takes, one after another. */
  private async inBatches(
    students: readonly UserRef[],
    enroll: (ids: readonly string[]) => Promise<void>,
  ): Promise<void> {
    const ids = students.map(({ id }) => id);
    for (const batch of inBatches(ids, MAX_ENROLLMENT_BATCH)) await enroll(batch);
  }

  /** Runs an action, says so if it fails and reloads; whether it went well. */
  private async act(action: () => Promise<void>, kind: 'enroll' | 'unenroll'): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (error) {
      this.snackBar.open(groupActionMessage(kind, error));
      return false;
    } finally {
      this.refresh();
    }
  }

  private refresh(): void {
    this.students.reload();
    this.changed.emit();
  }
}
