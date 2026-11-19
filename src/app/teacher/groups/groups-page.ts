import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  viewChild,
} from '@angular/core';
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
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { DuplicateDialog, type DuplicateDialogData } from './duplicate-dialog';
import { toDuplicateOptions } from './duplicate-form';
import { groupActionMessage } from './group-action-message';
import { GroupDialog, type GroupDialogData } from './group-dialog';
import { type GroupFormModel, toClassDraft } from './group-form';
import { classOf, type GroupOption, labelGroups, sortGroups } from './group-list';
import { GroupStudents } from './group-students';
import { schoolYearOf } from './school-year';

/**
 * The groups of a teacher, or all of them for an administrator, and the enrollment of one
 * (/docente/grupos?grupo=, ficha 11, RF-16, CU-07). The group is chosen as in Bloques and
 * Histórico: a selector of «name · subject» in the URL, the first one without it.
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
    GroupStudents,
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

  /** The group chosen, from the query parameters of the URL (withComponentInputBinding). */
  readonly grupo = input<string>();

  protected readonly blocksPath = APP_PATHS.teacher.blocks;
  protected readonly isAdmin = computed(() => this.auth.role() === 'admin');

  protected readonly groups = resource({ loader: () => this.service.listGroups() });
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

  /** Changed in place after each action until the next load; the current year first. */
  private readonly entries = linkedSignal<ManagedGroup[]>(() =>
    this.groups.hasValue() ? sortGroups(this.groups.value(), this.locale) : [],
  );

  protected readonly firstLoad = computed(
    () => this.groups.isLoading() && this.entries().length === 0,
  );

  /** Without the subjects (or, for an administrator, the teachers) no group can be created. */
  protected readonly loadError = computed(
    () => this.groups.error() ?? this.subjects.error() ?? this.teachers.error(),
  );

  protected readonly ready = computed(
    () =>
      this.groups.hasValue() &&
      this.subjects.status() === 'resolved' &&
      (!this.isAdmin() || this.teachers.status() === 'resolved'),
  );

  protected readonly options = computed(() =>
    labelGroups(this.entries(), this.locale).map((option) => ({
      ...option,
      blocksQuery: { [TEACHER_PARAMS.group]: option.id },
      actionsLabel: $localize`:@@groups.actions:Acciones de ${option.label}:name:`,
    })),
  );

  /** The group of the URL or, without one (or an unknown one), the first. */
  protected readonly current = computed(() => {
    const options = this.options();
    return options.find(({ id }) => id === this.grupo()) ?? options.at(0) ?? null;
  });

  /** The other groups of the class of the one chosen: its students can be enrolled in them too. */
  protected readonly classmates = computed(() => classOf(this.options(), this.current()).slice(1));

  protected readonly emptyHeading = computed(() =>
    this.isAdmin()
      ? $localize`:@@groups.empty.admin:Aún no hay grupos`
      : $localize`:@@groups.empty:Aún no tienes grupos`,
  );

  /** Where the focus goes when the group that had it is removed. */
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Reloads what failed (and the rest, which is cheap): the page needs the three. */
  protected retry(): void {
    this.groups.reload();
    this.subjects.reload();
    this.teachers.reload();
  }

  protected select(groupId: string): void {
    void this.router.navigate([], { queryParams: { [TEACHER_PARAMS.group]: groupId } });
  }

  protected countChanged(groupId: string, studentCount: number): void {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.group.id === groupId ? { ...entry, studentCount } : entry)),
    );
  }

  protected async create(): Promise<void> {
    const subjects = this.subjects.value();
    let created: readonly ManagedGroup[] = [];
    const saved = await this.openGroupDialog({
      managed: null,
      subjects,
      teachers: this.teacherOptions(),
      defaults: {
        // The year of a new group is the current one: it can be changed
        schoolYear: schoolYearOf(new Date()),
        subjectIds: subjects.length === 1 ? [subjects[0].id] : [],
        teacherId: this.isAdmin() ? undefined : this.auth.userId(),
      },
      save: (model) =>
        this.saving(async () => {
          created = await this.service.createGroups(toClassDraft(model), model.subjectIds);
          this.add(created);
        }),
    });
    if (saved) this.announceCreated(created);
  }

  protected async edit(option: GroupOption): Promise<void> {
    const saved = await this.openGroupDialog({
      managed: option.managed,
      subjects: this.subjects.value(),
      teachers: this.teacherOptions(),
      defaults: { ...option.managed.group, subjectIds: [option.managed.group.subjectId] },
      save: (model: GroupFormModel) =>
        this.saving(async () => {
          const changed = await this.service.saveGroup({
            ...toClassDraft(model),
            id: option.id,
            subjectId: option.managed.group.subjectId,
          });
          this.entries.update((entries) =>
            sortGroups(
              entries.map((entry) => (entry.group.id === changed.group.id ? changed : entry)),
              this.locale,
            ),
          );
        }),
    });
    if (saved) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
  }

  /** For the next year or a parallel group, with what the user chooses to bring (5.2c). */
  protected async duplicate(option: GroupOption): Promise<void> {
    let created: readonly ManagedGroup[] = [];
    const ref = this.dialog.open<DuplicateDialog, DuplicateDialogData, boolean>(DuplicateDialog, {
      data: {
        source: option.managed,
        classGroups: classOf(this.options(), option).map(({ managed }) => managed),
        teachers: this.teacherOptions(),
        teacherId: this.isAdmin() ? undefined : this.auth.userId(),
        today: new Date(),
        save: (model) =>
          this.saving(async () => {
            created = await this.service.duplicateGroups(
              model.groupIds,
              toClassDraft(model),
              toDuplicateOptions(model),
            );
            this.add(created);
          }),
      },
      injector: this.injector,
    });
    if ((await firstValueFrom(ref.afterClosed())) === true) this.announceCreated(created);
  }

  protected async remove(option: GroupOption): Promise<void> {
    const name = option.label;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@groups.remove.title:¿Eliminar el grupo ${name}:name:?`,
      text: $localize`:@@groups.remove.confirm:Se eliminará «${name}:name:» con sus bloques y su matrícula. No se puede deshacer.`,
      confirm: $localize`:@@groups.remove:Eliminar`,
    });
    if (!confirmed) return;
    try {
      await this.service.removeGroup(option.id);
    } catch (error) {
      this.snackBar.open(groupActionMessage('remove', error));
      this.groups.reload();
      return;
    }
    this.entries.update((entries) => entries.filter((entry) => entry.group.id !== option.id));
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: null },
      replaceUrl: true,
    });
    // Its menu, which had the focus, is gone: back to the top of the page, not to the body
    afterNextRender(() => this.heading().nativeElement.focus(), { injector: this.injector });
    this.snackBar.open($localize`:@@groups.removed:Grupo ${name}:name: eliminado`);
  }

  private add(created: readonly ManagedGroup[]): void {
    this.entries.update((entries) => sortGroups([...entries, ...created], this.locale));
  }

  /** The first new group is chosen, and the notice says how many there are. */
  private announceCreated(created: readonly ManagedGroup[]): void {
    // Only after saving, which created one at least
    const [first] = created;
    this.select(first.group.id);
    this.snackBar.open(
      created.length === 1
        ? $localize`:@@groups.created:Grupo creado`
        : $localize`:@@groups.createdMany:${created.length}:count: grupos creados`,
    );
  }

  /** After the students of the class changed in other groups too, their counts are reloaded. */
  protected classChanged(): void {
    this.groups.reload();
  }

  private teacherOptions() {
    return this.isAdmin() ? this.teachers.value() : null;
  }

  private async openGroupDialog(data: GroupDialogData): Promise<boolean> {
    const ref = this.dialog.open<GroupDialog, GroupDialogData, boolean>(GroupDialog, {
      data,
      injector: this.injector,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** After a failure the list may be out of date (another session changed it): it reloads. */
  private async saving(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.groups.reload();
      throw error;
    }
  }
}
