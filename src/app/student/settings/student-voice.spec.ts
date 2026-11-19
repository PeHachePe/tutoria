import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { SpeechLoader } from '../../core/speech/speech-loader';
import { FakeSpeechService, provideFakeSpeech } from '../../core/speech/speech-testing';
import { SettingsStore } from './settings-store';
import { StudentVoice } from './student-voice';

const jorge = { id: 'jorge', name: 'Jorge', lang: 'es-ES' };
const paulina = { id: 'paulina', name: 'Paulina', lang: 'es-MX' };
const alex = { id: 'alex', name: 'Alex', lang: 'en-US' };

describe('StudentVoice', () => {
  let fake: FakeSpeechService;
  let settings: SettingsStore;
  let voice: StudentVoice;
  const load = vi.fn();

  function setup(loader = provideFakeSpeech(fake)) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: { userId: signal('u1') } }, loader],
    });
    settings = TestBed.inject(SettingsStore);
    voice = TestBed.inject(StudentVoice);
  }

  async function turnOn() {
    settings.setVoice(true);
    await vi.waitFor(() => expect(voice.voicesLoading()).toBe(false));
    TestBed.tick();
    await vi.waitFor(() => expect(voice.speech()).toBe(fake));
    await vi.waitFor(() => expect(voice.voicesLoading()).toBe(false));
  }

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSpeechService();
    fake.voiceList = [paulina, jorge, alex];
    load.mockClear();
  });

  it('loads nothing with the voice off', async () => {
    setup({ provide: SpeechLoader, useValue: { load } });
    TestBed.tick();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    expect(voice.speech()).toBeUndefined();
    expect(voice.voices()).toEqual([]);
    expect(voice.canSpeak()).toBe(false);
    expect(await voice.say('Hola.')).toBe('cancelled');
    await voice.sample('jorge');
    voice.stop();
  });

  it('gives the voices of the language once on', async () => {
    setup();
    await turnOn();
    expect(voice.voices()).toEqual([paulina, jorge]);
    expect(voice.canSpeak()).toBe(true);
  });

  it('shows it is looking for the voices', () => {
    setup();
    settings.setVoice(true);
    TestBed.tick();
    expect(voice.voicesLoading()).toBe(true);
  });

  it('speaks with the most natural voice until the student chooses one in the list', async () => {
    setup();
    await turnOn();
    expect(voice.tutorVoice()).toEqual(paulina);
    expect(voice.chosen()).toBe(false);
    settings.setTutorVoice('alex');
    expect(voice.tutorVoice()).toEqual(paulina);
    expect(voice.chosen()).toBe(false);
    settings.setTutorVoice('jorge');
    expect(voice.tutorVoice()).toEqual(jorge);
    expect(voice.chosen()).toBe(true);
  });

  it('cannot speak without voices of the language nor without synthesis', async () => {
    fake.voiceList = [alex];
    setup();
    await turnOn();
    expect(voice.canSpeak()).toBe(false);
  });

  it('stays silent when the speech code or the voices cannot load', async () => {
    setup({
      provide: SpeechLoader,
      useValue: { load: () => Promise.reject(new Error('offline')) },
    });
    settings.setVoice(true);
    TestBed.tick();
    await vi.waitFor(() => expect(voice.voicesLoading()).toBe(false));
    expect(voice.speech()).toBeUndefined();

    TestBed.resetTestingModule();
    vi.spyOn(fake, 'voices').mockRejectedValue(new Error('no'));
    setup();
    await turnOn();
    expect(voice.voices()).toEqual([]);
  });

  it('says a sentence with the voice and speed, and nothing without a voice', async () => {
    fake.voiceList = [alex];
    setup();
    await turnOn();
    expect(await voice.say('Hola.')).toBe('cancelled');

    TestBed.resetTestingModule();
    fake.voiceList = [paulina, jorge];
    setup();
    await turnOn();
    settings.setTutorVoice('jorge');
    settings.setSpeechRate('fast');
    const said = voice.say('Hola.');
    await vi.waitFor(() => expect(fake.spoken).toHaveLength(1));
    expect(fake.spoken[0]).toEqual({
      sentence: 'Hola.',
      options: { voiceId: 'jorge', rate: 'fast' },
    });
    fake.finish();
    expect(await said).toBe('ended');
  });

  it('tries a voice after stopping what sounds, and never fails', async () => {
    setup();
    await turnOn();
    settings.setSpeechRate('slow');
    const tried = voice.sample('paulina');
    expect(fake.stops).toBe(1);
    expect(fake.spoken[0].options).toEqual({ voiceId: 'paulina', rate: 'slow' });
    expect(voice.sampling()).toBe('paulina');
    fake.fail();
    await expect(tried).resolves.toBeUndefined();
    expect(voice.sampling()).toBeNull();
    voice.stop();
    expect(fake.stops).toBe(2);
  });

  it('knows which voice is being tried, until another one or stop', async () => {
    setup();
    await turnOn();
    const first = voice.sample('paulina');
    const second = voice.sample('jorge');
    await first;
    expect(voice.sampling()).toBe('jorge');
    voice.stop();
    await second;
    expect(voice.sampling()).toBeNull();
  });

  it('still offers to stop a voice tried again while it sounds', async () => {
    setup();
    await turnOn();
    const first = voice.sample('paulina');
    const again = voice.sample('paulina');
    await first;
    expect(voice.sampling()).toBe('paulina');
    fake.finish();
    await again;
    expect(voice.sampling()).toBeNull();
  });

  it('follows the voices of the browser when they change, without looking for them again', async () => {
    setup();
    await turnOn();
    const monica = { id: 'monica', name: 'Mónica (mejorada)', lang: 'es-ES' };
    fake.changeVoices([monica, paulina, jorge]);
    TestBed.tick();
    expect(voice.voicesLoading()).toBe(false);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(voice.voices()).toEqual([monica, paulina, jorge]);
    });
    expect(voice.tutorVoice()).toEqual(monica);

    settings.setVoice(false);
    TestBed.tick();
    expect(fake.voicesWatchers).toBe(0);
  });

  it('unloads the speech when the voice is turned off', async () => {
    setup();
    await turnOn();
    settings.setVoice(false);
    TestBed.tick();
    expect(voice.speech()).toBeUndefined();
    expect(voice.canSpeak()).toBe(false);
  });
});
