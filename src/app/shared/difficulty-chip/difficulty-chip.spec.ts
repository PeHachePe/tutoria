import { TestBed } from '@angular/core/testing';

import type { Difficulty } from '../../data/exercise';
import { DifficultyChip } from './difficulty-chip';

describe('DifficultyChip', () => {
  it.each<[Difficulty, string, string]>([
    ['initial', 'Inicial', 'stat_1'],
    ['medium', 'Media', 'stat_2'],
    ['advanced', 'Avanzada', 'stat_3'],
    ['extension', 'Ampliación', 'add_circle'],
  ])('shows %s as "%s" with its icon', (difficulty, label, icon) => {
    const fixture = TestBed.createComponent(DifficultyChip);
    fixture.componentRef.setInput('difficulty', difficulty);
    fixture.detectChanges();
    const chip = fixture.nativeElement as HTMLElement;

    expect(chip.textContent?.replace(icon, '').trim()).toBe(label);
    expect(chip.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(icon);
    expect(chip.classList).toContain('border-outline-variant');
  });
});
