import type { AppLocale } from '../../../core/i18n/locale';
import { LOCALE_NAMES } from '../../../core/i18n/locale-names';
import type { ListenError } from '../../../core/speech/speech-service';

/**
 * Message for a dictation that could not listen (2.11): what failed and what to do, always with
 * typing as a way on; what was written is never lost.
 */
export function listenErrorMessage(error: ListenError, language: AppLocale): string {
  switch (error) {
    case 'not-allowed':
      return $localize`:@@voice.error.notAllowed:No tengo permiso para usar el micrófono. Dámelo desde el icono de la barra de direcciones, o sigue escribiendo.`;
    case 'no-microphone':
      return $localize`:@@voice.error.noMicrophone:No encuentro ningún micrófono. Conecta uno, o sigue escribiendo.`;
    case 'service-unavailable':
      return $localize`:@@voice.error.serviceUnavailable:El reconocimiento de voz no está disponible ahora. Inténtalo más tarde, o sigue escribiendo.`;
    case 'language-not-supported':
      return $localize`:@@voice.error.languageNotSupported:Tu navegador no reconoce la voz en ${LOCALE_NAMES[language]}:idioma:. Puedes seguir escribiendo.`;
  }
}
