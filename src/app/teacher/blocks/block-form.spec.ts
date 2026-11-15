import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { form } from '@angular/forms/signals';

import type { ClassBlock } from '../../data/exercise';
import { BLOCK_TITLE_LENGTH, blockSchema, toBlockDraft, toBlockFormModel } from './block-form';

const BLOCK: ClassBlock = {
  id: 'block-1',
  groupId: 'daw',
  position: 1,
  title: 'Tema 1: Bucles',
  sourceLocale: 'es',
  translations: { en: { title: 'Topic 1: Loops' } },
  isHidden: true,
};

describe('toBlockFormModel', () => {
  it('starts a new block in the language of the interface, visible', () => {
    expect(toBlockFormModel(null, 'ca')).toEqual({
      sourceLocale: 'ca',
      titles: { es: '', en: '', ca: '' },
      isHidden: false,
    });
  });

  it('puts every title of a block in its language', () => {
    expect(toBlockFormModel(BLOCK, 'en')).toEqual({
      sourceLocale: 'es',
      titles: { es: 'Tema 1: Bucles', en: 'Topic 1: Loops', ca: '' },
      isHidden: true,
    });
  });
});

describe('toBlockDraft', () => {
  it('keeps the source title and only the translations written, trimmed', () => {
    expect(
      toBlockDraft({
        sourceLocale: 'en',
        titles: { es: '  Repaso ', en: ' Review ', ca: '   ' },
        isHidden: false,
      }),
    ).toEqual({
      title: 'Review',
      sourceLocale: 'en',
      translations: { es: { title: 'Repaso' } },
      isHidden: false,
    });
  });

  it('goes back to the block it came from', () => {
    expect(toBlockDraft(toBlockFormModel(BLOCK, 'es'))).toEqual({
      title: BLOCK.title,
      sourceLocale: BLOCK.sourceLocale,
      translations: BLOCK.translations,
      isHidden: BLOCK.isHidden,
    });
  });
});

describe('blockSchema', () => {
  function blockForm(titles: Partial<Record<'es' | 'en' | 'ca', string>>) {
    return TestBed.runInInjectionContext(() =>
      form(
        signal({ ...toBlockFormModel(null, 'es'), titles: { es: '', en: '', ca: '', ...titles } }),
        blockSchema,
      ),
    );
  }

  it('asks for the title in the language it is written in', () => {
    const blockFormTree = blockForm({ en: 'Exam' });

    expect(
      blockFormTree.titles
        .es()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['required']);
    expect(blockFormTree.titles.en().errors()).toEqual([]);
  });

  it('limits the length of every title', () => {
    const long = 'x'.repeat(BLOCK_TITLE_LENGTH + 1);
    const blockFormTree = blockForm({ es: 'Examen', ca: long });

    expect(blockFormTree.titles.es().errors()).toEqual([]);
    expect(
      blockFormTree.titles
        .ca()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['maxLength']);
  });
});
