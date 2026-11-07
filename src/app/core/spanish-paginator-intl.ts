import { Provider, Service } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Spanish texts of mat-paginator, provided by the areas with tables (provideSpanishPaginator). */
@Service({ autoProvided: false })
export class SpanishPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Elementos por página';
  override nextPageLabel = 'Página siguiente';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primera página';
  override lastPageLabel = 'Última página';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return '0 de 0';
    }
    const start = page * pageSize;
    const end = Math.min(start + pageSize, length);
    return `${start + 1} – ${end} de ${length}`;
  };
}

/**
 * Provided in the routes of the areas with tables (teacher, admin and the showcase), not in
 * app.config.ts: the paginator module pulls in select, form-field, tooltip and forms, and from
 * app.config.ts they would all end up in the initial bundle (D-021).
 */
export function provideSpanishPaginator(): Provider {
  return { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl };
}
