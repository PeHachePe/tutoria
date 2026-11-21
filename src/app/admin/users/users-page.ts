import {
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, type PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { ADMIN_PARAMS } from '../../core/app-paths';
import {
  AdminService,
  type DisableResult,
  type FinishedStudent,
  type UserChanges,
  type UserEntry,
} from '../../data/admin-service';
import { toUserEntry } from '../../data/admin/user-entry';
import { previousClassLine } from '../../shared/class-outcome';
import { schoolYearOf } from '../../data/school-year';
import type { UserStatus } from '../../data/user';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { pageOf } from '../../shared/page-of';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { FinishedDialog, type FinishedDialogData } from './finished-dialog';
import { NewStudentsDialog, type NewStudentsDialogData } from './new-students-dialog';
import { PasswordDialog, type PasswordDialogData } from './password-dialog';
import { roleLock } from './role-lock';
import { ROLE_LABELS, ROLES } from './role-labels';
import { userActionMessage } from './user-action-message';
import { UserDialog, type UserDialogData } from './user-dialog';
import { TrajectoryDialog, type TrajectoryDialogData } from './trajectory-dialog';
import {
  filterUsers,
  NO_USER_FILTERS,
  type StudentSituation,
  USERS_PAGE_SIZE,
  type UserFilters,
} from './user-filter';
import { toNewUser, toUserChanges } from './user-form';
import { byName, sortUsers } from './user-sort';

/** The option of the role select for every role, which has no parameter. */
const ALL_ROLES = 'all';

type StatusFilter = UserFilters['status'];

/** The value of `?estado=` of each status of the select: the active accounts have none. */
const STATUS_PARAMS: Readonly<Record<StatusFilter, string | null>> = {
  active: null,
  disabled: 'desactivadas',
  all: 'todas',
};

const STATUS_OPTIONS: readonly { readonly status: StatusFilter; readonly label: string }[] = [
  { status: 'active', label: $localize`:@@users.status.filter.active:Activas` },
  { status: 'disabled', label: $localize`:@@users.status.filter.disabled:Desactivadas` },
  { status: 'all', label: $localize`:@@users.status.filter.all:Todas` },
];

/** The situations of the students (5.2g), as the URL and the select name them. */
const SITUATION_OPTIONS: readonly {
  readonly situation: StudentSituation;
  readonly param: string;
  readonly label: string;
}[] = [
  {
    situation: 'in_class',
    param: 'en-clase',
    label: $localize`:@@users.situation.inClass:En una clase este curso`,
  },
  {
    situation: 'no_class',
    param: 'sin-clase',
    label: $localize`:@@users.situation.noClass:Sin clase este curso`,
  },
  {
    situation: 'finished',
    param: 'terminados',
    label: $localize`:@@users.situation.finished:Titulados o de baja`,
  },
];

const ALL_SITUATIONS = 'all';

/** Rows drawn while the list loads. */
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6];

/** The dialog of a list of students: room for a name and an email side by side. */
const NEW_STUDENTS_DIALOG_WIDTH = '44rem';
const NEW_STUDENTS_DIALOG_MAX_WIDTH = 'calc(100vw - 2rem)';

/** The columns of the table; the groups only from `md` (ficha 10). */
const COLUMNS = ['name', 'role', 'groups', 'actions'];

/**
 * The accounts of the centre (/admin/usuarios, ficha 10, RF-18, CU-06): create them, change their
 * name and role, reset their password and disable or enable them. What cannot change says why
 * before trying (D-072); the server checks it anyway. The filters live in the URL, and the list is
 * filtered here: it is already loaded whole (up to the 1000 rows of PostgREST).
 */
@Component({
  selector: 'app-users-page',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatSelect,
    MatOption,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatPaginator,
    MatProgressBar,
    MatTable,
    MatSort,
    MatSortHeader,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  /** The filters, from the query parameters of the URL (withComponentInputBinding). */
  readonly buscar = input<string>();
  readonly rol = input<string>();
  readonly estado = input<string>();
  readonly situacion = input<string>();
  /** The page, from 1. */
  readonly pagina = input<string>();

  protected readonly params = ADMIN_PARAMS;
  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly columns = COLUMNS;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = USERS_PAGE_SIZE;

  protected readonly users = resource({ loader: () => this.admin.listUsers() });

  /**
   * The accounts left to disable after the final evaluation (5.2g). A failure only hides the notice:
   * the list of users is what this page is for.
   */
  protected readonly finished = resource({ loader: () => this.admin.listFinishedStudents() });
  private readonly finishedStudents = computed(() =>
    this.finished.hasValue() ? this.finished.value() : [],
  );
  private readonly finishedById = computed(
    () => new Map(this.finishedStudents().map((row) => [row.student.id, row])),
  );
  protected readonly finishedCount = computed(() => this.finishedById().size);

  /**
   * The accounts, changed in place after each action until the next load. In an error state
   * `value()` throws; while it reloads, the list stays.
   */
  private readonly entries = linkedSignal<UserEntry[]>(() =>
    this.users.hasValue() ? this.users.value() : [],
  );

  /** Nothing to show yet: a skeleton instead of the filters and the table. */
  protected readonly firstLoad = computed(
    () => this.users.isLoading() && this.entries().length === 0,
  );

  protected readonly filters = computed<UserFilters>(() => ({
    search: this.buscar() ?? '',
    role: ROLES.find((role) => role === this.rol()) ?? null,
    status:
      STATUS_OPTIONS.map(({ status }) => status).find(
        (status) => STATUS_PARAMS[status] === this.estado(),
      ) ?? 'active',
    situation: SITUATION_OPTIONS.find(({ param }) => param === this.situacion())?.situation ?? null,
  }));

  /** The value of the situation select (5.2g): every account has no parameter. */
  protected readonly situationValue = computed(() => this.filters().situation ?? ALL_SITUATIONS);
  protected readonly situationOptions = SITUATION_OPTIONS;
  protected readonly allSituations = ALL_SITUATIONS;
  /** The year a class must be of for a student to be in one now. */
  private readonly schoolYear = schoolYearOf(new Date());

  /** The value of the status select: the active accounts have no parameter. */
  protected readonly statusValue = computed(() => this.filters().status);
  protected readonly statusOptions = STATUS_OPTIONS;

  /** The value of the role select; Material shows `null` as nothing chosen. */
  protected readonly roleValue = computed(() => this.filters().role ?? ALL_ROLES);
  protected readonly allRoles = ALL_ROLES;

  protected readonly hasFilters = computed(
    () =>
      this.filters().search.trim() !== '' ||
      this.filters().role !== null ||
      this.filters().situation !== null,
  );

  /** The accounts of the status chosen, before searching or choosing a role. */
  protected readonly total = computed(
    () =>
      filterUsers(
        this.entries(),
        { ...NO_USER_FILTERS, status: this.filters().status },
        this.schoolYear,
      ).length,
  );

  /** The order of the headers of the table: by name until another is chosen. */
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly matching = computed(() =>
    filterUsers(sortUsers(this.entries(), this.sort()), this.filters(), this.schoolYear),
  );

  /**
   * With nothing found, how many would be with any status (5.2g): an account looked for that is
   * disabled, or active while the disabled are shown, is not taken for one that does not exist.
   */
  protected readonly otherStatusCount = computed(() =>
    this.filters().status === 'all' || this.matching().length > 0
      ? 0
      : filterUsers(this.entries(), { ...this.filters(), status: 'all' }, this.schoolYear).length,
  );
  protected readonly otherStatusText = computed(() => {
    const count = this.otherStatusCount();
    if (this.filters().status === 'active') {
      return count === 1
        ? $localize`:@@users.empty.disabledMatch.one:Ninguna cuenta activa coincide, pero una desactivada sí.`
        : $localize`:@@users.empty.disabledMatch:Ninguna cuenta activa coincide, pero ${count}:count: desactivadas sí.`;
    }
    return count === 1
      ? $localize`:@@users.empty.activeMatch.one:Ninguna cuenta desactivada coincide, pero una activa sí.`
      : $localize`:@@users.empty.activeMatch:Ninguna cuenta desactivada coincide, pero ${count}:count: activas sí.`;
  });

  protected readonly page = computed(() =>
    pageOf(this.matching(), Number(this.pagina() ?? 1) - 1, USERS_PAGE_SIZE),
  );

  /** What each row shows, prepared here so the template only reads it. */
  protected readonly rows = computed(() => {
    const me = this.auth.userId();
    return this.page().rows.map((entry) => ({
      entry,
      id: entry.user.id,
      role: ROLE_LABELS[entry.user.role],
      // Split before the at sign: there the email breaks on a narrow screen
      emailUser: entry.user.email.slice(0, entry.user.email.indexOf('@')),
      emailDomain: entry.user.email.slice(entry.user.email.indexOf('@')),
      mine: entry.user.id === me,
      disabled: entry.user.status === 'disabled',
      groups: entry.groupNames.join(', '),
      finished: this.finishedLine(this.finishedById().get(entry.user.id)),
      hasClasses: entry.classes.length > 0,
      // An interpolated i18n attribute is not set on a Material button: the label goes in code
      actionsLabel: $localize`:@@users.actions:Acciones de ${entry.user.name}:name:`,
    }));
  });

  /** The emails with an account, to tell a new one apart before sending it (CU-06 3a). */
  private readonly takenEmails = computed(
    () => new Set(this.entries().map(({ user }) => user.email)),
  );

  protected readonly trackRow = (_index: number, row: { readonly id: string }) => row.id;

  protected onSearch(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.setFilter(ADMIN_PARAMS.search, text.trim() === '' ? null : text);
  }

  protected selectRole(value: string): void {
    this.setFilter(ADMIN_PARAMS.role, value === ALL_ROLES ? null : value);
  }

  protected selectStatus(status: StatusFilter): void {
    this.setFilter(ADMIN_PARAMS.status, STATUS_PARAMS[status]);
  }

  protected selectSituation(value: string): void {
    this.setFilter(
      ADMIN_PARAMS.situation,
      SITUATION_OPTIONS.find(({ situation }) => situation === value)?.param ?? null,
    );
  }

  /** The classes of a student year by year, with their evaluation (5.2g). */
  protected showTrajectory(entry: UserEntry): void {
    this.dialog.open<TrajectoryDialog, TrajectoryDialogData>(TrajectoryDialog, {
      data: { name: entry.user.name, classes: entry.classes },
      injector: this.injector,
    });
  }

  /** A new filter starts again at the first page: the one shown may not exist with it. */
  protected setFilter(param: string, value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [param]: value, [ADMIN_PARAMS.page]: null },
      queryParamsHandling: 'merge',
      // Typing a search should not fill the history with one entry per letter
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], {
      queryParams: {
        [ADMIN_PARAMS.search]: null,
        [ADMIN_PARAMS.role]: null,
        [ADMIN_PARAMS.status]: null,
        [ADMIN_PARAMS.situation]: null,
        [ADMIN_PARAMS.page]: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Another order starts again at the first page, like another filter. */
  protected sortBy(sort: Sort): void {
    this.sort.set(sort);
    this.setFilter(ADMIN_PARAMS.page, null);
  }

  /** The next page starts at its first row, so the focus goes back to the table (5.4). */
  protected goToPage(event: PageEvent, zone: HTMLElement): void {
    void this.router.navigate([], {
      queryParams: { [ADMIN_PARAMS.page]: event.pageIndex === 0 ? null : event.pageIndex + 1 },
      queryParamsHandling: 'merge',
    });
    zone.scrollTop = 0;
    zone.focus();
  }

  protected async create(): Promise<void> {
    const created = await this.openUserDialog({
      user: null,
      takenEmails: this.takenEmails,
      roleLock: null,
      save: (model) =>
        this.saving(async () => {
          const user = await this.admin.createUser(toNewUser(model));
          this.entries.update((entries) => [...entries, toUserEntry(user, [], [])].sort(byName));
        }),
    });
    if (created) {
      this.snackBar.open(
        $localize`:@@users.created:Cuenta creada. Entrégale la contraseña en persona.`,
      );
    }
  }

  /**
   * The accounts of a list from secretaría (5.2h). The list reloads after it: the new accounts and
   * the groups of those enrolled.
   */
  protected async createStudents(): Promise<void> {
    const ref = this.dialog.open<NewStudentsDialog, NewStudentsDialogData, number>(
      NewStudentsDialog,
      {
        data: { users: this.entries().map(({ user }) => user) },
        width: NEW_STUDENTS_DIALOG_WIDTH,
        maxWidth: NEW_STUDENTS_DIALOG_MAX_WIDTH,
        injector: this.injector,
      },
    );
    // The dialog always closes with how many it created: with none, nothing changed
    if (await firstValueFrom(ref.afterClosed())) this.users.reload();
  }

  protected async edit(entry: UserEntry): Promise<void> {
    const saved = await this.openUserDialog({
      user: entry.user,
      takenEmails: this.takenEmails,
      roleLock: roleLock(entry, this.auth.userId()),
      save: (model) => {
        const changes = toUserChanges(entry.user, model);
        return Object.keys(changes).length === 0
          ? Promise.resolve()
          : this.saving(() => this.update(entry.user.id, changes));
      },
    });
    if (saved) this.snackBar.open($localize`:@@users.saved:Cambios guardados`);
  }

  protected async resetPassword(entry: UserEntry): Promise<void> {
    const ref = this.dialog.open<PasswordDialog, PasswordDialogData, boolean>(PasswordDialog, {
      data: {
        name: entry.user.name,
        save: (password) => this.saving(() => this.update(entry.user.id, { password })),
      },
      // The dialog gets the defaults of the area, such as the outlined fields
      injector: this.injector,
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.snackBar.open(
        $localize`:@@users.passwordChanged:Contraseña cambiada. Entrégasela en persona.`,
      );
    }
  }

  /** The dialog of those who finished: all chosen; it says what was done and reloads both lists. */
  protected async reviewFinished(): Promise<void> {
    const students = this.finishedStudents();
    const ref = this.dialog.open<FinishedDialog, FinishedDialogData, DisableResult>(
      FinishedDialog,
      {
        data: { students, disable: (ids) => this.admin.disableUsers(ids) },
        injector: this.injector,
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.users.reload();
    this.finished.reload();
    const done = result.disabled.length;
    const failed = result.failed.length;
    if (failed > 0) {
      this.snackBar.open(
        $localize`:@@users.finished.partly:Desactivadas: ${done}:count:. Sin desactivar: ${failed}:failed:; vuelve a intentarlo.`,
      );
    } else {
      this.snackBar.open(
        done === 1
          ? $localize`:@@users.finished.disabled.one:1 cuenta desactivada`
          : $localize`:@@users.finished.disabled:${done}:count: cuentas desactivadas`,
      );
    }
  }

  /** Disabling asks first: the account stops signing in at once (D-072). Enabling does not. */
  protected async setStatus(entry: UserEntry, status: UserStatus): Promise<void> {
    const { name } = entry.user;
    if (status === 'disabled') {
      const confirmed = await confirmAction(this.dialog, {
        title: $localize`:@@users.disable.title:¿Desactivar la cuenta de ${name}:name:?`,
        text: $localize`:@@users.disable.confirm:${name}:name: dejará de poder entrar. Su trabajo se conserva y puedes activar la cuenta más tarde.`,
        confirm: $localize`:@@users.disable:Desactivar`,
      });
      if (!confirmed) return;
    }
    try {
      await this.saving(() => this.update(entry.user.id, { status }));
    } catch (error) {
      this.snackBar.open(userActionMessage('status', error));
      return;
    }
    this.snackBar.open(
      status === 'disabled'
        ? $localize`:@@users.disabled:Cuenta de ${name}:name: desactivada`
        : $localize`:@@users.enabled:Cuenta de ${name}:name: activada`,
    );
  }

  /** «Titula · 2.º DAW A · 2025/26», under the name of an account left to disable. */
  private finishedLine(finished: FinishedStudent | undefined): string | null {
    if (!finished) return null;
    const { outcome, className: name, schoolYear } = finished;
    return previousClassLine({ name, schoolYear, outcome });
  }

  private async openUserDialog(data: UserDialogData): Promise<boolean> {
    const ref = this.dialog.open<UserDialog, UserDialogData, boolean>(UserDialog, {
      data,
      injector: this.injector,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** The account changed, in its place: its groups do not change with it. */
  private async update(userId: string, changes: UserChanges): Promise<void> {
    const user = await this.admin.updateUser(userId, changes);
    this.entries.update((entries) =>
      entries.map((entry) => (entry.user.id === userId ? { ...entry, user } : entry)),
    );
  }

  /** After a failure the list may be out of date (another session changed it): it reloads. */
  private async saving(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.users.reload();
      throw error;
    }
  }
}
