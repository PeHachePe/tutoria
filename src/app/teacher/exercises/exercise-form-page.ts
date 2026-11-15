import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField, FormRoot } from '@angular/forms/signals';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { appTool, declareAppTool, ToolError } from '../../core/tools/app-tool';
import type { WithUnsavedChanges } from '../../core/unsaved-changes-guard';
import { DataError } from '../../data/data-error';
import type { Difficulty } from '../../data/exercise';
import { ExerciseService, type ExerciseWithTests } from '../../data/exercise-service';
import { type ContentLocale, subjectName } from '../../data/localized-text';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { testStates } from '../../student/workspace/code-zone/run-results';
import { canEditExercise } from './can-edit-exercise';
import {
  CONTENT_LOCALES,
  copyFormModel,
  emptyFormModel,
  type ExerciseFormModel,
  previewContent,
  solutionSkeleton,
  splitList,
  toDraft,
  toFormModel,
  toSolutionCheck,
} from './exercise-form-model';
import { EXERCISE_LIMITS, exerciseSchema } from './exercise-form-schema';
import { FILL_EXERCISE_FORM, fillFormModel, subjectsByName } from './exercise-form-tool';
import { type ExercisePreviewData, ExercisePreviewDialog } from './exercise-preview-dialog';
import { openTryout } from './tryout/exercise-tryout-dialog';
import { ExerciseTestList } from './exercise-test-list';
import { ExerciseTexts } from './exercise-texts';
import { type CheckRun, type CheckTarget, SolutionCheck } from './solution-check';

/** What the form does with the exercise it shows. */
export type FormMode = 'new' | 'copy' | 'edit' | 'view';

const DIFFICULTIES: readonly { readonly value: Difficulty; readonly label: string }[] = [
  { value: 'initial', label: $localize`:@@difficulty.initial:Inicial` },
  { value: 'medium', label: $localize`:@@difficulty.medium:Media` },
  { value: 'advanced', label: $localize`:@@difficulty.advanced:Avanzada` },
  { value: 'extension', label: $localize`:@@difficulty.extension:Ampliación` },
];

const HEADINGS: Readonly<Record<FormMode, string>> = {
  new: $localize`:@@exerciseForm.heading.new:Nuevo ejercicio`,
  copy: $localize`:@@exerciseForm.heading.copy:Nuevo ejercicio a partir de otro`,
  edit: $localize`:@@exerciseForm.heading.edit:Editar el ejercicio`,
  view: $localize`:@@exerciseForm.heading.view:Ejercicio de otro docente`,
};

/** As wide as the statement zone of the workspace on a laptop. */
const PREVIEW_WIDTH = '40rem';

/** Skeleton blocks while the exercise loads: the two columns of the form. */
const SKELETON_BLOCKS = [1, 2];

/**
 * The exercise form (/docente/ejercicios/nuevo and /docente/ejercicios/:id, ficha 08, RF-14,
 * RF-17, CU-05): the texts in each language, its function, its tests and the thresholds of the
 * proactive tutor, as in Figure 20 of the report. The form lives here, with Signal Forms; its long
 * parts (the texts and the tests) are components that edit their branch of it (4.6).
 */
@Component({
  selector: 'app-exercise-form-page',
  imports: [
    RouterLink,
    FormRoot,
    FormField,
    MatAnchor,
    MatButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlider,
    MatSliderThumb,
    MatIcon,
    MatTooltip,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    ExerciseTexts,
    ExerciseTestList,
    SolutionCheck,
  ],
  templateUrl: './exercise-form-page.html',
  host: {
    // Closing or reloading the tab is not a navigation: only the browser can ask then
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
})
export class ExerciseFormPage implements WithUnsavedChanges {
  private readonly exercises = inject(ExerciseService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly locale = inject(LanguageService).locale;
  private readonly injector = inject(Injector);
  private readonly texts = viewChild<ExerciseTexts>('texts');

  /** The exercise to edit (route parameter); without it, a new one. */
  readonly exerciseId = input<string>();
  /** The exercise a new one copies («Duplicar»), from `?copia=`. */
  readonly copia = input<string>();
  /** The subject the bank showed, chosen beforehand for a new exercise (`?asignatura=`). */
  readonly asignatura = input<string>();

  protected readonly paths = APP_PATHS.teacher;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly limits = EXERCISE_LIMITS;
  protected readonly skeletonBlocks = SKELETON_BLOCKS;

  protected readonly data = resource({
    params: () => ({ id: this.exerciseId() ?? this.copia() }),
    loader: async ({ params }) => {
      const [subjects, entry] = await Promise.all([
        this.exercises.listSubjects(),
        params.id ? this.exercises.getWithTests(params.id) : Promise.resolve(null),
      ]);
      return { subjects, entry };
    },
  });

  /** What loaded, or nothing: in an error state `value()` throws, and the heading reads this first. */
  private readonly loadedData = computed(() =>
    this.data.hasValue() ? this.data.value() : undefined,
  );

  protected readonly mode = computed<FormMode>(() => {
    const entry = this.loadedData()?.entry;
    if (this.exerciseId() === undefined) return entry ? 'copy' : 'new';
    return entry && !canEditExercise(entry.exercise, this.auth.user()) ? 'view' : 'edit';
  });

  protected readonly heading = computed(() => HEADINGS[this.mode()]);

  /** The exercise as loaded: what «Restablecer» and the unsaved changes compare with. */
  private readonly loaded = computed(() =>
    initialModel(this.mode(), this.loadedData()?.entry, this.locale, this.knownSubject()),
  );

  /** Every subject, once loaded. */
  private readonly subjects = computed(() => this.loadedData()?.subjects ?? []);

  /** The subject of `?asignatura=`, if it is one. */
  private readonly knownSubject = computed(() => {
    const id = this.asignatura();
    return this.subjects().some((subject) => subject.id === id) ? id : undefined;
  });

  /** The model as last saved; it starts as loaded. */
  private readonly saved = linkedSignal(() => this.loaded());
  protected readonly model = linkedSignal<ExerciseFormModel>(() => this.loaded());

  protected readonly exerciseForm = form(
    this.model,
    (path) => {
      exerciseSchema(path);
      // Another teacher's exercise is only read: duplicating it is how to adapt it (D-057)
      disabled(path, () => this.mode() === 'view');
    },
    {
      submission: {
        action: () => this.save(),
        // Invalid means at least one error
        onInvalid: (field) => this.focusFirstError(field().errorSummary()[0].fieldTree),
      },
    },
  );

  protected readonly subjectOptions = computed(() =>
    this.subjects().map((subject) => ({
      id: subject.id,
      name: subjectName(subject, this.locale).name,
    })),
  );

  /** Who already worked on it: changing its tests changes what they did. */
  protected readonly usage = computed(() => {
    const entry = this.loadedData()?.entry;
    return this.mode() === 'edit' && entry ? entry : null;
  });

  /** When its author archived it (D-060); changed in place by «Archivar» and «Desarchivar». */
  protected readonly archivedAt = linkedSignal(() => this.usage()?.exercise.archivedAt ?? null);

  /** The signature the student will start from: `function countWords(text) {}`. */
  protected readonly signature = computed(() => {
    const { functionName, parameters } = this.model();
    const name = functionName.trim() || '…';
    return `function ${name}(${splitList(parameters).join(', ')}) {}`;
  });

  protected readonly copyQuery = computed(() => ({ [TEACHER_PARAMS.copy]: this.exerciseId() }));

  /** The function and the tests «Probar mi solución» runs against, once both are valid (4.3c). */
  protected readonly checkTarget = computed<CheckTarget | null>(() => {
    if (!this.exerciseForm.functionName().valid() || !this.exerciseForm.tests().valid()) {
      return null;
    }
    const { functionName, tests } = toSolutionCheck(this.model(), '');
    return { functionName, tests };
  });
  protected readonly solutionSkeleton = computed(() => solutionSkeleton(this.model()));
  protected readonly lastCheck = signal<CheckRun | null>(null);

  /** How each test did in the last check, while the tests are the ones it ran. */
  protected readonly testResults = computed(() => {
    const run = this.lastCheck();
    const target = this.checkTarget();
    if (!run || !target || JSON.stringify(run.check.tests) !== JSON.stringify(target.tests)) {
      return [];
    }
    return testStates(run.result.results);
  });

  /**
   * The form as a tool for the agents of the browser (4.3c, D-059): it fills the form and the
   * teacher saves it. Declared by the page, which is only once on the screen at a time.
   */
  protected readonly fillTool = declareAppTool(
    appTool(FILL_EXERCISE_FORM, ({ subjects, ...fill }) => {
      if (!this.data.hasValue()) throw new ToolError('The form is still loading');
      if (this.mode() === 'view') {
        throw new ToolError("This exercise is another teacher's: duplicate it to adapt it");
      }
      const options = this.subjectOptions();
      const found = subjectsByName(subjects ?? [], options);
      this.model.update((model) =>
        fillFormModel(model, { ...fill, ...(subjects ? { subjectIds: found.ids } : {}) }),
      );
      // The errors show next to their fields, as after trying to save
      this.exerciseForm().markAsTouched();
      return {
        saved: false,
        note: 'Nothing is saved: the teacher reviews the form and saves it.',
        // Every rule of the schema says its message (exercise-form-schema.ts)
        errors: this.exerciseForm()
          .errorSummary()
          .map((error) => error.message),
        unknownSubjects: found.unknown,
        subjects: options.map((subject) => subject.name),
      };
    }),
  );

  /**
   * Takes the focus to the first field with an error (4.6). A text of a language in another tab
   * opens that tab first: a field of a hidden tab is not on the page.
   */
  private focusFirstError(first: () => { focusBoundControl(): void }): void {
    const locale = CONTENT_LOCALES.find((candidate) => {
      const texts = this.exerciseForm.texts[candidate];
      return [texts.title, texts.statement, texts.topics].some((field) => Object.is(field, first));
    });
    if (locale) this.texts()?.reveal(locale);
    afterNextRender(() => first().focusBoundControl(), { injector: this.injector });
  }

  /** The exercise as it is now in the form, as the student will read it in `locale`. */
  protected preview(locale: ContentLocale): void {
    this.dialog.open<ExercisePreviewDialog, ExercisePreviewData>(ExercisePreviewDialog, {
      data: { content: previewContent(this.model()), locale },
      width: PREVIEW_WIDTH,
    });
  }

  /** Why «Probar como alumno» waits: the workspace needs the function and the tests. */
  protected readonly tryoutWaits = $localize`:@@exerciseForm.tryoutWaits:Escribe la función y pruebas válidas para probarlo`;

  /**
   * «Probar como alumno» (4.3e, D-061): the workspace with the exercise as it is now in the form,
   * saved or not, in a try that keeps nothing.
   */
  protected tryOut(): void {
    const target = this.checkTarget();
    if (!target) return;
    openTryout(this.dialog, { content: previewContent(this.model()), tests: target.tests });
  }

  hasUnsavedChanges(): boolean {
    return this.mode() !== 'view' && !sameModel(this.model(), this.saved());
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  /** Out of the bank or back in it, without touching the form: the changes not saved stay. */
  protected async setArchived(exerciseId: string, archived: boolean): Promise<void> {
    try {
      const exercise = await this.exercises.setArchived(exerciseId, archived);
      this.archivedAt.set(exercise.archivedAt);
      this.snackBar.open(
        archived
          ? $localize`:@@exerciseForm.archived:Ejercicio archivado`
          : $localize`:@@exerciseForm.unarchived:Ejercicio devuelto al banco`,
      );
    } catch {
      this.snackBar.open(
        $localize`:@@exerciseForm.archive.failed:No se ha podido guardar. Inténtalo de nuevo.`,
      );
    }
  }

  /** Creates it or saves its changes; a new one opens as itself, so saving again updates it. */
  private async save() {
    const model = this.model();
    const exerciseId = this.exerciseId();
    try {
      if (this.mode() === 'edit' && exerciseId) {
        await this.exercises.update(exerciseId, toDraft(model));
        this.saved.set(model);
        this.snackBar.open($localize`:@@exerciseForm.saved:Cambios guardados`);
        return undefined;
      }
      const exercise = await this.exercises.create(toDraft(model));
      this.saved.set(model);
      this.snackBar.open($localize`:@@exerciseForm.created:Ejercicio creado`);
      await this.router.navigateByUrl(this.paths.exercise(exercise.id), { replaceUrl: true });
      return undefined;
    } catch (error) {
      return { kind: 'serverError', message: saveErrorMessage(error) };
    }
  }
}

/** The model the form starts from, for each mode. */
function initialModel(
  mode: FormMode,
  entry: ExerciseWithTests | null | undefined,
  locale: ExerciseFormModel['sourceLocale'],
  subjectId: string | undefined,
): ExerciseFormModel {
  if (!entry) return { ...emptyFormModel(locale), subjectIds: subjectId ? [subjectId] : [] };
  return mode === 'copy' ? copyFormModel(entry) : toFormModel(entry);
}

/** Two models are the same if every field has the same value: they are plain data. */
function sameModel(a: ExerciseFormModel, b: ExerciseFormModel): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof DataError && error.kind === 'forbidden') {
    return $localize`:@@exerciseForm.error.forbidden:Solo quien escribió el ejercicio puede cambiarlo. Duplícalo para adaptarlo.`;
  }
  if (error instanceof DataError && error.kind === 'network') {
    return $localize`:@@exerciseForm.error.network:Sin conexión: no se ha guardado. Inténtalo de nuevo.`;
  }
  return $localize`:@@exerciseForm.error.save:No se ha podido guardar. Inténtalo de nuevo.`;
}
