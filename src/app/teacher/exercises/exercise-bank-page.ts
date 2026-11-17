import {
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
import { MatButton, MatFabAnchor, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, type PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { ALL_SUBJECTS, APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { DataError } from '../../data/data-error';
import type { Difficulty } from '../../data/exercise';
import {
  type BankExercise,
  type BankScope,
  type ExerciseBank,
  ExerciseService,
} from '../../data/exercise-service';
import { exerciseText, subjectName } from '../../data/localized-text';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { pageOf } from '../../shared/page-of';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import {
  AssignDialog,
  type AssignDialogData,
  type AssignDialogResult,
} from '../blocks/assign-dialog';
import { BANK_PAGE_SIZE, type BankFilters, filterBank } from './bank-filter';
import { canEditExercise } from './can-edit-exercise';

/** The option of the subject select for those of the user's groups, which has no parameter. */
const MY_SUBJECTS = 'mine';

/** What is shown before anything loads. */
const NOTHING_YET: ExerciseBank = { exercises: [], subjects: [], mySubjectIds: [] };

/** Rows drawn while the bank loads. */
const SKELETON_ROWS = [1, 2, 3, 4, 5];

const DIFFICULTIES: readonly { readonly value: Difficulty; readonly label: string }[] = [
  { value: 'initial', label: $localize`:@@difficulty.initial:Inicial` },
  { value: 'medium', label: $localize`:@@difficulty.medium:Media` },
  { value: 'advanced', label: $localize`:@@difficulty.advanced:Avanzada` },
  { value: 'extension', label: $localize`:@@difficulty.extension:Ampliación` },
];

/**
 * The exercise bank (/docente/ejercicios, ficha 08, RF-14): every exercise of every teacher, to find
 * one, open it, duplicate it or write a new one. The filters live in the URL, so coming back from
 * an exercise keeps them. Only its author or the administration edits, archives or deletes one
 * (D-057): deletes it while nobody started it, archives it once somebody did (D-060).
 */
@Component({
  selector: 'app-exercise-bank-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    MatFabAnchor,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatPaginator,
    MatProgressBar,
    DifficultyChip,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  templateUrl: './exercise-bank-page.html',
})
export class ExerciseBankPage {
  private readonly exercises = inject(ExerciseService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly locale = inject(LanguageService).locale;
  private readonly injector = inject(Injector);

  /** The filters, from the query parameters of the URL (withComponentInputBinding). */
  readonly buscar = input<string>();
  readonly asignatura = input<string>();
  readonly dificultad = input<string>();
  readonly mios = input<string>();
  readonly archivados = input<string>();
  /** The page, from 1. */
  readonly pagina = input<string>();

  protected readonly paths = APP_PATHS.teacher;
  protected readonly params = TEACHER_PARAMS;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly skeletonRows = SKELETON_ROWS;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** The part of the bank to bring: by default, the subjects of the user's groups. */
  private readonly scope = computed<BankScope>(() => {
    const subject = this.asignatura();
    if (!subject) return { kind: 'mine' };
    return subject === ALL_SUBJECTS ? { kind: 'all' } : { kind: 'subject', subjectId: subject };
  });

  /** The value of the subject select; Material shows `null` as nothing chosen. */
  protected readonly subjectValue = computed(() => this.asignatura() ?? MY_SUBJECTS);
  protected readonly mySubjects = MY_SUBJECTS;

  /** Only another part of the bank goes to the server; the other filters work on what is here. */
  protected readonly bank = resource({
    params: () => this.scope(),
    loader: ({ params }) => this.exercises.listBank(params),
  });

  /**
   * The last part of the bank that loaded: while another subject loads, the search, the filters and
   * the list stay, with a progress bar over them, instead of turning into a skeleton (4.8).
   */
  protected readonly shown = linkedSignal<ExerciseBank | undefined, ExerciseBank>({
    // In an error state `value()` throws: keep what was shown
    source: () => (this.bank.hasValue() ? this.bank.value() : undefined),
    computation: (value, previous) => value ?? previous?.value ?? NOTHING_YET,
  });

  /** Until the first part of the bank arrives, a skeleton instead of the filters and the list. */
  protected readonly firstLoad = computed(() => this.shown() === NOTHING_YET);

  protected readonly filters = computed<BankFilters>(() => ({
    search: this.buscar() ?? '',
    difficulty: DIFFICULTIES.find((option) => option.value === this.dificultad())?.value ?? null,
    mine: this.mios() !== undefined,
    archived: this.archivados() !== undefined,
  }));

  /** The archived exercises are another view of the bank, not a filter of it. */
  protected readonly archived = computed(() => this.filters().archived);

  protected readonly hasFilters = computed(() => {
    const filters = this.filters();
    return filters.search !== '' || !!filters.difficulty || filters.mine;
  });

  /** Every subject, the user's first: those are the ones they usually look for. */
  protected readonly subjectOptions = computed(() => {
    const bank = this.shown();
    const mine = new Set(bank.mySubjectIds);
    return bank.subjects
      .map((subject) => ({
        id: subject.id,
        name: subjectName(subject, this.locale).name,
        mine: mine.has(subject.id),
      }))
      .sort((a, b) => Number(b.mine) - Number(a.mine));
  });

  protected readonly allSubjects = ALL_SUBJECTS;

  /** A new exercise starts in the subject the bank shows, if it shows one. */
  protected readonly newQuery = computed(() => {
    const scope = this.scope();
    return scope.kind === 'subject' ? { [TEACHER_PARAMS.subject]: scope.subjectId } : {};
  });

  /** The total of the view, archived or not, once loaded. */
  protected readonly total = computed(
    () =>
      this.shown().exercises.filter(
        ({ exercise }) => (exercise.archivedAt !== null) === this.archived(),
      ).length,
  );

  /** Every exercise that passes the filters. */
  protected readonly matching = computed(() => {
    const bank = this.shown();
    const userId = this.auth.userId();
    const names = new Map(this.subjectOptions().map((subject) => [subject.id, subject.name]));
    return filterBank(bank.exercises, this.filters(), { locale: this.locale, userId }).map(
      (entry) => this.row(entry, names),
    );
  });

  /** The page that is shown: only its rows are drawn, however big the bank grows. */
  protected readonly page = computed(() =>
    pageOf(this.matching(), Number(this.pagina() ?? 1) - 1, BANK_PAGE_SIZE),
  );
  protected readonly rows = computed(() => this.page().rows);
  protected readonly pageSize = BANK_PAGE_SIZE;

  protected onSearch(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.setFilter(TEACHER_PARAMS.search, text.trim() === '' ? null : text);
  }

  /** A new filter starts again at the first page: the one shown may not exist with it. */
  protected selectSubjects(value: string): void {
    this.setFilter(TEACHER_PARAMS.subject, value === MY_SUBJECTS ? null : value);
  }

  protected setFilter(param: string, value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [param]: value, [TEACHER_PARAMS.page]: null },
      queryParamsHandling: 'merge',
      // Typing a search should not fill the history with one entry per letter
      replaceUrl: true,
    });
  }

  /** The next page starts at its first row, so the focus goes back to the list (5.4). */
  protected goToPage(event: PageEvent): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.page]: event.pageIndex === 0 ? null : event.pageIndex + 1 },
      queryParamsHandling: 'merge',
    });
    this.list()?.nativeElement.focus();
  }

  /** Keeps the subjects: they choose which part of the bank is here, not how it is filtered. */
  protected clearFilters(): void {
    void this.router.navigate([], {
      queryParams: {
        [TEACHER_PARAMS.search]: null,
        [TEACHER_PARAMS.difficulty]: null,
        [TEACHER_PARAMS.mine]: null,
        [TEACHER_PARAMS.page]: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected copyQuery(exerciseId: string) {
    return { [TEACHER_PARAMS.copy]: exerciseId };
  }

  /** Assigns it to a block of one of the user's groups, without leaving the bank (4.3b). */
  protected async assign(entry: BankExercise): Promise<void> {
    const text = exerciseText(entry.exercise, this.locale);
    const ref = this.dialog.open<AssignDialog, AssignDialogData, AssignDialogResult>(AssignDialog, {
      data: {
        exerciseId: entry.exercise.id,
        title: text.title,
        lang: text.locale === this.locale ? null : text.locale,
        subjectIds: entry.subjectIds,
        locale: this.locale,
      },
      // The dialog gets the defaults of the area, such as the outlined fields
      injector: this.injector,
    });
    const assigned = await firstValueFrom(ref.afterClosed());
    if (!assigned) return;
    this.snackBar.open(
      $localize`:@@bank.assign.done:Asignado a «${assigned.block}:block:» (${assigned.group}:group:)`,
    );
    // Where it is assigned shows in its card
    this.bank.reload();
  }

  /**
   * Out of the bank, with «Deshacer»; its assignments and the attempts at them stay (D-060). Or back
   * in the bank.
   */
  protected async setArchived(entry: BankExercise, archived: boolean): Promise<void> {
    try {
      this.replaceExercise(await this.exercises.setArchived(entry.exercise.id, archived));
    } catch {
      this.snackBar.open(
        $localize`:@@bank.archive.failed:No se ha podido guardar. Inténtalo de nuevo.`,
      );
      return;
    }
    if (!archived) {
      this.snackBar.open($localize`:@@bank.unarchive.done:Ejercicio devuelto al banco`);
      return;
    }
    this.snackBar
      .open($localize`:@@bank.archive.done:Ejercicio archivado`, $localize`:@@bank.undo:Deshacer`)
      .onAction()
      .subscribe(() => void this.setArchived(entry, false));
  }

  /** Asks first: deleting cannot be undone, and its assignments go with it. */
  protected async remove(entry: BankExercise): Promise<void> {
    const title = exerciseText(entry.exercise, this.locale).title;
    const assigned = entry.groups.length;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@bank.delete.title:¿Borrar «${title}:title:»?`,
      text:
        assigned > 0
          ? $localize`:@@bank.delete.assigned:Se quitará también de los bloques de ${entry.groups.map((group) => group.name).join(', ')}:groups:. No se puede deshacer.`
          : $localize`:@@bank.delete.text:Nadie lo ha empezado todavía. No se puede deshacer.`,
      confirm: $localize`:@@bank.delete.confirm:Borrar`,
    });
    if (!confirmed) return;
    try {
      await this.exercises.remove(entry.exercise.id);
      this.bank.value.update(
        (bank) =>
          bank && {
            ...bank,
            exercises: bank.exercises.filter((other) => other.exercise.id !== entry.exercise.id),
          },
      );
      this.snackBar.open($localize`:@@bank.delete.done:Ejercicio borrado`);
    } catch (error) {
      this.snackBar.open(
        error instanceof DataError && error.kind === 'invalid'
          ? $localize`:@@bank.delete.in-use:Ya está en uso: no se puede borrar, pero sí archivar`
          : $localize`:@@bank.delete.failed:No se ha podido borrar. Inténtalo de nuevo.`,
      );
    }
  }

  private replaceExercise(exercise: BankExercise['exercise']): void {
    this.bank.value.update(
      (bank) =>
        bank && {
          ...bank,
          exercises: bank.exercises.map((other) =>
            other.exercise.id === exercise.id ? { ...other, exercise } : other,
          ),
        },
    );
  }

  private row(entry: BankExercise, subjectNames: ReadonlyMap<string, string>) {
    const text = exerciseText(entry.exercise, this.locale);
    return {
      entry,
      id: entry.exercise.id,
      title: text.title,
      // An interpolated i18n attribute is not set on a Material button: the label goes in code
      actionsLabel: $localize`:@@bank.actions:Acciones de «${text.title}:title:»`,
      topics: text.topics.join(', '),
      lang: text.locale === this.locale ? null : text.locale,
      subjects: entry.subjectIds.map((id) => subjectNames.get(id)).filter((name) => !!name),
      groups: entry.groups.map((group) => group.name).join(', '),
      mine: entry.exercise.createdBy === this.auth.userId(),
      editable: canEditExercise(entry.exercise, this.auth.user()),
      archived: entry.exercise.archivedAt !== null,
      // Deleting needs nobody to have started it: their attempts keep it, and it is archived
      deletable: canEditExercise(entry.exercise, this.auth.user()) && entry.studentCount === 0,
    };
  }
}
