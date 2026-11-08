import type { ProcessEvent } from '../../data/process-event';
import { describeEvent } from './describe-event';

const base = { id: 'e1', attemptId: 'a1', timestamp: '2026-11-10T09:30:00.000Z' };

describe('describeEvent', () => {
  it.each<[ProcessEvent, string]>([
    [
      { ...base, type: 'run', detail: { passed: 3, failed: 2, failedTestIds: ['t1', 't2'] } },
      'Ejecución: 3/5 superadas',
    ],
    [{ ...base, type: 'submit', detail: null }, 'Entrega'],
    [{ ...base, type: 'hint_requested', detail: { level: 2 } }, 'Pista de nivel 2'],
    [
      { ...base, type: 'proactive_intervention', detail: { silent: false } },
      'Intervención proactiva',
    ],
    [
      { ...base, type: 'proactive_intervention', detail: { silent: true } },
      'Intervención proactiva (calla)',
    ],
    [{ ...base, type: 'paste', detail: { length: 240 } }, 'Pegado de 240 caracteres'],
    [{ ...base, type: 'focus_lost', detail: null }, 'Sale de la ventana'],
    [{ ...base, type: 'focus_gained', detail: { awayMs: 2_400 } }, 'Vuelve tras 2 s'],
    [{ ...base, type: 'focus_gained', detail: { awayMs: 59_600 } }, 'Vuelve tras 1 min'],
    [{ ...base, type: 'focus_gained', detail: { awayMs: 80_000 } }, 'Vuelve tras 1 min 20 s'],
    [{ ...base, type: 'focus_gained', detail: { awayMs: 3_600_000 } }, 'Vuelve tras 60 min'],
  ])('describes %o', (event, text) => {
    expect(describeEvent(event)).toBe(text);
  });
});
