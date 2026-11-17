import { TestBed } from '@angular/core/testing';

import type { AttentionReason } from './live-attention';
import { LiveChip, type LiveReason, LiveReasonText } from './live-reason';

function text(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('LiveReasonText', () => {
  it.each<[AttentionReason, string]>([
    [{ kind: 'hints_exhausted', since: 0 }, 'Ya tuvo la pista de nivel 3 y sigue fallando'],
    [
      { kind: 'stuck_failures', failures: 4, askedForHints: true, since: 0 },
      'Falla 4 veces seguidas la misma prueba',
    ],
    [
      { kind: 'stuck_failures', failures: 3, askedForHints: false, since: 0 },
      'Falla 3 veces seguidas la misma prueba y no ha pedido ninguna pista',
    ],
    [
      { kind: 'hint_rush', hints: 3, since: 0 },
      'Ha pedido 3 pistas seguidas sin ejecutar las pruebas',
    ],
    [
      { kind: 'chat_stuck', messages: 2, since: 0 },
      'Le ha dicho al tutor 2 veces que no sabe seguir',
    ],
  ])('says %o as a fact: "%s"', (reason, sentence) => {
    const fixture = TestBed.createComponent(LiveReasonText);
    fixture.componentRef.setInput('reason', reason);
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toBe(sentence);
  });
});

describe('LiveChip', () => {
  it.each<[LiveReason, string, string, string]>([
    [{ kind: 'hints_exhausted', since: 0 }, 'front_hand', 'Sin más pistas', 'bg-warning-container'],
    [
      { kind: 'stuck_failures', failures: 4, askedForHints: true, since: 0 },
      'replay',
      'Atascado',
      'bg-warning-container',
    ],
    [
      { kind: 'chat_stuck', messages: 2, since: 0 },
      'forum',
      'No sabe seguir',
      'bg-warning-container',
    ],
    [
      { kind: 'hint_rush', hints: 3, since: 0 },
      'fast_forward',
      'Pistas seguidas',
      'bg-warning-container',
    ],
    [{ kind: 'away' }, 'visibility_off', 'Fuera de la ventana', 'bg-surface-container-high'],
    [
      { kind: 'paste_submit', chars: 400, runs: 0 },
      'content_paste',
      'Entregó tras pegar 400 caracteres',
      'bg-info-container',
    ],
    [
      { kind: 'paste_on_return', chars: 250 },
      'content_paste_go',
      'Pegó al volver a la ventana',
      'bg-info-container',
    ],
    [
      { kind: 'submit_burst', count: 3, minutes: 10 },
      'bolt',
      'Ráfaga de entregas',
      'bg-info-container',
    ],
    [{ kind: 'repeated', count: 2 }, 'replay', 'Repite ejercicios', 'bg-success-container'],
    [
      { kind: 'breakthrough', failures: 4 },
      'emoji_events',
      'Superó tras insistir',
      'bg-success-container',
    ],
  ])('shows %o with its icon, its label and its tone', (reason, icon, label, background) => {
    const fixture = TestBed.createComponent(LiveChip);
    fixture.componentRef.setInput('reason', reason);
    fixture.detectChanges();
    const chip = fixture.nativeElement as HTMLElement;

    expect(chip.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(icon);
    expect(text(chip).replace(icon, '').trim()).toBe(label);
    expect(chip.classList).toContain(background);
  });
});
