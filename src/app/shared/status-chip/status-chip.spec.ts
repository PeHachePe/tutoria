import { TestBed } from '@angular/core/testing';

import type { AttemptStatus } from '../../data/attempt';
import { StatusChip } from './status-chip';

describe('StatusChip', () => {
  function render(status: AttemptStatus): HTMLElement {
    const fixture = TestBed.createComponent(StatusChip);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each<[AttemptStatus, string, string, string]>([
    ['not_started', 'Sin empezar', 'radio_button_unchecked', 'bg-surface-container-high'],
    ['in_progress', 'En curso', 'edit', 'bg-info-container'],
    ['tests_failed', 'Con fallos', 'error', 'bg-warning-container'],
    ['passed', 'Superado', 'check_circle', 'bg-success-container'],
    ['submitted', 'Entregado', 'task_alt', 'bg-success'],
  ])('shows %s as "%s" with its icon and colour', (status, label, icon, background) => {
    const chip = render(status);

    expect(chip.textContent?.replace(icon, '').trim()).toBe(label);
    expect(chip.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(icon);
    expect(chip.classList).toContain(background);
    expect(chip.classList).toContain('rounded-full');
  });
});
