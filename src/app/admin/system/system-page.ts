import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  inject,
  Injector,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from '../../core/i18n/language-service';
import { LOCALE_NAMES } from '../../core/i18n/locale-names';
import { AdminService, type SubjectDraft } from '../../data/admin-service';
import {
  AI_PROVIDER_PRESETS,
  type AiModelCheck,
  type AiResponseFormat,
  MAX_AI_FALLBACKS,
} from '../../data/ai-provider-setting';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { CONTENT_LOCALES } from '../../teacher/exercises/exercise-form-model';
import { checkMessage } from './check-message';
import {
  applyPreset,
  newFallback,
  OTHER_PROVIDER,
  type ProviderFormModel,
  providerSchema,
  SAME_PROVIDER,
  toProviderFormModel,
  toProviderSetting,
} from './provider-form';
import { SubjectDialog, type SubjectDialogData } from './subject-dialog';

const PRESET_LABELS: Readonly<Record<string, string>> = {
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: $localize`:@@system.preset.ollama:Ollama (en el servidor)`,
};

/** The providers of the select, the presets first. */
const PRESET_OPTIONS = [
  ...AI_PROVIDER_PRESETS.map(({ id }) => ({ id, label: PRESET_LABELS[id] })),
  { id: OTHER_PROVIDER, label: $localize`:@@system.preset.other:Otro` },
];

/** A fallback may also be another model of the main provider. */
const FALLBACK_PRESET_OPTIONS = [
  { id: SAME_PROVIDER, label: $localize`:@@system.preset.same:El del principal` },
  ...PRESET_OPTIONS,
];

const FORMAT_OPTIONS: readonly { readonly format: AiResponseFormat; readonly label: string }[] = [
  { format: 'json_schema', label: $localize`:@@system.format.schema:JSON con esquema` },
  { format: 'json_object', label: $localize`:@@system.format.object:JSON simple` },
  { format: 'none', label: $localize`:@@system.format.none:Sin formato` },
];

/** The check of a draft: it only counts while the draft is the same object (any change is a new one). */
interface DraftCheck {
  readonly draft: ProviderFormModel;
  readonly results: readonly AiModelCheck[];
}

/** A subject of the list, with its name in the language of the interface. */
interface SubjectRow {
  readonly subject: Subject;
  readonly name: string;
  /** The language of the name when it is not the one of the interface. */
  readonly lang: string | null;
  readonly locales: string;
  readonly localeNames: string;
}

/**
 * The settings of the system (/admin/sistema, ficha 12, RF-19, CU-07): the AI provider, which is
 * tested model by model before saving it, and the subjects of the groups (2.5c). Each section loads
 * and fails on its own.
 */
@Component({
  selector: 'app-system-page',
  imports: [
    FormField,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatTooltip,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  templateUrl: './system-page.html',
})
export class SystemPage {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LanguageService).locale;

  protected readonly presetOptions = PRESET_OPTIONS;
  protected readonly fallbackPresetOptions = FALLBACK_PRESET_OPTIONS;
  protected readonly formatOptions = FORMAT_OPTIONS;
  protected readonly other = OTHER_PROVIDER;
  protected readonly same = SAME_PROVIDER;
  protected readonly maxFallbacks = MAX_AI_FALLBACKS;
  protected readonly checkMessage = checkMessage;

  protected readonly provider = resource({ loader: () => this.admin.getAiProvider() });

  /** What is saved, as the form edits it. */
  private readonly saved = computed(() =>
    this.provider.hasValue() ? toProviderFormModel(this.provider.value()) : null,
  );

  /** The draft: back to what is saved whenever that changes. */
  private readonly draft = linkedSignal<ProviderFormModel>(
    () => this.saved() ?? toProviderFormModel({ baseUrl: '', model: '' }),
  );

  protected readonly providerForm = form(this.draft, providerSchema);

  protected readonly checking = signal(false);
  protected readonly saving = signal(false);
  /** The check or the save that failed, said beside the buttons. */
  protected readonly actionFailed = signal<'check' | 'save' | null>(null);
  private readonly lastCheck = signal<DraftCheck | null>(null);

  /** The results of the check of the current draft; none once anything changes. */
  protected readonly results = computed(() => {
    const check = this.lastCheck();
    return check?.draft === this.draft() ? check.results : null;
  });

  protected readonly mainAnswered = computed(() => {
    const main = this.results()?.[0];
    return main !== undefined && main.problem === undefined;
  });

  protected readonly canSave = computed(
    () => this.mainAnswered() && this.providerForm().valid() && !this.saving(),
  );

  protected readonly changed = computed(() => this.draft() !== this.saved());

  protected readonly canAddFallback = computed(
    () => this.draft().fallbacks.length < MAX_AI_FALLBACKS,
  );

  protected readonly subjects = resource({ loader: () => this.admin.listSubjects() });

  /** The subjects, changed in place after each save until the next load. */
  private readonly subjectList = linkedSignal<Subject[]>(() =>
    this.subjects.hasValue() ? this.subjects.value() : [],
  );

  /** The first load: a reload keeps the list in sight. */
  protected readonly subjectsFirstLoad = computed(
    () => this.subjects.isLoading() && this.subjectList().length === 0,
  );

  /** By name in the language of the interface. */
  protected readonly subjectRows = computed<SubjectRow[]>(() =>
    this.subjectList()
      .map((subject) => {
        const { name, locale } = subjectName(subject, this.locale);
        const locales = CONTENT_LOCALES.filter(
          (candidate) =>
            candidate === subject.sourceLocale || subject.translations[candidate] !== undefined,
        );
        return {
          subject,
          name,
          lang: locale === this.locale ? null : locale,
          locales: locales.join(' · ').toUpperCase(),
          localeNames: locales.map((candidate) => LOCALE_NAMES[candidate]).join(', '),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, this.locale)),
  );

  protected fallbackLabel(position: number): string {
    return $localize`:@@system.fallback.label:Respaldo ${position}:position:`;
  }

  protected editLabel(name: string): string {
    return $localize`:@@system.subjects.editLabel:Editar ${name}:name:`;
  }

  protected removeLabel(position: number): string {
    return $localize`:@@system.fallback.remove:Quitar el respaldo ${position}:position:`;
  }

  protected moveUpLabel(position: number): string {
    return $localize`:@@system.fallback.up:Subir el respaldo ${position}:position:`;
  }

  protected moveDownLabel(position: number): string {
    return $localize`:@@system.fallback.down:Bajar el respaldo ${position}:position:`;
  }

  protected selectPreset(presetId: string): void {
    this.draft.update((model) => applyPreset(model, presetId));
  }

  protected selectFallbackPreset(index: number, presetId: string): void {
    this.updateFallbacks((fallbacks) =>
      fallbacks.map((fallback, at) => (at === index ? applyPreset(fallback, presetId) : fallback)),
    );
  }

  protected addFallback(): void {
    const index = this.draft().fallbacks.length;
    this.updateFallbacks((fallbacks) => [...fallbacks, newFallback(this.draft().timeoutSeconds)]);
    this.focusLater(`fallback-model-${index}`);
  }

  protected removeFallback(index: number): void {
    this.updateFallbacks((fallbacks) => fallbacks.filter((_, at) => at !== index));
    const left = this.draft().fallbacks.length;
    this.focusLater(index < left ? `fallback-model-${index}` : 'add-fallback');
  }

  /** Swaps a fallback with the one before (-1) or after (1); the focus stays on its button. */
  protected moveFallback(index: number, step: -1 | 1): void {
    const to = index + step;
    this.updateFallbacks((fallbacks) => {
      const moved = [...fallbacks];
      [moved[index], moved[to]] = [moved[to], moved[index]];
      return moved;
    });
    // Disabled at the ends, but still focusable (disabledInteractive): the focus never jumps
    this.focusLater(`fallback-${step < 0 ? 'up' : 'down'}-${to}`);
  }

  protected async check(): Promise<void> {
    const draft = this.draft();
    this.checking.set(true);
    this.actionFailed.set(null);
    try {
      const results = await this.admin.checkAiProvider(toProviderSetting(draft));
      this.lastCheck.set({ draft, results });
    } catch {
      this.actionFailed.set('check');
    } finally {
      this.checking.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const setting = toProviderSetting(this.draft());
    this.saving.set(true);
    this.actionFailed.set(null);
    try {
      await this.admin.setAiProvider(setting);
      this.provider.value.set(setting);
      this.snackBar.open($localize`:@@system.saved:Proveedor de IA guardado`);
    } catch {
      this.actionFailed.set('save');
    } finally {
      this.saving.set(false);
    }
  }

  protected discard(): void {
    // The form, and this button, are only shown with the provider loaded
    this.draft.set(this.saved() as ProviderFormModel);
    this.actionFailed.set(null);
  }

  protected async createSubject(): Promise<void> {
    const created = await this.openSubjectDialog(null);
    if (created) this.snackBar.open($localize`:@@system.subjects.created:Asignatura creada`);
  }

  protected async editSubject(subject: Subject): Promise<void> {
    const saved = await this.openSubjectDialog(subject);
    if (saved) this.snackBar.open($localize`:@@system.subjects.saved:Asignatura guardada`);
  }

  private async openSubjectDialog(subject: Subject | null): Promise<boolean> {
    const save = async (draft: SubjectDraft): Promise<void> => {
      const savedSubject = await this.admin.saveSubject(draft);
      this.subjectList.update((list) => [
        ...list.filter((other) => other.id !== savedSubject.id),
        savedSubject,
      ]);
    };
    const ref = this.dialog.open<SubjectDialog, SubjectDialogData, boolean>(SubjectDialog, {
      data: { subject, locale: this.locale, save },
      injector: this.injector,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private updateFallbacks(
    change: (fallbacks: ProviderFormModel['fallbacks']) => ProviderFormModel['fallbacks'],
  ): void {
    this.draft.update((model) => ({ ...model, fallbacks: change(model.fallbacks) }));
  }

  private focusLater(id: string): void {
    afterNextRender(() => this.document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
