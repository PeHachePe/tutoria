import { TestBed } from '@angular/core/testing';

import { SpeechLoader } from './speech-loader';
import { WebSpeechService } from './web-speech-service';

describe('SpeechLoader', () => {
  it('loads the Web Speech service, the same one each time', async () => {
    const loader = TestBed.inject(SpeechLoader);
    const first = await loader.load();
    expect(first).toBeInstanceOf(WebSpeechService);
    expect(await loader.load()).toBe(first);
  });
});
