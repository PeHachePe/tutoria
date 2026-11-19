import {
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelContent,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService, type ManagedGroup } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { groupActionMessage } from './group-action-message';
import { GroupDialog, type GroupDialogData } from './group-dialog';
import { type GroupFormModel, toGroupDraft } from './group-form';
import { GroupStudents } from './group-students';
import { schoolYearOf } from './school-year';

const SKELETON_PANELS = [1, 2, 3];

function byNameAndSubject(a: ManagedGroup, b: ManagedGroup): number {
  return (
    a.group.name.localeCompare(b.group.name, 'es') ||
    a.subject.name.localeCompare(b.subject.name, 'es')
  );
}

/**
 * The groups of a teacher, or all of them for an administrator, with their enrollment
 * (/docente/grupos, ficha 11, RF-16, CU-07). One panel open at a time, in the URL (`?grupo=`); its
 * enrollment is asked for when it opens.
 */
@Component({
  selector: 'app-groups-page',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelContent,
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

  /** The open group, from the query parameters of the URL (withComponentInputBinding). */
  readonly grupo = input<string>();

  protected readonly blocksPath = APP_PATHS.teacher.blocks;
  protected readonly skeletonPanels = SKELETON_PANELS;
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

  /** Changed in place after each action until the next load. */
  private readonly entries = linkedSignal<ManagedGroup[]>(() =>
    this.groups.hasValue() ? this.groups.value() : [],
  );

  protected readonly firstLoad = computed(
    () => this.groups.isLoading() && this.entries().length === 0,
  );

  /** What can create a group: the list, the subjects and, for an administrator, the teachers. */
  protected readonly ready = computed(
    () =>
      this.groups.hasValue() &&
      this.subjects.status() === 'resolved' &&
      (!this.isAdmin() || this.teachers.status() === 'resolved'),
  );

  /** The panel open: the URL, or the one opened since, until the URL catches up. */
  private readonly openId = linkedSignal(() => this.grupo() ?? null);

  protected readonly panels = computed(() =>
    this.entries().map((managed) => ({
      managed,
      id: managed.group.id,
      subject: subjectName(managed.subject, this.locale).name,
      blocksQuery: { [TEACHER_PARAMS.group]: managed.group.id },
      actionsLabel: $localize`:@@groups.actions:Acciones de ${managed.group.name}:name:`,
    })),
  );

  protected isOpen(groupId: string): boolean {
    return this.openId() === groupId;
  }

  protected opened(groupId: string): void {
    this.openId.set(groupId);
    this.navigate(groupId);
  }

  /** Opening another panel closes this one first: only the open one clears the URL. */
  protected closed(groupId: string): void {
    if (this.openId() !== groupId) return;
    this.openId.set(null);
    this.navigate(null);
  }

  protected countChanged(groupId: string, studentCount: number): void {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.group.id === groupId ? { ...entry, studentCount } : entry)),
    );
  }

  protected async create(): Promise<void> {
    const subjects = this.subjects.value();
    let createdId: string | null = null;
    const created = await this.openGroupDialog({
      managed: null,
      subjects,
      teachers: this.teacherOptions(),
      defaults: {
        // The year of a new group is the current one: it can be changed
        schoolYear: schoolYearOf(new Date()),
        subjectId: subjects.length === 1 ? subjects[0].id : '',
        teacherId: this.isAdmin() ? undefined : this.auth.userId(),
      },
      save: (model) =>
        this.saving(async () => {
          const managed = await this.service.saveGroup(toGroupDraft(model));
          createdId = managed.group.id;
          this.entries.update((entries) => [...entries, managed].sort(byNameAndSubject));
        }),
    });
    if (created && createdId) {
      this.opened(createdId);
      this.snackBar.open($localize`:@@groups.created:Grupo creado`);
    }
  }

  protected async edit(managed: ManagedGroup): Promise<void> {
    const saved = await this.openGroupDialog({
      managed,
      subjects: this.subjects.value(),
      teachers: this.teacherOptions(),
      defaults: managed.group,
      save: (model: GroupFormModel) =>
        this.saving(async () => {
          const changed = await this.service.saveGroup(toGroupDraft(model, managed.group.id));
          this.entries.update((entries) =>
            entries
              .map((entry) => (entry.group.id === changed.group.id ? changed : entry))
              .sort(byNameAndSubject),
          );
        }),
    });
    if (saved) this.snackBar.open($localize`:@@groups.saved:Cambios guardados`);
  }

  protected async remove(managed: ManagedGroup): Promise<void> {
    const { name } = managed.group;
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
      this.groups.reload();
      return;
    }
    this.entries.update((entries) =>
      entries.filter((entry) => entry.group.id !== managed.group.id),
    );
    this.closed(managed.group.id);
    this.snackBar.open($localize`:@@groups.removed:Grupo ${name}:name: eliminado`);
  }

  private teacherOptions() {
    return this.isAdmin() ? this.teachers.value() : null;
  }

  private navigate(groupId: string | null): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: groupId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
