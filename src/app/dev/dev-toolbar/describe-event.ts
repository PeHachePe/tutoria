import type { ProcessEvent } from '../../data/process-event';

/** Short description of a process event in Spanish, for the dev toolbar. */
export function describeEvent(event: ProcessEvent): string {
  switch (event.type) {
    case 'run':
      return `Ejecución: ${event.detail.passed}/${event.detail.passed + event.detail.failed} superadas`;
    case 'submit':
      return 'Entrega';
    case 'hint_requested':
      return `Pista de nivel ${event.detail.level}`;
    case 'proactive_intervention':
      return event.detail.silent ? 'Intervención proactiva (calla)' : 'Intervención proactiva';
    case 'paste':
      return `Pegado de ${event.detail.length} caracteres`;
    case 'focus_lost':
      return 'Sale de la pestaña';
    case 'focus_gained':
      return 'Vuelve a la pestaña';
  }
}
