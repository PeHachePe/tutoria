import { TestBed } from '@angular/core/testing';

import { LiveChip, type LiveReason, LiveReasonText, reasonsOf } from './live-reason';
import { liveRow } from './live-row';
import { ago, BLOCK_EXERCISES, NOW, STUDENTS, testAttempt, testInteraction } from './live-testing';
import { testEvents as e } from '../../data/process-event-testing';

function text(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function reasonText(reason: LiveReason, short = false): string {
  const fixture = TestBed.createComponent(LiveReasonText);
  fixture.componentRef.setInput('reason', reason);
  fixture.componentRef.setInput('short', short);
  fixture.detectChanges();
  return text(fixture.nativeElement);
}

const REASONS: [LiveReason, string, string][] = [
  [
    { kind: 'hints_exhausted', since: 0 },
    'Sin más pistas',
    'Ya tuvo la pista de nivel 3 y sigue fallando',
  ],
  [
    { kind: 'stuck_failures', failures: 4, askedForHints: true, since: 0 },
    'Atascado',
    'Falla 4 veces seguidas la misma prueba',
  ],
  [
    { kind: 'stuck_failures', failures: 3, askedForHints: false, since: 0 },
    'Atascado',
    'Falla 3 veces seguidas la misma prueba y no ha pedido ninguna pista',
  ],
  [
    { kind: 'hint_rush', hints: 3, since: 0 },
    'Pistas seguidas',
    'Ha pedido 3 pistas seguidas sin ejecutar las pruebas',
  ],
  [
    { kind: 'chat_stuck', messages: 2, since: 0 },
    'No sabe seguir',
    'Le ha dicho al tutor 2 veces que no sabe seguir',
  ],
  [
    { kind: 'paste_submit', chars: 400, runs: 0 },
    'Entrega con pegado',
    'Entregó tras pegar 400 caracteres, sin ejecutar las pruebas',
  ],
  [
    { kind: 'paste_submit', chars: 300, runs: 1 },
    'Entrega con pegado',
    'Entregó tras pegar 300 caracteres, con 1 ejecución',
  ],
  [
    { kind: 'paste_submit', chars: 300, runs: 2 },
    'Entrega con pegado',
    'Entregó tras pegar 300 caracteres, con 2 ejecuciones',
  ],
  [
    { kind: 'paste_on_return', chars: 250 },
    'Pegado al volver',
    'Pegó 250 caracteres al poco de volver a la ventana',
  ],
  [
    { kind: 'submit_burst', count: 3, minutes: 10 },
    'Ráfaga de entregas',
    '3 entregas en menos de 10 min',
  ],
  [
    { kind: 'repeated', count: 1 },
    'Repite ejercicios',
    'Practica de nuevo 1 ejercicio ya entregado',
  ],
  [
    { kind: 'repeated', count: 2 },
    'Repite ejercicios',
    'Practica de nuevo 2 ejercicios ya entregados',
  ],
  [
    { kind: 'breakthrough', failures: 4 },
    'Superó tras insistir',
    'Superó una prueba que había fallado 4 veces seguidas',
  ],
];

describe('LiveReasonText', () => {
  it.each(REASONS)('says %o as a fact: "%s" and "%s"', (reason, short, long) => {
    expect(reasonText(reason, true)).toBe(short);
    expect(reasonText(reason)).toBe(long);
  });
});

describe('LiveChip', () => {
  it.each<[LiveReason, string, string]>([
    [{ kind: 'chat_stuck', messages: 2, since: 0 }, 'forum', 'bg-warning-container'],
    [{ kind: 'paste_on_return', chars: 250 }, 'content_paste_go', 'bg-info-container'],
    [{ kind: 'repeated', count: 2 }, 'replay', 'bg-success-container'],
  ])('shows %o with its icon and the colour of its tone', (reason, icon, background) => {
    const fixture = TestBed.createComponent(LiveChip);
    fixture.componentRef.setInput('reason', reason);
    fixture.detectChanges();
    const chip = fixture.nativeElement as HTMLElement;

    expect(chip.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(icon);
    expect(chip.classList).toContain(background);
  });
});

describe('reasonsOf', () => {
  it('lists the reason, then the patterns, then the perseverance', () => {
    const submitted = testAttempt('a1', 'ana', {
      status: 'submitted',
      finishedAt: ago(30),
      updatedAt: ago(30),
    });
    const practice = testAttempt('a2', 'ana', {
      number: 2,
      status: 'tests_failed',
      startedAt: ago(9),
      updatedAt: ago(2),
    });
    const events = [
      ...[5, 4, 3].map((m) => e.run('a2', ago(m), ['e1-t1'])),
      e.run('a2', ago(2), ['e1-t2']),
    ];
    const interactions = [2, 1].map((m) =>
      testInteraction('a2', ago(m), { trigger: 'question', studentMessage: 'no sé seguir' }),
    );
    const row = liveRow(
      { student: STUDENTS[0], attempts: [submitted, practice], events, interactions },
      BLOCK_EXERCISES,
      NOW,
    );

    expect(reasonsOf(row).map((reason) => reason.kind)).toEqual([
      'chat_stuck',
      'breakthrough',
      'repeated',
    ]);
  });
});
