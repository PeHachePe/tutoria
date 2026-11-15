import { applyWhen, maxLength, required, type SchemaPathTree } from '@angular/forms/signals';

import type { BlockDraft } from '../../data/block-service';
import type { ClassBlock } from '../../data/exercise';
import type { ContentLocale } from '../../data/localized-text';
import { DEFAULT_OPENING_TIME, withTime } from '../../shared/due-date';
import { CONTENT_LOCALES } from '../exercises/exercise-form-model';

/** As long as the title of an exercise: it heads a section of the catalog. */
export const BLOCK_TITLE_LENGTH = 120;

/** A block as its dialog edits it: a title per language, the empty ones not translated (D-045). */
export interface BlockFormModel {
  readonly sourceLocale: ContentLocale;
  readonly titles: Readonly<Record<ContentLocale, string>>;
  readonly isHidden: boolean;
  /** The day its students start to see it (4.3d), or null: as soon as it is visible. */
  readonly opensDay: Date | null;
  /** The time of that day, or null: at its start. */
  readonly opensTime: Date | null;
}

/** The model of a block, or of a new one written in the language of the interface. */
export function toBlockFormModel(block: ClassBlock | null, locale: ContentLocale): BlockFormModel {
  if (!block) {
    return {
      sourceLocale: locale,
      titles: { es: '', en: '', ca: '' },
      isHidden: false,
      opensDay: null,
      opensTime: null,
    };
  }
  const titles = { es: '', en: '', ca: '' };
  for (const other of CONTENT_LOCALES) {
    titles[other] = block.translations[other]?.title ?? '';
  }
  titles[block.sourceLocale] = block.title;
  const opensAt = block.opensAt === null ? null : new Date(block.opensAt);
  return {
    sourceLocale: block.sourceLocale,
    titles,
    isHidden: block.isHidden,
    opensDay: opensAt,
    opensTime: opensAt,
  };
}

/** What is saved: the source title and the translations written, without surrounding spaces. */
export function toBlockDraft(model: BlockFormModel): BlockDraft {
  const translations: Partial<Record<ContentLocale, { title: string }>> = {};
  for (const locale of CONTENT_LOCALES) {
    const title = model.titles[locale].trim();
    if (locale !== model.sourceLocale && title !== '') {
      translations[locale] = { title };
    }
  }
  return {
    title: model.titles[model.sourceLocale].trim(),
    sourceLocale: model.sourceLocale,
    translations,
    isHidden: model.isHidden,
    opensAt: model.opensDay
      ? withTime(model.opensDay, model.opensTime, DEFAULT_OPENING_TIME).toISOString()
      : null,
  };
}

/** Only the title of the language it is written in is required; the others are translations. */
export function blockSchema(path: SchemaPathTree<BlockFormModel>): void {
  for (const locale of CONTENT_LOCALES) {
    const title = path.titles[locale];
    applyWhen(
      title,
      ({ valueOf }) => valueOf(path.sourceLocale) === locale,
      (source) =>
        required(source, {
          message: $localize`:@@blockForm.error.title:Escribe el título del bloque`,
        }),
    );
    maxLength(title, BLOCK_TITLE_LENGTH, {
      message: $localize`:@@blockForm.error.titleLength:Como mucho ${BLOCK_TITLE_LENGTH}:max: caracteres`,
    });
  }
  // A time alone says nothing: the block opens on a day
  applyWhen(
    path.opensDay,
    ({ valueOf }) => valueOf(path.opensTime) !== null,
    (day) =>
      required(day, {
        message: $localize`:@@blockForm.error.opensDay:Elige el día en que se abre`,
      }),
  );
}
