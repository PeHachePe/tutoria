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

    it('does not say a sentence silenced while it waited for the voices', async () => {
      synthesis.voices = [];
      const said = speech.speak('Hola.', { voiceId: 'jorge', rate: 'normal' });
      speech.stopSpeaking();
      synthesis.voices = [jorge];
      synthesis.dispatchEvent(new Event('voiceschanged'));
      expect(await said).toBe('cancelled');
      expect(synthesis.queue).toEqual([]);
    });

    it('stops speaking', () => {
      speech.stopSpeaking();
      expect(synthesis.cancelled).toBe(1);
    });
  });

  describe('listening', () => {
    /** A result of the recognition, as the browser lists them. */
    function result(transcript: string, isFinal: boolean) {
      return Object.assign([{ transcript, confidence: 0.9 }], { isFinal });
    }

    class FakeRecognition {
      static readonly made: FakeRecognition[] = [];
      static availability: string | Promise<string> = 'available';
      static installed: boolean | Promise<boolean> = true;
      static readonly asked: object[] = [];
      static failsToStart = false;
      lang = '';
      continuous = false;
      interimResults = false;
      processLocally?: boolean;
      onresult: ((event: object) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      started = 0;
      aborted = 0;
      constructor() {
        FakeRecognition.made.push(this);
      }
      static available(options: object): Promise<string> {
        FakeRecognition.asked.push(options);
        return Promise.resolve(FakeRecognition.availability);
      }
      static install(options: object): Promise<boolean> {
        FakeRecognition.asked.push(options);
        return Promise.resolve(FakeRecognition.installed);
      }
      start(): void {
        if (FakeRecognition.failsToStart) throw new Error('InvalidStateError');
        this.started++;
      }
      stop(): void {
        this.onend?.();
      }
      abort(): void {
        this.aborted++;
        this.onerror?.({ error: 'aborted' });
        this.onend?.();
      }
      /** The browser hears: the results from `resultIndex` on are the ones that changed. */
      hear(resultIndex: number, ...results: ReturnType<typeof result>[]): void {
        this.onresult?.({ resultIndex, results });
      }
    }

    function withRecognition(Recognition: object, name = 'SpeechRecognition'): WebSpeechService {
      TestBed.resetTestingModule();
      return setup({ [name]: Recognition });
    }

    beforeEach(() => {
      FakeRecognition.made.length = 0;
      FakeRecognition.asked.length = 0;
      FakeRecognition.availability = 'available';
      FakeRecognition.installed = true;
      speech = withRecognition(FakeRecognition);
    });

    function listen(language: 'es' | 'en' | 'ca' = 'es') {
      const heard = vi.fn();
      const listening = speech.listen(language, heard);
      return { heard, listening, recognition: FakeRecognition.made.at(-1) };
    }

    it('opens the microphone in the language, continuous and with what it is understanding', () => {
      const { recognition } = listen('ca');
      expect(recognition).toMatchObject({
        lang: 'ca-ES',
        continuous: true,
        interimResults: true,
        started: 1,
      });
      expect(recognition?.processLocally).toBeUndefined();
    });

    it('gives what it is understanding, which the final one replaces', () => {
      const { heard, recognition } = listen();
      recognition?.hear(0, result('no ', false));
      recognition?.hear(0, result('no entiendo', false));
      recognition?.hear(0, result(' no entiendo el bucle ', true));
      expect(heard.mock.calls).toEqual([
        [{ text: 'no', final: false }],
        [{ text: 'no entiendo', final: false }],
        [{ text: 'no entiendo el bucle', final: true }],
      ]);
    });

    it('gives each final sentence and, together, what follows it', () => {
      const { heard, recognition } = listen();
      const first = result('primera frase', true);
      recognition?.hear(0, first, result('segunda', false), result(' frase', false));
      recognition?.hear(1, first, result('segunda frase', true), result('   ', false));
      expect(heard.mock.calls).toEqual([
        [{ text: 'primera frase', final: true }],
        [{ text: 'segunda frase', final: false }],
        [{ text: 'segunda frase', final: true }],
      ]);
    });

    it('says nothing for an empty result', () => {
      const { heard, recognition } = listen();
      recognition?.hear(0, result(' ', true));
      recognition?.hear(0, Object.assign([], { isFinal: false }));
      expect(heard).not.toHaveBeenCalled();
    });

    it('closes the microphone when stopped, and hears nothing after it', async () => {
      const { heard, listening, recognition } = listen();
      listening.stop();
      recognition?.hear(0, result('tarde', true));
      expect(recognition?.aborted).toBe(1);
      expect(await listening.ended).toBe('stopped');
      expect(heard).not.toHaveBeenCalled();
    });

    it.each([
      ['not-allowed', 'not-allowed'],
      ['service-not-allowed', 'service-unavailable'],
      ['audio-capture', 'no-microphone'],
      ['network', 'service-unavailable'],
      ['phrases-not-supported', 'service-unavailable'],
      ['bad-grammar', 'service-unavailable'],
      ['language-not-supported', 'language-not-supported'],
      ['no-speech', 'silence'],
      ['aborted', 'stopped'],
    ])('ends the error %s as %s, only once', async (error, end) => {
      const { listening, recognition } = listen();
      recognition?.onerror?.({ error });
      recognition?.onend?.();
      expect(await listening.ended).toBe(end);
    });

    it('takes an end it did not ask for as silence', async () => {
      const { listening, recognition } = listen();
      recognition?.stop();
      expect(await listening.ended).toBe('silence');
    });

    it('ends as unavailable when the microphone does not start', async () => {
      FakeRecognition.failsToStart = true;
      const { listening } = listen();
      FakeRecognition.failsToStart = false;
      expect(await listening.ended).toBe('service-unavailable');
    });

    it('uses the recognition with the webkit prefix', async () => {
      speech = withRecognition(FakeRecognition, 'webkitSpeechRecognition');
      expect(await speech.recognition('es')).toBe('device');
      listen();
      expect(FakeRecognition.made).toHaveLength(1);
    });

    it('cannot recognise without the recognition, and its listening ends at once', async () => {
      speech = withRecognition(FakeRecognition, 'nothing');
      expect(await speech.recognition('es')).toBe('none');
      expect(await speech.installRecognition('es')).toBe(false);
      const listening = speech.listen('es', vi.fn());
      listening.stop();
      expect(await listening.ended).toBe('service-unavailable');
    });

    it('transcribes in the service of a browser that cannot tell', async () => {
      // Without the static methods, as the browsers that came before recognising on the device
      speech = withRecognition(class {});
      expect(await speech.recognition('es')).toBe('server');
      expect(await speech.installRecognition('es')).toBe(false);
    });

    it.each([
      ['available', 'device'],
      ['downloadable', 'downloadable'],
      ['downloading', 'downloadable'],
      ['unavailable', 'server'],
    ])('takes %s on the device as %s', async (availability, place) => {
      FakeRecognition.availability = availability;
      expect(await speech.recognition('en')).toBe(place);
      expect(FakeRecognition.asked).toEqual([{ langs: ['en-US'], processLocally: true }]);
    });

    it('transcribes in the service when the browser cannot answer', async () => {
      FakeRecognition.availability = Promise.reject(new Error('SyntaxError'));
      expect(await speech.recognition('es')).toBe('server');
    });

    it('recognises on the device only where it can', async () => {
      await speech.recognition('es');
      expect(listen('es').recognition?.processLocally).toBe(true);
      expect(listen('en').recognition?.processLocally).toBeUndefined();

      FakeRecognition.availability = 'downloadable';
      await speech.recognition('es');
      expect(listen('es').recognition?.processLocally).toBeUndefined();
    });

    it('downloads the language pack', async () => {
      expect(await speech.installRecognition('ca')).toBe(true);
      expect(FakeRecognition.asked).toEqual([{ langs: ['ca-ES'], processLocally: true }]);
      FakeRecognition.installed = false;
      expect(await speech.installRecognition('ca')).toBe(false);
      FakeRecognition.installed = Promise.reject(new Error('NotAllowedError'));
      expect(await speech.installRecognition('ca')).toBe(false);
    });
  });
});
