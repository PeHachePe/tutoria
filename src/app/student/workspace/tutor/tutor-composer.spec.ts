import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../../auth/auth-store';
import type { RecognitionPlace } from '../../../core/speech/speech-service';
import { FakeSpeechService, provideFakeSpeech } from '../../../core/speech/speech-testing';
import { settingKey } from '../../settings/settings-store';
import { StudentVoice } from '../../settings/student-voice';
import { TutorSpeaker } from '../tutor-speaker';
import { TutorStore } from '../tutor-store';
import { DICTATION_SILENCE_MS, MAX_QUESTION_LENGTH, TutorComposer } from './tutor-composer';

interface Setup {
  voice?: boolean;
  place?: RecognitionPlace;
  noticeSeen?: boolean;
  /** False, as in the teacher's preview. */
  speaker?: boolean;
}

async function renderComposer({
  voice = true,
  place = 'device',
  noticeSeen = false,
  speaker = true,
}: Setup = {}) {
  localStorage.setItem(settingKey('voice', 'u1'), String(voice));
  localStorage.setItem(settingKey('audioNoticeSeen', 'u1'), String(noticeSeen));
  const fake = new FakeSpeechService();
  fake.place = place;
  const ask = vi.fn(() => Promise.resolve());
  const stopSpeaking = vi.fn();
  const view = await render(TutorComposer, {
    providers: [
      { provide: AuthStore, useValue: { userId: signal('u1') } },
      { provide: TutorStore, useValue: { canAsk: signal(true), ask } },
      provideFakeSpeech(fake),
      speaker ? [{ provide: TutorSpeaker, useValue: { stop: stopSpeaking } }] : [],
    ],
  });
  if (voice && place !== 'none' && speaker) {
    await vi.waitFor(() => {
      view.fixture.detectChanges();
      expect(dictateButton()).toBeTruthy();
    });
  } else {
    await view.fixture.whenStable();
  }
  return { ...view, fake, ask, stopSpeaking };
}

function dictateButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'Dictar' });
}

function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Pregunta al tutor' });
}

async function startDictating(view: Awaited<ReturnType<typeof renderComposer>>) {
  fireEvent.click(dictateButton() as HTMLElement);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
}

/** The microphone hears, and the field shows it. */
function hear(view: Awaited<ReturnType<typeof renderComposer>>, text: string, final = true) {
  view.fake.hear(text, final);
  view.fixture.detectChanges();
}

describe('TutorComposer, dictating', () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it.each([
    ['with the voice off', { voice: false }],
    ['without recognition', { place: 'none' as const }],
    ["in the teacher's preview", { speaker: false }],
  ])('offers no «Dictar» %s', async (_, setup) => {
    await renderComposer(setup);
    expect(dictateButton()).toBeNull();
    expect(screen.getByRole('button', { name: 'Enviar la pregunta' })).toBeTruthy();
  });

  it('starts listening, says so once and keeps the focus in the field', async () => {
    const view = await renderComposer();
    await userEvent.click(dictateButton() as HTMLElement);
    view.fixture.detectChanges();

    expect(view.fake.listening).toBe(true);
    expect(dictateButton()?.getAttribute('aria-pressed')).toBe('true');
    // Material's hints are a polite live region: it is said once, when the microphone opens
    expect(screen.getByText('Te escucho…').closest('[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByText(/Intro para enviar/)).toBeNull();
    expect(document.activeElement).toBe(field());
    expect(view.stopSpeaking).toHaveBeenCalled();
  });

  it('replaces what it is understanding, keeps what is final, after what was written', async () => {
    const view = await renderComposer();
    await userEvent.type(field(), 'Tengo una duda.');
    await startDictating(view);

    hear(view, 'no', false);
    expect(field().value).toBe('Tengo una duda. No');
    hear(view, 'no entiendo', false);
    expect(field().value).toBe('Tengo una duda. No entiendo');
    hear(view, 'no entiendo el bucle');
    hear(view, '¿por qué', false);
    expect(field().value).toBe('Tengo una duda. No entiendo el bucle ¿por qué');
    hear(view, '¿por qué empieza en uno?');
    expect(field().value).toBe('Tengo una duda. No entiendo el bucle ¿por qué empieza en uno?');
    expect(view.ask).not.toHaveBeenCalled();
  });

  it('cuts it at the longest question', async () => {
    const view = await renderComposer();
    await startDictating(view);
    hear(view, 'a'.repeat(MAX_QUESTION_LENGTH + 20));
    expect(field().value).toHaveLength(MAX_QUESTION_LENGTH);
  });

  it('stops with the button, keeping what it was understanding', async () => {
    const view = await renderComposer();
    await startDictating(view);
    hear(view, 'casi', false);
    fireEvent.click(dictateButton() as HTMLElement);
    view.fixture.detectChanges();

    expect(view.fake.listening).toBe(false);
    expect(dictateButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(field().value).toBe('Casi');
    expect(screen.getByText(/Intro para enviar/)).toBeTruthy();
  });

  it('stops with Esc without it reaching the floating tutor, which Esc folds', async () => {
    const view = await renderComposer();
    const fold = vi.fn();
    view.fixture.nativeElement.addEventListener('keydown', fold);
    await startDictating(view);

    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(view.fake.listening).toBe(false);
    expect(fold).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(fold).toHaveBeenCalledOnce();
  });

  it('stops when the student types, which takes over', async () => {
    const view = await renderComposer();
    await startDictating(view);
    hear(view, 'hola');
    await userEvent.type(field(), '!');
    expect(view.fake.listening).toBe(false);
    expect(field().value).toBe('Hola!');
  });

  it('stops when the question is sent, and sends only then', async () => {
    const view = await renderComposer();
    await startDictating(view);
    hear(view, '¿qué hago?');
    expect(view.ask).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar la pregunta' }));
    expect(view.fake.listening).toBe(false);
    expect(view.ask).toHaveBeenCalledWith('¿Qué hago?');
    expect(field().value).toBe('');
  });

  it('stops after a silence, which each result starts again', async () => {
    vi.useFakeTimers();
    const view = await renderComposer();
    await startDictating(view);
    vi.advanceTimersByTime(DICTATION_SILENCE_MS - 1);
    hear(view, 'uno', false);
    vi.advanceTimersByTime(DICTATION_SILENCE_MS - 1);
    expect(view.fake.listening).toBe(true);
    vi.advanceTimersByTime(1);
    expect(view.fake.listening).toBe(false);
  });

  it('stops when the tab is hidden', async () => {
    const view = await renderComposer();
    await startDictating(view);
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(view.fake.listening).toBe(true);
    state.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(view.fake.listening).toBe(false);
    state.mockRestore();
  });

  it('stays as it was when the microphone cannot open', async () => {
    const view = await renderComposer();
    vi.spyOn(TestBed.inject(StudentVoice), 'listen').mockReturnValue(null);
    await startDictating(view);
    expect(dictateButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stops when the field goes away', async () => {
    const view = await renderComposer();
    await startDictating(view);
    view.fixture.destroy();
    expect(view.fake.listening).toBe(false);
  });

  const nothingHeard = 'No he entendido nada. Prueba otra vez o escribe tu pregunta.';

  it('says it understood nothing when the silence ends a dictation that gave no text', async () => {
    vi.useFakeTimers();
    const view = await renderComposer();
    await startDictating(view);
    vi.advanceTimersByTime(DICTATION_SILENCE_MS);
    view.fixture.detectChanges();

    expect(view.fake.listening).toBe(false);
    expect(screen.getByRole('status').textContent).toContain(nothingHeard);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says it understood nothing when the browser ends with nothing heard', async () => {
    const view = await renderComposer();
    await startDictating(view);
    view.fake.endListening('silence');
    await view.fixture.whenStable();
    view.fixture.detectChanges();
    expect(screen.getByRole('status').textContent).toContain(nothingHeard);
  });

  it('says nothing of it when the student stops, or when something was understood', async () => {
    vi.useFakeTimers();
    const view = await renderComposer();
    await startDictating(view);
    fireEvent.click(dictateButton() as HTMLElement);
    view.fixture.detectChanges();
    expect(screen.queryByText(nothingHeard)).toBeNull();

    await startDictating(view);
    hear(view, 'hola', false);
    vi.advanceTimersByTime(DICTATION_SILENCE_MS);
    view.fixture.detectChanges();
    expect(screen.queryByText(nothingHeard)).toBeNull();
  });

  it('takes the notice away when the student types or dictates again', async () => {
    const view = await renderComposer();
    for (const retry of ['type', 'dictate'] as const) {
      await startDictating(view);
      view.fake.endListening('silence');
      await view.fixture.whenStable();
      view.fixture.detectChanges();
      expect(screen.getByText(nothingHeard)).toBeTruthy();

      if (retry === 'type') await userEvent.type(field(), 'x');
      else await startDictating(view);
      view.fixture.detectChanges();
      expect(screen.queryByText(nothingHeard)).toBeNull();
      if (retry === 'dictate') view.fake.endListening('stopped');
    }
  });

  it('ends without a word when the browser hears nothing more', async () => {
    const view = await renderComposer();
    await startDictating(view);
    hear(view, 'a medias', false);
    view.fake.endListening('silence');
    await view.fixture.whenStable();
    view.fixture.detectChanges();
    expect(dictateButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(field().value).toBe('A medias');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['not-allowed', 'No tengo permiso para usar el micrófono'],
    ['no-microphone', 'No encuentro ningún micrófono'],
    ['service-unavailable', 'El reconocimiento de voz no está disponible ahora'],
    ['language-not-supported', 'Tu navegador no reconoce la voz en español'],
  ] as const)('says what failed with %s, keeping what was written', async (error, text) => {
    const view = await renderComposer();
    await userEvent.type(field(), 'Mi duda');
    await startDictating(view);
    view.fake.endListening(error);
    await view.fixture.whenStable();
    view.fixture.detectChanges();

    expect(screen.getByRole('alert').textContent).toContain(text);
    expect(field().value).toBe('Mi duda');
    expect(dictateButton()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('clears the error when the student types or dictates again', async () => {
    const view = await renderComposer();
    for (const retry of ['type', 'dictate'] as const) {
      await startDictating(view);
      view.fake.endListening('no-microphone');
      await view.fixture.whenStable();
      view.fixture.detectChanges();
      expect(screen.getByRole('alert')).toBeTruthy();

      if (retry === 'type') await userEvent.type(field(), 'x');
      else await startDictating(view);
      view.fixture.detectChanges();
      expect(screen.queryByRole('alert')).toBeNull();
    }
  });

  it('tells where the audio goes the first time, and listens only after «Entendido»', async () => {
    const view = await renderComposer({ place: 'server' });
    await startDictating(view);
    expect(view.fake.listening).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('TutorIA no lo graba');

    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    view.fixture.detectChanges();
    expect(view.fake.listening).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem(settingKey('audioNoticeSeen', 'u1'))).toBe('true');
    expect(document.activeElement).toBe(field());

    await startDictating(view);
    await startDictating(view);
    expect(screen.queryByRole('status')).toBeNull();
    expect(view.fake.listening).toBe(true);
  });

  it.each([
    ['it transcribes on the device', { place: 'device' as const }],
    ['the notice was seen', { place: 'server' as const, noticeSeen: true }],
  ])('tells nothing when %s', async (_, setup) => {
    const view = await renderComposer(setup);
    await startDictating(view);
    expect(view.fake.listening).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
