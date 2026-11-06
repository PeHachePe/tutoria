import { Component, computed, signal } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';

type StudentStatus = 'Trabajando' | 'Entregado' | 'Atascado';

interface StudentRow {
  name: string;
  status: StudentStatus;
  minutes: number;
  hints: number;
}

const STUDENTS: readonly StudentRow[] = [
  { name: 'Alumno 1', status: 'Trabajando', minutes: 18, hints: 2 },
  { name: 'Alumno 2', status: 'Entregado', minutes: 6, hints: 0 },
  { name: 'Alumno 3', status: 'Atascado', minutes: 25, hints: 5 },
  { name: 'Alumno 4', status: 'Trabajando', minutes: 14, hints: 1 },
  { name: 'Alumno 5', status: 'Entregado', minutes: 11, hints: 1 },
  { name: 'Alumno 6', status: 'Trabajando', minutes: 9, hints: 3 },
  { name: 'Alumno 7', status: 'Atascado', minutes: 31, hints: 4 },
  { name: 'Alumno 8', status: 'Entregado', minutes: 22, hints: 2 },
];

const STATUS_CLASSES: Record<StudentStatus, string> = {
  Trabajando: 'bg-info-container text-on-info-container',
  Entregado: 'bg-success-container text-on-success-container',
  Atascado: 'bg-warning-container text-on-warning-container',
};

/** Material table with sorting and pagination driven by signals. */
@Component({
  selector: 'app-showcase-table',
  imports: [
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatSort,
    MatSortHeader,
    MatPaginator,
  ],
  templateUrl: './showcase-table.html',
})
export class ShowcaseTable {
  protected readonly columns = ['name', 'status', 'minutes', 'hints'];
  protected readonly total = STUDENTS.length;
  protected readonly pageSize = 5;

  protected readonly sort = signal<Sort>({ active: '', direction: '' });
  protected readonly pageIndex = signal(0);

  protected readonly rows = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return sortStudents(STUDENTS, this.sort()).slice(start, start + this.pageSize);
  });

  protected statusClass(student: StudentRow): string {
    return STATUS_CLASSES[student.status];
  }

  protected changeSort(sort: Sort): void {
    this.sort.set(sort);
    this.pageIndex.set(0);
  }
}

function sortStudents(students: readonly StudentRow[], sort: Sort): readonly StudentRow[] {
  if (sort.direction === '') {
    return students;
  }
  const key = sort.active as keyof StudentRow;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...students].sort(
    (a, b) => factor * String(a[key]).localeCompare(String(b[key]), 'es', { numeric: true }),
  );
}
