import { Component, computed, input, output, signal } from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { LANGUAGE_OPTIONS } from '../../core/i18n/locale';
import type { ContentLocale } from '../../data/localized-text';
import { CONTENT_LOCALES, hasText, type TextFields } from './exercise-form-model';

/** Each language by its own name, as the tabs show it: a reader looks for their own. */
const LANGUAGE_NAMES = new Map(LANGUAGE_OPTIONS.map((option) => [option.locale, option.label]));

/**
 * The texts of an exercise in every language (D-045): the teacher writes in one, the original, and
 * each of the others has its tab for the translation, optional. A tab with an error says so.
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
  ],
  templateUrl: './exercise-texts.html',
  host: { class: 'flex flex-col gap-3' },
})
export class ExerciseTexts {
  readonly texts = input.required<FieldTree<Readonly<Record<ContentLocale, TextFields>>>>();
  readonly sourceLocale = input.required<FieldTree<ContentLocale>>();
  /** Shows the exercise as the student reads it, in that language. */
  readonly preview = output<ContentLocale>();

  protected readonly languages = LANGUAGE_OPTIONS;

  /** The open tab; it starts at the original. */
  protected readonly selected = signal<number | null>(null);
  protected readonly selectedIndex = computed(
    () => this.selected() ?? CONTENT_LOCALES.indexOf(this.sourceLocale()().value()),
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
        // Only once the teacher has been there or tried to save, as the fields show their errors
        invalid: field().invalid() && field().touched(),
      };
    });
  });

  /** Opens the tab of a language, to show one of its fields. */
  reveal(locale: ContentLocale): void {
    this.selected.set(CONTENT_LOCALES.indexOf(locale));
  }

  protected previewSelected(): void {
    this.preview.emit(CONTENT_LOCALES[this.selectedIndex()]);
  }
}
