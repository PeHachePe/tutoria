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
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { ExerciseService } from '../../data/exercise-service';
import {
  type ClassSubject,
  GroupService,
  type ManagedGroup,
  type SchoolClassEntry,
} from '../../data/group-service';
import type { SchoolClass } from '../../data/user';

import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { ClassDialog, type ClassDialogData } from './class-dialog';
import { toClassDraft } from './class-form';
import {
  classSubjectsOf,
  type ClassOption,
  labelClasses,
  sortClassGroups,
  subjectLine,
} from './class-list';
import { ClassStudents } from './class-students';
import { DuplicateDialog, type DuplicateDialogData } from './duplicate-dialog';
import { toDuplicateOptions } from './duplicate-form';
import { groupActionMessage } from './group-action-message';
import { GroupDialog, type GroupDialogData } from './group-dialog';
import { toGroupChanges } from './group-form';
import { SubjectsDialog, type SubjectsDialogData } from './subjects-dialog';
import { sortSubjects } from './subjects-form';
import { isPastSchoolYear, schoolYearOf } from '../../data/school-year';
import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';

/** The dialogs of a class and of its subjects: their texts and lists fit, never wider than the window. */
const CLASS_DIALOG_WIDTH = '32rem';
const GROUP_DIALOG_WIDTH = '32rem';
const DIALOG_MAX_WIDTH = 'calc(100vw - 2rem)';
/** «Añadir asignaturas»: always as tall, whatever is chosen; its list scrolls inside. */
const SUBJECTS_DIALOG_SIZE = {
  width: '40rem',
  height: 'min(46rem, calc(100vh - 2rem))',
  panelClass: 'app-fixed-dialog',
};

/**
 * The classes of a teacher (those where they teach or that they created), or all of them for an
 * administrator, with their subjects and students (/docente/grupos?clase=, ficha 11, RF-16, CU-07;
 * 5.2d, D-081). A class is shared by its teachers: each group is still its teacher's, and its students
 * are kept once for all of them.
 */
@Component({
  selector: 'app-groups-page',
  imports: [
    GuideAnchor,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatSelectTrigger,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    ClassStudents,
  ],
  templateUrl: './groups-page.html',
})
export class GroupsPage {
  protected readonly anchors = GUIDE_ANCHORS;
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

  /**
   * The class of the URL or, without one (or an unknown one), the first of the current year, or
   * the first of all if that year has none.
   */
  protected readonly current = computed(() => {
    const options = this.options();
    const year = schoolYearOf(new Date());
    return (
      options.find(({ id }) => id === this.clase()) ??
      options.find(({ managed }) => managed.schoolClass.schoolYear === year) ??
      options.at(0) ??
      null
    );
  });

  /**
   * The years with classes, the most recent first: the first level of the selector. Those that are
   * over have their classes closed (5.2e).
   */
  protected readonly years = computed(() =>
    [...new Set(this.options().map(({ managed }) => managed.schoolClass.schoolYear))].map(
      (value) => ({ value, past: isPastSchoolYear(value, new Date()) }),
    ),
  );

  /** The class shown is of a year that is over: closed, or reopened by the administrator. */
  protected readonly pastYear = computed(() => {
    const option = this.current();
    return !!option && isPastSchoolYear(option.managed.schoolClass.schoolYear, new Date());
  });

  /** The classes of the year shown: the second level of the selector, by name alone. */
  protected readonly classesOfYear = computed(() =>
    this.options().filter(
      ({ managed }) =>
        managed.schoolClass.schoolYear === this.current()?.managed.schoolClass.schoolYear,
    ),
  );

  /** Every group of the class by subject: the columns of its students. */
  protected readonly classGroups = computed(() =>
    sortClassGroups(this.current()?.managed.groups ?? [], this.locale),
  );

  /** The groups of the user in the class: those «Duplicar» copies. */
  protected readonly mine = computed(() => this.classGroups().filter(({ mine }) => mine));

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

  /** Another year: its first class. */
  protected selectYear(schoolYear: string): void {
    // The years offered are those of the classes: one of them is always there
    const first = this.options().find(
      ({ managed }) => managed.schoolClass.schoolYear === schoolYear,
    )!;
    this.select(first.id);
  }

  /** The students changed: the counts of the groups too. */
  protected studentsChanged(): void {
    this.classes.reload();
  }

  /**
   * A new class, or the one with that name and year, which the user joins: in both cases, the
   * subjects are chosen next, in the same dialog as «Añadir asignaturas».
   */
  protected async createClass(): Promise<void> {
    // Without them nothing is suggested, and the server still joins the class that exists
    const classes = await this.service.listAllClasses().catch((): SchoolClassEntry[] => []);
    let created: SchoolClass | null = null;
    const result = await this.openFor<ClassDialog, ClassDialogData, SchoolClassEntry | true>(
      ClassDialog,
      {
        schoolClass: null,
        classes,
        // The year of a new class is the current one: it can be changed
        schoolYear: schoolYearOf(new Date()),
        save: (model) =>
          this.saving(async () => {
            const draft = toClassDraft(model);
            // Behind the role guard: someone is signed in
            const userId = this.auth.userId()!;
            const id = await this.service.createClass(draft, [], userId);
            created = { ...draft, id, createdBy: userId, createdAt: '', reopened: false };
          }),
      },
      CLASS_DIALOG_WIDTH,
    );
    // Cancelled: with Escape it closes with nothing, with «Cancelar» with an empty value
    if (!result) return;
    if (result === true) {
      // Created, empty: chosen, and its subjects asked for at once
      const schoolClass = created!;
      this.select(schoolClass.id);
      this.snackBar.open($localize`:@@groups.class.created:Clase creada`);
      await this.addSubjects(schoolClass, []);
      return;
    }
    if (await this.addSubjects(result.schoolClass, result.groups)) {
      this.select(result.schoolClass.id);
    }
  }

  protected async editClass(option: ClassOption): Promise<void> {
    const saved = await this.openFor<ClassDialog, ClassDialogData, SchoolClassEntry | true>(
      ClassDialog,
      {
        schoolClass: option.managed.schoolClass,
        classes: [],
        schoolYear: option.managed.schoolClass.schoolYear,
        save: (model) => this.saving(() => this.service.saveClass(option.id, toClassDraft(model))),
      },
      CLASS_DIALOG_WIDTH,
    );
    if (saved === true) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
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

  /** The administrator reopens a class of a past year, or closes it again (5.2e). */
  protected async reopen(option: ClassOption, reopened: boolean): Promise<void> {
    try {
      await this.service.reopenClass(option.id, reopened);
    } catch (error) {
      this.snackBar.open(groupActionMessage('save', error));
      return;
    } finally {
      this.classes.reload();
    }
    this.snackBar.open(
      reopened
        ? $localize`:@@groups.class.reopened.done:Clase reabierta`
        : $localize`:@@groups.class.closed.done:Clase cerrada`,
    );
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

  /** «Añadir asignatura» of the class shown. */
  protected async addGroup(option: ClassOption): Promise<void> {
    await this.addSubjects(option.managed.schoolClass, classSubjectsOf(option.managed.groups));
  }

  /**
   * The one place where subjects are added to a class, whether it is shown, just created or joined:
   * each one chosen is a group of the whole class or a split. Whether something was added.
   */
  private async addSubjects(
    schoolClass: SchoolClass,
    classSubjects: readonly ClassSubject[],
  ): Promise<boolean> {
    let added = 0;
    await this.openFor<SubjectsDialog, SubjectsDialogData, boolean>(
      SubjectsDialog,
      {
        className: `${schoolClass.name} · ${schoolClass.schoolYear}`,
        classSubjects,
        subjects: sortSubjects(this.subjects.value(), this.locale),
        teachers: this.teacherOptions(),
        teacherId: this.isAdmin() ? undefined : this.auth.userId(),
        // Behind the role guard: someone is signed in
        userName: () => this.auth.user()!.name,
        add: (draft) =>
          this.saving(async () => {
            await this.service.addGroup(schoolClass.id, draft);
            added++;
          }),
      },
      SUBJECTS_DIALOG_SIZE,
    );
    // Also when it was closed after some were added and another failed
    if (added === 0) return false;
    this.students()?.reload();
    this.snackBar.open(
      added > 1
        ? $localize`:@@groups.group.addedMany:Asignaturas añadidas`
        : $localize`:@@groups.group.added:Asignatura añadida`,
    );
    return true;
  }

  protected async editGroup(option: ClassOption, managed: ManagedGroup): Promise<void> {
    const saved = await this.openFor<GroupDialog, GroupDialogData, boolean>(
      GroupDialog,
      {
        className: option.label,
        managed,
        classSubjects: classSubjectsOf(
          option.managed.groups.filter(({ group }) => group.id !== managed.group.id),
        ),
        teachers: this.teacherOptions(),
        save: (model) =>
          this.saving(() => this.service.saveGroup(managed.group.id, toGroupChanges(model))),
      },
      GROUP_DIALOG_WIDTH,
    );
    if (saved === true) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
  }

  protected async removeGroup(managed: ManagedGroup): Promise<void> {
    const name = `${this.current()?.managed.schoolClass.name} · ${subjectLine(managed, this.locale)}`;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@groups.remove.title:¿Eliminar el grupo ${name}:name:?`,
      text: $localize`:@@groups.remove.confirm:Se eliminará «${name}:name:» con sus bloques y su matrícula. No se puede deshacer.`,
      confirm: $localize`:@@groups.remove:Eliminar`,
    });
    if (!confirmed) return;
    try {
      await this.service.removeGroup(managed.group.id);
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

  private teacherOptions() {
    return this.isAdmin() ? this.teachers.value() : null;
  }

  private async open<C, D>(component: ComponentType<C>, data: D): Promise<boolean> {
    return (await this.openFor<C, D, boolean>(component, data)) === true;
  }

  /** A dialog, of the size given (never wider than the window), and what it closed with. */
  private async openFor<C, D, R>(
    component: ComponentType<C>,
    data: D,
    size?: string | MatDialogConfig,
  ): Promise<R | undefined> {
    const ref = this.dialog.open<C, D, R>(component, {
      data,
      injector: this.injector,
      ...(size && { maxWidth: DIALOG_MAX_WIDTH }),
      ...(typeof size === 'string' ? { width: size } : size),
    });
    return firstValueFrom(ref.afterClosed());
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
