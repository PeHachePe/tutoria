// TypeScript's DOM library has the events and results of the speech recognition but not the
// recognition itself: this is the least the app uses of it, as MDN describes it (2.11).

/** What `available()` says of a language, for recognising on the device. */
export type RecognitionAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface RecognitionOptions {
  /** BCP 47 tags. */
  readonly langs: string[];
  readonly processLocally: boolean;
}

export interface RecognitionApi {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** Only where the browser can recognise on the device. */
  processLocally?: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognitionConstructor {
  new (): RecognitionApi;
  /** Whether the language can be recognised on the device; only in the browsers that can. */
  available?(options: RecognitionOptions): Promise<RecognitionAvailability>;
  /** Downloads the packs of those languages; whether they are there now. */
  install?(options: RecognitionOptions): Promise<boolean>;
}

/** The window as the browsers give the recognition: standard or with the `webkit` prefix. */
export interface RecognitionWindow {
  readonly SpeechRecognition?: RecognitionConstructor;
  readonly webkitSpeechRecognition?: RecognitionConstructor;
}
