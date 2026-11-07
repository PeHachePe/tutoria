import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { provideSpanishPaginator, SpanishPaginatorIntl } from './spanish-paginator-intl';

describe('SpanishPaginatorIntl', () => {
  const intl = new SpanishPaginatorIntl();

  it('labels the paginator controls in Spanish', () => {
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

  it('replaces the English texts where it is provided', () => {
    TestBed.configureTestingModule({ providers: [provideSpanishPaginator()] });

    expect(TestBed.inject(MatPaginatorIntl)).toBeInstanceOf(SpanishPaginatorIntl);
  });
});
