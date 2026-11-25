import { Component, computed, inject, input, model, signal } from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';
import { LANGUAGE_OPTIONS } from '../../core/i18n/locale';
import { ExerciseService } from '../../data/exercise-service';
import type { ContentLocale } from '../../data/localized-text';
import {
  CONTENT_LOCALES,
  hasText,
  splitList,
  type TextFields,
  textFieldsOf,
  toExerciseText,
} from './exercise-form-model';
import { formActionMessage } from './form-action-message';

/** A tab filled by «Traducir con IA»: what it had before, for «Deshacer», and the draft. */
interface AiDraft {
  readonly previous: TextFields;
  readonly draft: TextFields;
}

/** Each language by its own name, as the tabs show it: a reader looks for their own. */
const LANGUAGE_NAMES = new Map(LANGUAGE_OPTIONS.map((option) => [option.locale, option.label]));

/**
 * The texts of an exercise in every language (D-045): the teacher writes in one, the original, and
 * each of the others has its tab for the translation, optional. A tab with an error says so.
 * «Traducir con IA» fills a tab with a draft to review (4.3c, D-059), which keeps the code as it is.
 */
@Component({
  selector: 'app-exercise-texts',
  imports: [
    FormField,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatTabGroup,
    MatTab,
    MatTabLabel,
    MatIcon,
    MatButton,
    GuideAnchor,
  ],
  templateUrl: './exercise-texts.html',
  host: { class: 'flex flex-col gap-3' },
})
export class ExerciseTexts {
  readonly texts = input.required<FieldTree<Readonly<Record<ContentLocale, TextFields>>>>();
  readonly sourceLocale = input.required<FieldTree<ContentLocale>>();
  /** The code the texts cite, which a translation never changes. */
  readonly functionName = input.required<string>();
  readonly parameters = input.required<string>();
  /**
   * The language of the open tab; null is the original. The form tries the exercise in it (4.3e),
   * so each translation can be checked as the student will read it.
   */
  readonly openLocale = model<ContentLocale | null>(null);

  private readonly exercises = inject(ExerciseService);

  protected readonly anchors = GUIDE_ANCHORS;
  protected readonly languages = LANGUAGE_OPTIONS;

  /** The language being translated now, if any: one at a time. */
  protected readonly translating = signal<ContentLocale | null>(null);
  private readonly drafts = signal<Partial<Record<ContentLocale, AiDraft>>>({});
  private readonly translateErrors = signal<Partial<Record<ContentLocale, string>>>({});

  /** The original, by its name: «Escribe primero el título y el enunciado en Español». */
  protected readonly sourceName = computed(() => LANGUAGE_NAMES.get(this.sourceLocale()().value()));
  /** A translation needs the title and the statement of the original. */
  protected readonly canTranslate = computed(() => {
    const source = this.texts()[this.sourceLocale()().value()]().value();
    return source.title.trim() !== '' && source.statement.trim() !== '';
  });

  /** The open tab; it starts at the original. */
  protected readonly selectedIndex = computed(() =>
    CONTENT_LOCALES.indexOf(this.openLocale() ?? this.sourceLocale()().value()),
  );

  protected readonly tabs = computed(() => {
    const source = this.sourceLocale()().value();
    return CONTENT_LOCALES.map((locale) => {
      const field = this.texts()[locale];
      return {
        locale,
        field,
        name: LANGUAGE_NAMES.get(locale),
        source: locale === source,
        written: hasText(field().value()),
        // The draft shows its notice until the teacher changes it: then it is theirs
        aiDraft: draftShown(this.drafts()[locale], field().value()),
        translateError: this.translateErrors()[locale],
        // Only once the teacher has been there or tried to save, as the fields show their errors
        invalid: field().invalid() && field().touched(),
      };
    });
  });

  /** Opens the tab of a language, to show one of its fields. */
  reveal(locale: ContentLocale): void {
    this.openLocale.set(locale);
  }

  protected selectTab(index: number): void {
    this.openLocale.set(CONTENT_LOCALES[index]);
  }

  /** Fills the tab of `locale` with the draft of the AI, keeping what it had for «Deshacer». */
  protected async translate(locale: ContentLocale): Promise<void> {
    const from = this.sourceLocale()().value();
    const field = this.texts()[locale]();
    this.translating.set(locale);
    this.translateErrors.update((errors) => ({ ...errors, [locale]: undefined }));
    try {
      const text = await this.exercises.translate({
        from,
        to: locale,
        texts: toExerciseText(this.texts()[from]().value()),
        functionName: this.functionName().trim(),
        parameters: splitList(this.parameters()),
      });
      const previous = field.value();
      const draft = textFieldsOf(text);
      field.value.set(draft);
      this.drafts.update((drafts) => ({ ...drafts, [locale]: { previous, draft } }));
    } catch (error) {
      this.translateErrors.update((errors) => ({
        ...errors,
        [locale]: formActionMessage('translate', error),
      }));
    } finally {
      this.translating.set(null);
    }
  }

  /** Gives the tab back what it had before the draft. */
  protected undoTranslation(locale: ContentLocale, previous: TextFields): void {
    this.texts()[locale]().value.set(previous);
    this.drafts.update((drafts) => ({ ...drafts, [locale]: undefined }));
  }
}

/** The draft of a tab while it is as the AI wrote it, or null. */
function draftShown(draft: AiDraft | undefined, value: TextFields): AiDraft | null {
  if (!draft) return null;
  const { title, statement, topics } = draft.draft;
  return title === value.title && statement === value.statement && topics === value.topics
    ? draft
    : null;
}
