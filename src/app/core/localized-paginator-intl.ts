import { Provider, Service } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Texts of mat-paginator in the language of the interface (D-023): Material only ships them in
 * English. Provided by the areas with tables (provideLocalizedPaginator).
 */
@Service({ autoProvided: false })
export class LocalizedPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = $localize`:@@paginator.itemsPerPage:Elementos por página`;
  override nextPageLabel = $localize`:@@paginator.next:Página siguiente`;
  override previousPageLabel = $localize`:@@paginator.previous:Página anterior`;
  override firstPageLabel = $localize`:@@paginator.first:Primera página`;
  override lastPageLabel = $localize`:@@paginator.last:Última página`;

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return $localize`:@@paginator.empty:0 de 0`;
    }
    const start = page * pageSize + 1;
    const end = Math.min(page * pageSize + pageSize, length);
    return $localize`:@@paginator.range:${start}:start: – ${end}:end: de ${length}:length:`;
  };
}

/**
 * Provided in the routes of the areas with tables (teacher, admin and the showcase), not in
 * app.config.ts: the paginator module pulls in select, form-field, tooltip and forms, and from
 * app.config.ts they would all end up in the initial bundle (D-021).
 */
export function provideLocalizedPaginator(): Provider {
  return { provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl };
}
