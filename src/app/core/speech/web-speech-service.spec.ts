import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SpeechError } from './speech-service';
import { VOICES_TIMEOUT_MS, WebSpeechService } from './web-speech-service';

interface FakeVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
}

class FakeUtterance {
  voice: FakeVoice | null = null;
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

class FakeSynthesis extends EventTarget {
  voices: FakeVoice[] = [];
  readonly queue: FakeUtterance[] = [];
  cancelled = 0;
  getVoices(): FakeVoice[] {
    return this.voices;
  }
  speak(utterance: FakeUtterance): void {
    this.queue.push(utterance);
  }
  cancel(): void {
    this.cancelled++;
  }
}

const jorge = { voiceURI: 'jorge', name: 'Jorge', lang: 'es-ES', localService: true };
const paulina = { voiceURI: 'paulina', name: 'Paulina', lang: 'es_MX', localService: false };
const alex = { voiceURI: 'alex', name: 'Alex', lang: 'en-US' };

function setup(window: object): WebSpeechService {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: window } }],
  });
  return TestBed.inject(WebSpeechService);
}

describe('WebSpeechService', () => {
  let synthesis: FakeSynthesis;
  let speech: WebSpeechService;

  beforeEach(() => {
    synthesis = new FakeSynthesis();
    speech = setup({ speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance });
  });

  it('cannot speak nor give voices without synthesis', async () => {
    TestBed.resetTestingModule();
    const without = setup({});
    expect(without.canSpeak).toBe(false);
    expect(await without.voices('es')).toEqual([]);
    without.stopSpeaking();
    without.onVoicesChanged(() => undefined)();
    await expect(without.speak('Hola.', { voiceId: 'jorge', rate: 'normal' })).rejects.toEqual(
      new SpeechError('voice-unavailable'),
    );
  });

  it('can speak with synthesis', () => {
    expect(speech.canSpeak).toBe(true);
  });

  it('gives only the voices of the language, once each and the most natural first', async () => {
    synthesis.voices = [
      paulina,
      alex,
      jorge,
      { ...jorge },
      { voiceURI: 'x', name: 'Es', lang: 'est' },
    ];
    expect(await speech.voices('es')).toEqual([
      { id: 'paulina', name: 'Paulina', lang: 'es-MX', local: false },
      { id: 'jorge', name: 'Jorge', lang: 'es-ES', local: true },
    ]);
  });

  it('waits for the voices that arrive late', async () => {
    const voices = speech.voices('es');
    synthesis.voices = [jorge];
    synthesis.dispatchEvent(new Event('voiceschanged'));
    expect(await voices).toHaveLength(1);
  });

  it('gives up on the voices that never arrive', async () => {
    vi.useFakeTimers();
    const voices = speech.voices('es');
    vi.advanceTimersByTime(VOICES_TIMEOUT_MS);
    expect(await voices).toEqual([]);
    vi.useRealTimers();
  });

  describe('speaking', () => {
    beforeEach(() => (synthesis.voices = [jorge, alex]));

    async function say(rate: 'slow' | 'normal' | 'fast' = 'normal') {
      const said = speech.speak('Hola.', { voiceId: 'jorge', rate });
      await vi.waitFor(() => expect(synthesis.queue).toHaveLength(1));
      return { said, utterance: synthesis.queue[0] };
    }

    it('says the sentence with the voice, its language and the speed', async () => {
      const { said, utterance } = await say('slow');
      expect(utterance).toMatchObject({ text: 'Hola.', voice: jorge, lang: 'es-ES', rate: 0.85 });
      utterance.onend?.();
      expect(await said).toBe('ended');
    });

    it('is cancelled when silenced', async () => {
      for (const error of ['canceled', 'interrupted']) {
        synthesis.queue.length = 0;
        const { said, utterance } = await say();
        utterance.onerror?.({ error });
        expect(await said).toBe('cancelled');
      }
    });

    it('rejects when the synthesis fails', async () => {
      const { said, utterance } = await say('fast');
      expect(utterance.rate).toBe(1.2);
      utterance.onerror?.({ error: 'synthesis-failed' });
      await expect(said).rejects.toEqual(new SpeechError('synthesis-failed'));
    });

    it('keeps hold of the newest utterance while an older one ends', async () => {
      const first = speech.speak('Uno.', { voiceId: 'jorge', rate: 'normal' });
      const second = speech.speak('Dos.', { voiceId: 'jorge', rate: 'normal' });
      await vi.waitFor(() => expect(synthesis.queue).toHaveLength(2));
      synthesis.queue[0].onend?.();
      synthesis.queue[1].onend?.();
      expect(await Promise.all([first, second])).toEqual(['ended', 'ended']);
    });

    it('rejects without the voice', async () => {
      await expect(speech.speak('Hola.', { voiceId: 'nadie', rate: 'normal' })).rejects.toEqual(
        new SpeechError('voice-unavailable'),
      );
    });

    it('tells when the voices change, until it stops listening', () => {
      const listener = vi.fn();
      const off = speech.onVoicesChanged(listener);
      synthesis.dispatchEvent(new Event('voiceschanged'));
      off();
      synthesis.dispatchEvent(new Event('voiceschanged'));
      expect(listener).toHaveBeenCalledOnce();
    });

    it('stops speaking', () => {
      speech.stopSpeaking();
      expect(synthesis.cancelled).toBe(1);
    });
  });
});
