import { TestBed } from '@angular/core/testing';
import { screen, within } from '@testing-library/angular';

import type { BlockStats, DeadlineStats } from '../../data/stats-service';
import { BlockDetail } from './block-detail';
import { blockStats, deadlineStats, exerciseStats } from './history-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('BlockDetail', () => {
  afterEach(() => document.body.replaceChildren());

  function setup(stats: BlockStats, students = 24, deadlines: DeadlineStats[] = []) {
    const fixture = TestBed.createComponent(BlockDetail);
    fixture.componentRef.setInput('stats', stats);
    fixture.componentRef.setInput('deadlines', deadlines);
    fixture.componentRef.setInput('students', students);
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): string[] {
    return within(screen.getByRole('table'))
      .getAllByRole('row')
      .map((row) => [...row.children].map(text).join(' | '));
  }

  it('says the block, its exercises, who worked on it and its three figures', () => {
    const host = setup(
      blockStats('Tema 1', {
        assignments: 2,
        solved: 48,
        medianSeconds: 720,
        stuckStudents: 6,
        activeStudents: 24,
      }),
    );

    expect(text(screen.getByRole('heading', { level: 2 }))).toBe('Tema 1');
    expect(text(host)).toContain('2 ejercicios · lo han trabajado 24 de 24 alumnos');
    const figures = text(host.querySelector('dl'));
    expect(figures).toContain('Ejercicios superados 100 % 48 de 48');
    expect(figures).toContain('Tiempo por ejercicio 12 min');
    expect(figures).toContain('Se atascaron en alguna prueba 6 de 24');
  });

  it('says there are no submissions and that nobody got stuck', () => {
    const host = setup(blockStats('Recuperación', { assignments: 1, medianSeconds: null }));

    const figures = text(host.querySelector('dl'));
    expect(text(host)).toMatch(/1 ejercicio(?!s)/);
    expect(figures).toContain('Tiempo por ejercicio Sin entregas');
    expect(figures).toContain('Se atascaron en alguna prueba Nadie');
  });

  it('shows its due date only when it has one', () => {
    const host = setup(blockStats('Tema 4'), 24, [
      deadlineStats('Tema 4', '2026-11-06T22:59:00.000Z', { onTime: 40 }),
    ]);
    expect(text(host)).toContain('Entrega:');
    expect(text(host)).toContain('40 de 48 a tiempo');

    document.body.replaceChildren();
    expect(text(setup(blockStats('Tema 1')))).not.toContain('Entrega:');
  });

  it('has a row per exercise, without the column of who got stuck when nobody did', () => {
    setup(
      blockStats('Tema 4', {
        exercises: [
          exerciseStats('Contar vocales', { solved: 22, attempts: 24, hints: 0 }),
          exerciseStats('Formatear un precio', { solved: 5, medianSeconds: null }),
        ],
      }),
    );

    expect(screen.getByRole('table', { name: 'Cifras de cada ejercicio de Tema 4' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Ejercicios del bloque' }).tabIndex).toBe(0);
    expect(rows()).toEqual([
      'Ejercicio | Superado | Pistas por alumno | Tiempo',
      'Contar vocales | 92 % | 0,0 | 10 min',
      'Formatear un precio | 21 % | 0,5 | ',
    ]);
  });

  it('says who got stuck in each exercise when somebody did', () => {
    setup(
      blockStats('Tema 1', {
        stuckStudents: 3,
        exercises: [
          exerciseStats('Año bisiesto', { stuckStudents: 3 }),
          exerciseStats('Tabla de multiplicar'),
        ],
      }),
    );

    expect(rows()).toEqual([
      'Ejercicio | Superado | Pistas por alumno | Tiempo | Se atascaron',
      'Año bisiesto | 63 % | 0,5 | 10 min | 3',
      'Tabla de multiplicar | 63 % | 0,5 | 10 min | ',
    ]);
  });

  it('marks the language of titles without translation, and copes with no students', () => {
    const stats = blockStats('b1', {
      exercises: [
        {
          ...exerciseStats('Leap year'),
          exercise: { ...exerciseStats('Leap year').exercise, sourceLocale: 'en' },
        },
      ],
    });
    const host = setup(
      { ...stats, block: { ...stats.block, title: 'Loops', sourceLocale: 'en' } },
      0,
    );

    expect(screen.getByRole('heading', { level: 2 }).getAttribute('lang')).toBe('en');
    expect(screen.getByRole('cell', { name: 'Leap year' }).getAttribute('lang')).toBe('en');
    expect(rows()[1]).toContain('0 %');
    expect(text(host.querySelector('dl'))).toContain('Ejercicios superados 0 %');
  });
});
