import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { clearTranslations, loadTranslations } from '@angular/localize';

import { LocalizedPaginatorIntl, provideLocalizedPaginator } from './localized-paginator-intl';

describe('LocalizedPaginatorIntl', () => {
  const intl = new LocalizedPaginatorIntl();

  afterEach(() => clearTranslations());

  it('labels the paginator controls in the source language', () => {
    expect(intl.itemsPerPageLabel).toBe('Elementos por página');
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.previousPageLabel).toBe('Página anterior');
    expect(intl.firstPageLabel).toBe('Primera página');
    expect(intl.lastPageLabel).toBe('Última página');
  });

  it.each([
    [0, 5, 12, '1 – 5 de 12'],
    [2, 5, 12, '11 – 12 de 12'],
    [0, 5, 3, '1 – 3 de 3'],
    [0, 5, 0, '0 de 0'],
  ])('describes page %i of size %i with %i items as "%s"', (page, size, length, label) => {
    expect(intl.getRangeLabel(page, size, length)).toBe(label);
  });

  it('follows the loaded translation, placeholders included', () => {
    loadTranslations({
      'paginator.next': 'Next page',
      'paginator.range': '{$start} – {$end} of {$length}',
    });

    const translated = new LocalizedPaginatorIntl();

    expect(translated.nextPageLabel).toBe('Next page');
    expect(translated.getRangeLabel(1, 10, 25)).toBe('11 – 20 of 25');
  });

  it('replaces the English texts of Material where it is provided', () => {
    TestBed.configureTestingModule({ providers: [provideLocalizedPaginator()] });

    expect(TestBed.inject(MatPaginatorIntl)).toBeInstanceOf(LocalizedPaginatorIntl);
  });
});
