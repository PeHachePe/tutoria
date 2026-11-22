import { DataError } from '../../../data/data-error';
import { isLongWait } from '../../../shared/is-long-wait';

/** What the tutor says aloud when an answer fails in a call, and whether the call waits. */
export interface CallFailurePhrase {
  readonly text: string;
  /** Too many questions: the call goes on hold instead of listening again (2.11). */
  readonly hold: boolean;
}

/**
 * The fixed sentence of a failed answer in a call (2.11): the chat keeps its «Reintentar», and with
 * the limit of questions it says how long to wait, as a time it can be said in.
 */
export function callFailurePhrase(error: unknown, now: number): CallFailurePhrase {
  if (!(error instanceof DataError) || error.kind !== 'rate_limited') {
    return { text: $localize`:@@call.failed:No he podido responder.`, hold: false };
  }
  if (isLongWait(error, now)) {
    return {
      text: $localize`:@@call.dailyLimit:Has llegado al límite de preguntas de hoy. Podremos seguir más tarde.`,
      hold: true,
    };
  }
  const seconds = Math.ceil(((error.retryAt ?? now) - now) / 1000);
  return {
    text:
      seconds > 0
        ? $localize`:@@call.rateLimited:Has preguntado muchas veces seguidas. Espera ${seconds}:seconds: segundos y seguimos.`
        : $localize`:@@call.rateLimited.soon:Has preguntado muchas veces seguidas. Espera un momento y seguimos.`,
    hold: true,
  };
}
