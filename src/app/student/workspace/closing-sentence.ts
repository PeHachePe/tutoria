import type { AppLocale } from '../../core/i18n/locale';

/** What an answer leaves in the chat that is not said aloud. */
export interface LeftInChat {
  /** It had a block of code. */
  readonly code: boolean;
  /** The buttons it leaves for the student, by their names. */
  readonly buttons: readonly string[];
  /** How many closings about code alone were said before, to take the next phrasing. */
  readonly said: number;
}

/** About code alone there is no name to say, so the phrasings take turns: none twice in a row. */
const CODE_CLOSINGS = [
  $localize`:@@tutor.voice.closing.code:Te dejo el código en el chat.`,
  $localize`:@@tutor.voice.closing.code2:El código lo tienes en el chat.`,
  $localize`:@@tutor.voice.closing.code3:Échale un ojo al código en el chat.`,
];

/**
 * The last sentence the tutor says when its answer leaves something only in the chat (2.11): which
 * button, so the student knows what to press without looking, or that there is code; null when
 * everything was said. Iteration 2 of 6.1c: the same «Te lo dejo en el chat» every time sounded
 * like a verbal tic.
 */
export function closingSentence(
  { code, buttons, said }: LeftInChat,
  locale: AppLocale,
): string | null {
  if (buttons.length === 0) return code ? CODE_CLOSINGS[said % CODE_CLOSINGS.length] : null;
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(buttons);
  if (buttons.length === 1) {
    return code
      ? $localize`:@@tutor.voice.closing.codeAndButton:Te dejo en el chat el código y el botón ${names}:button:.`
      : $localize`:@@tutor.voice.closing.button:Te dejo en el chat el botón ${names}:button:.`;
  }
  return code
    ? $localize`:@@tutor.voice.closing.codeAndButtons:Te dejo en el chat el código y los botones ${names}:buttons:.`
    : $localize`:@@tutor.voice.closing.buttons:Te dejo en el chat los botones ${names}:buttons:.`;
}
