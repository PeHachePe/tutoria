import { injectAsync, Service } from '@angular/core';

import type { SpeechService } from './speech-service';

/** Fetches the Web Speech code apart from the rest, and only when the voice is on (2.11). */
@Service()
export class SpeechLoader {
  private readonly web = injectAsync(() =>
    import('./web-speech-service').then((file) => file.WebSpeechService),
  );

  /** Downloads the Web Speech code the first time: only called with the voice on (2.11). */
  load(): Promise<SpeechService> {
    return this.web();
  }
}
