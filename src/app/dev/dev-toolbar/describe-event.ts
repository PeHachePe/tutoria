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
      return 'Sale de la ventana';
    case 'focus_gained':
      return `Vuelve tras ${describeDuration(event.detail.awayMs)}`;
  }
}

/** A time away in seconds or minutes, rounded to the second: «45 s», «1 min 20 s». */
function describeDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}
