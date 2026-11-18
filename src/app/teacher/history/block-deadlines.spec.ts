import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';

import type { DeadlineStats } from '../../data/stats-service';
import { BlockDeadlines } from './block-deadlines';
import { deadlineStats } from './history-testing';

const NOW = Date.parse('2026-11-18T10:00:00.000Z');
const PAST = '2026-11-06T22:59:00.000Z';
const COMING = '2026-11-20T22:59:00.000Z';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('BlockDeadlines', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function setup(deadlines: DeadlineStats[]) {
    const fixture = TestBed.createComponent(BlockDeadlines);
    fixture.componentRef.setInput('deadlines', deadlines);
    fixture.componentRef.setInput('students', 24);
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('says its date and what arrived on time, without the lines at zero', () => {
    const { host } = setup([deadlineStats('b4', PAST, { assignments: 3, onTime: 40 })]);

    expect(text(screen.getByRole('heading', { level: 3 }))).toMatch(
      /^Entrega: vie 6 nov, 23:59.*hace 12 días$/,
    );
    expect(text(host)).toContain('40 de 72 a tiempo');
    expect(text(host)).not.toContain('ejercicios');
    expect(text(host)).not.toContain('últimas');
    expect(text(host)).not.toContain('después');
  });

  it('says how many arrived in the last hours and after the date', () => {
    const { fixture, host } = setup([
      deadlineStats('b1', PAST, { assignments: 1, onTime: 20, lastHours: 3, late: 1 }),
    ]);

    expect(text(host)).toContain('3 en las últimas 24 horas');
    expect(text(host)).toContain('1 después del plazo');

    fixture.componentRef.setInput('deadlines', [
      deadlineStats('b1', PAST, { onTime: 2, lastHours: 1, late: 2 }),
    ]);
    fixture.detectChanges();
    expect(text(host)).toContain('1 en las últimas 24 horas');
    expect(text(host)).toContain('2 después del plazo');
  });

  it('gives each date of the block its exercises when it has several', () => {
    const { host } = setup([
      deadlineStats('b1', PAST, { assignments: 1, onTime: 24 }),
      deadlineStats('b1', COMING, { assignments: 2, onTime: 3 }),
    ]);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(text(host)).toMatch(/1 ejercicio(?!s)/);
    expect(text(host)).toContain('2 ejercicios');
    expect(text(host)).toContain('3 de 48 entregadas');
  });

  it('names who is missing, saying how much is left only to who submitted part of it', () => {
    const { host } = setup([
      deadlineStats('b4', PAST, {
        assignments: 3,
        onTime: 4,
        missing: [
          { student: { id: 's1', name: 'Ana López' }, pending: 3 },
          { student: { id: 's2', name: 'Bruno Gil' }, pending: 1 },
          { student: { id: 's3', name: 'Carla Ruiz' }, pending: 2 },
        ],
      }),
    ]);

    expect(text(host)).toContain(
      'Faltan 3: Ana López, Bruno Gil (falta 1 de 3) y Carla Ruiz (faltan 2 de 3)',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names a single student missing, and says when everything arrived', () => {
    const { fixture, host } = setup([
      deadlineStats('b1', PAST, {
        assignments: 1,
        onTime: 23,
        missing: [{ student: { id: 's1', name: 'Ana López' }, pending: 1 }],
      }),
    ]);
    expect(text(host)).toContain('Falta 1: Ana López');

    fixture.componentRef.setInput('deadlines', [deadlineStats('b1', PAST, { onTime: 48 })]);
    fixture.detectChanges();
    expect(text(host)).toContain('Todo entregado');
  });

  it('says nobody submitted instead of naming the whole class', () => {
    const { host } = setup([
      deadlineStats('b5', COMING, {
        missing: [{ student: { id: 's1', name: 'Ana López' }, pending: 2 }],
      }),
    ]);

    expect(text(host)).toContain('0 de 48 entregadas');
    expect(text(host)).toContain('Nadie ha entregado todavía');
    expect(text(host)).not.toContain('Ana López');
  });
});
