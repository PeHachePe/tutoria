import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  input,
  resource,
  viewChild,
} from '@angular/core';
import type { ComponentType } from '@angular/cdk/portal';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService, type ManagedGroup } from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { ClassDialog, type ClassDialogData } from './class-dialog';
import { existingClass, toClassDraft } from './class-form';
import { type ClassOption, labelClasses, sortClassGroups, subjectLine } from './class-list';
import { ClassStudents } from './class-students';
import { DuplicateDialog, type DuplicateDialogData } from './duplicate-dialog';
import { toDuplicateOptions } from './duplicate-form';
import { groupActionMessage } from './group-action-message';
import { GroupDialog, type GroupDialogData } from './group-dialog';
import { toGroupDraft } from './group-form';
import { schoolYearOf } from './school-year';

/** A group of the class as its list shows it. */
interface GroupRow {
  readonly managed: ManagedGroup;
  readonly line: string;
  readonly actionsLabel: string;
  readonly blocksQuery: Readonly<Record<string, string>>;
}

/**
 * The classes of a teacher (those where they teach or that they created), or all of them for an
 * administrator, with their subjects and students (/docente/grupos?clase=, ficha 11, RF-16, CU-07;
 * 5.2d, D-081). A class is shared by its teachers: each group is still its teacher's, and its students
 * are kept once for all of them.
 */
@Component({
  selector: 'app-groups-page',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    RouterLink,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    ClassStudents,
  ],
  templateUrl: './groups-page.html',
})
export class GroupsPage {
  private readonly service = inject(GroupService);
  private readonly exercises = inject(ExerciseService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LanguageService).locale;

  /** The class chosen, from the query parameters of the URL (withComponentInputBinding). */
  readonly clase = input<string>();

  protected readonly blocksPath = APP_PATHS.teacher.blocks;
  protected readonly isAdmin = computed(() => this.auth.role() === 'admin');

  protected readonly classes = resource({ loader: () => this.service.listClasses() });
  private readonly subjects = resource({
    defaultValue: [],
    loader: () => this.exercises.listSubjects(),
  });
  /** Only an administrator chooses the teacher of a group: for a teacher it stays idle. */
  private readonly teachers = resource({
    defaultValue: [],
    params: () => (this.isAdmin() ? true : undefined),
    loader: () => this.service.listTeachers(),
  });

  /** A reload keeps the list until the new one arrives. */
  protected readonly firstLoad = computed(
    () => this.classes.isLoading() && !this.classes.hasValue(),
  );

  /** Without the subjects (or, for an administrator, the teachers) no group can be created. */
  protected readonly loadError = computed(
    () => this.classes.error() ?? this.subjects.error() ?? this.teachers.error(),
  );

  protected readonly ready = computed(
    () =>
      this.classes.hasValue() &&
      this.subjects.status() === 'resolved' &&
      (!this.isAdmin() || this.teachers.status() === 'resolved'),
  );

  protected readonly options = computed(() =>
    labelClasses(this.classes.hasValue() ? this.classes.value() : []).map((option) => ({
      ...option,
      actionsLabel: $localize`:@@groups.class.actions:Acciones de ${option.label}:name:`,
    })),
  );

  /** The class of the URL or, without one (or an unknown one), the first. */
  protected readonly current = computed(() => {
    const options = this.options();
    return options.find(({ id }) => id === this.clase()) ?? options.at(0) ?? null;
  });

  /** Its groups by subject, with what their menus need. */
  protected readonly groupRows = computed((): GroupRow[] => {
    const current = this.current();
    if (!current) return [];
    return sortClassGroups(current.managed.groups, this.locale).map((managed) => {
      const line = subjectLine(managed, this.locale);
      return {
        managed,
        line,
        actionsLabel: $localize`:@@groups.actions:Acciones de ${`${current.managed.schoolClass.name} · ${line}`}:name:`,
        blocksQuery: { [TEACHER_PARAMS.group]: managed.group.id },
      };
    });
  });

  /** The groups of the user in the class: those «Duplicar» copies. */
  protected readonly mine = computed(() =>
    this.groupRows()
      .filter(({ managed }) => managed.mine)
      .map(({ managed }) => managed),
  );

  /** The other classes of the user, whose students can be taken at once. */
  protected readonly sources = computed(() =>
    this.options()
      .filter(({ id }) => id !== this.current()?.id)
      .map(({ id, label }) => ({ id, label })),
  );

  protected readonly emptyHeading = computed(() =>
    this.isAdmin()
      ? $localize`:@@groups.empty.class.admin:Aún no hay clases`
      : $localize`:@@groups.empty.class:Aún no tienes clases`,
  );

  /** Where the focus goes when the class that had it is removed. */
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly students = viewChild<ClassStudents>('students');

  /** Reloads what failed (and the rest, which is cheap): the page needs the three. */
  protected retry(): void {
    this.classes.reload();
    this.subjects.reload();
    this.teachers.reload();
  }

  protected select(classId: string): void {
    void this.router.navigate([], { queryParams: { [TEACHER_PARAMS.class]: classId } });
  }

  /** The students changed: the counts of the groups too. */
  protected studentsChanged(): void {
    this.classes.reload();
  }

  /** A new class, or the one with that name and year, which the user joins with their subjects. */
  protected async createClass(): Promise<void> {
    // Without them nothing is suggested, and the server still joins the class that exists
    const classes = await this.service.listAllClasses().catch((): SchoolClass[] => []);
    let classId = '';
    let joined = false;
    const saved = await this.open<ClassDialog, ClassDialogData>(ClassDialog, {
      schoolClass: null,
      classes,
      subjects: this.subjects.value(),
      teachers: this.teacherOptions(),
      // The year of a new class is the current one: it can be changed
      schoolYear: schoolYearOf(new Date()),
      teacherId: this.isAdmin() ? undefined : this.auth.userId(),
      save: (model) =>
        this.saving(async () => {
          joined = existingClass(classes, model) !== null;
          classId = await this.service.createClass(
            toClassDraft(model),
            model.subjectIds,
            model.teacherId,
          );
        }),
    });
    if (!saved) return;
    this.select(classId);
    this.snackBar.open(
      joined
        ? $localize`:@@groups.class.joined:Asignaturas añadidas a la clase`
        : $localize`:@@groups.class.created:Clase creada`,
    );
  }

  protected async editClass(option: ClassOption): Promise<void> {
    const saved = await this.open<ClassDialog, ClassDialogData>(ClassDialog, {
      schoolClass: option.managed.schoolClass,
      classes: [],
      subjects: [],
      teachers: null,
      schoolYear: option.managed.schoolClass.schoolYear,
      teacherId: undefined,
      save: (model) => this.saving(() => this.service.saveClass(option.id, toClassDraft(model))),
    });
    if (saved) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
  }

  /** For the next year or a parallel class, with the groups of the user and what they bring. */
  protected async duplicateClass(option: ClassOption): Promise<void> {
    let classId = '';
    const saved = await this.open<DuplicateDialog, DuplicateDialogData>(DuplicateDialog, {
      source: option.managed.schoolClass,
      groups: this.mine(),
      today: new Date(),
      save: (model) =>
        this.saving(async () => {
          classId = await this.service.duplicateClass(
            option.id,
            toClassDraft(model),
            model.groupIds,
            toDuplicateOptions(model),
          );
        }),
    });
    if (!saved) return;
    this.select(classId);
    this.snackBar.open($localize`:@@groups.class.duplicated:Clase duplicada`);
  }

  /** Only a class without subjects: the menu says why otherwise. */
  protected async removeClass(option: ClassOption): Promise<void> {
    const name = option.label;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@groups.class.remove.title:¿Eliminar la clase ${name}:name:?`,
      text: $localize`:@@groups.class.remove.confirm:Se eliminará «${name}:name:» con su lista de alumnos. No se puede deshacer.`,
      confirm: $localize`:@@groups.remove:Eliminar`,
    });
    if (!confirmed) return;
    try {
      await this.service.removeClass(option.id);
    } catch (error) {
      this.snackBar.open(groupActionMessage('save', error));
      this.classes.reload();
      return;
    }
    this.classes.reload();
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.class]: null },
      replaceUrl: true,
    });
    // Its menu, which had the focus, is gone: back to the top of the page, not to the body
    afterNextRender(() => this.heading().nativeElement.focus(), { injector: this.injector });
    this.snackBar.open($localize`:@@groups.class.removed:Clase ${name}:name: eliminada`);
  }

  /** A subject of the user in the class: its group, or a split of one it has. */
  protected async addGroup(option: ClassOption): Promise<void> {
    const saved = await this.open<GroupDialog, GroupDialogData>(GroupDialog, {
      className: option.label,
      managed: null,
      siblings: option.managed.groups,
      subjects: this.subjects.value(),
      teachers: this.teacherOptions(),
      teacherId: this.isAdmin() ? undefined : this.auth.userId(),
      save: (model) =>
        this.saving(async () => {
          await this.service.addGroup(option.id, toGroupDraft(model));
        }),
    });
    if (!saved) return;
    this.students()?.reload();
    this.snackBar.open($localize`:@@groups.group.added:Asignatura añadida`);
  }

  protected async editGroup(option: ClassOption, row: GroupRow): Promise<void> {
    const saved = await this.open<GroupDialog, GroupDialogData>(GroupDialog, {
      className: option.label,
      managed: row.managed,
      siblings: option.managed.groups.filter(({ group }) => group.id !== row.managed.group.id),
      subjects: this.subjects.value(),
      teachers: this.teacherOptions(),
      teacherId: row.managed.group.teacherId,
      save: (model) =>
        this.saving(() => {
          const { label, teacherId } = toGroupDraft(model);
          return this.service.saveGroup(row.managed.group.id, { label, teacherId });
        }),
    });
    if (saved) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
  }

  protected async removeGroup(row: GroupRow): Promise<void> {
    const name = `${this.current()?.managed.schoolClass.name} · ${row.line}`;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@groups.remove.title:¿Eliminar el grupo ${name}:name:?`,
      text: $localize`:@@groups.remove.confirm:Se eliminará «${name}:name:» con sus bloques y su matrícula. No se puede deshacer.`,
      confirm: $localize`:@@groups.remove:Eliminar`,
    });
    if (!confirmed) return;
    try {
      await this.service.removeGroup(row.managed.group.id);
    } catch (error) {
      this.snackBar.open(groupActionMessage('remove', error));
      this.classes.reload();
      return;
    }
    this.classes.reload();
    this.students()?.reload();
    // Its menu, which had the focus, is gone: back to the top of the page, not to the body
    afterNextRender(() => this.heading().nativeElement.focus(), { injector: this.injector });
    this.snackBar.open($localize`:@@groups.removed:Grupo ${name}:name: eliminado`);
  }

  /** A student of another class in one group of the user: a subject they take here. */
  protected enrollInGroup(row: GroupRow): void {
    void this.students()?.enrollInGroup(row.managed, row.line);
  }

  private teacherOptions() {
    return this.isAdmin() ? this.teachers.value() : null;
  }

  private async open<C, D>(component: ComponentType<C>, data: D): Promise<boolean> {
    const ref = this.dialog.open<C, D, boolean>(component, { data, injector: this.injector });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** After saving, and after a failure (another session may have changed it), the list reloads. */
  private async saving(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } finally {
      this.classes.reload();
    }
  }
}
