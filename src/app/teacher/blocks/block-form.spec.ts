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
  opensAt: null,
};

describe('toBlockFormModel', () => {
  it('starts a new block in the language of the interface, visible', () => {
    expect(toBlockFormModel(null, 'ca')).toEqual({
      sourceLocale: 'ca',
      titles: { es: '', en: '', ca: '' },
      isHidden: false,
      opensDay: null,
      opensTime: null,
    });
  });

  it('puts every title of a block in its language', () => {
    expect(toBlockFormModel(BLOCK, 'en')).toEqual({
      sourceLocale: 'es',
      titles: { es: 'Tema 1: Bucles', en: 'Topic 1: Loops', ca: '' },
      isHidden: true,
      opensDay: null,
      opensTime: null,
    });
  });

  it('puts the opening date in its day and time', () => {
    const opensAt = new Date(2026, 10, 23, 9, 30).toISOString();

    expect(toBlockFormModel({ ...BLOCK, opensAt }, 'es')).toMatchObject({
      opensDay: new Date(opensAt),
      opensTime: new Date(opensAt),
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
        opensDay: null,
        opensTime: null,
      }),
    ).toEqual({
      title: 'Review',
      sourceLocale: 'en',
      translations: { es: { title: 'Repaso' } },
      isHidden: false,
      opensAt: null,
    });
  });

  it('opens the block at the time chosen, or at the start of the day without one', () => {
    const model = { ...toBlockFormModel(BLOCK, 'es'), opensDay: new Date(2026, 10, 23, 15, 0) };

    expect(toBlockDraft({ ...model, opensTime: new Date(2026, 0, 1, 9, 30) }).opensAt).toBe(
      new Date(2026, 10, 23, 9, 30).toISOString(),
    );
    expect(toBlockDraft({ ...model, opensTime: null }).opensAt).toBe(
      new Date(2026, 10, 23, 0, 0).toISOString(),
    );
  });

  it('goes back to the block it came from', () => {
    expect(toBlockDraft(toBlockFormModel(BLOCK, 'es'))).toEqual({
      title: BLOCK.title,
      sourceLocale: BLOCK.sourceLocale,
      translations: BLOCK.translations,
      isHidden: BLOCK.isHidden,
      opensAt: BLOCK.opensAt,
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

describe('blockSchema · opening date', () => {
  it('asks for the day when only the time is chosen', () => {
    const blockFormTree = TestBed.runInInjectionContext(() =>
      form(
        signal({
          ...toBlockFormModel(BLOCK, 'es'),
          opensTime: new Date(2026, 0, 1, 9, 0),
        }),
        blockSchema,
      ),
    );

    expect(
      blockFormTree
        .opensDay()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['required']);
  });
});
