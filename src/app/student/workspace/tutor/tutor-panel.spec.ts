import { computed, DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../../auth/auth-testing';
import { FakeSpeechService, provideFakeSpeech } from '../../../core/speech/speech-testing';
import type { Attempt, AttemptHistory, StoredAttemptStatus } from '../../../data/attempt';
import { appTool, ToolRegistry } from '../../../core/tools/app-tool';
import { AttemptService } from '../../../data/attempt-service';
import { TUTOR_TOOL } from '../../../data/tutor/tutor-tools';
import { DataError } from '../../../data/data-error';
import type { HintLevel, TutorEvent, TutorInteraction, TutorRequest } from '../../../data/tutor';
import { TutorService } from '../../../data/tutor-service';
import { SettingsStore, settingKey } from '../../settings/settings-store';
import { AttemptStore } from '../attempt-store';
import { TutorSpeaker } from '../tutor-speaker';
import { TutorStore } from '../tutor-store';
import { type CallNotice, type CallState, VoiceCall } from '../voice-call';
import { MAX_QUESTION_LENGTH } from './question-limit';
import { TutorPanel } from './tutor-panel';

const TODAY = new Date().toISOString();
const LONG_AGO = '2026-10-13T09:00:00.000Z';

function attemptOf(status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id: 'a1',
    exerciseId: 'e3',
    userId: 'student-1',
    assignmentId: null,
    number: 1,
    currentCode: 'function sum(v) {}',
    finalCode: null,
    status,
    startedAt: LONG_AGO,
    finishedAt: null,
    updatedAt: LONG_AGO,
  };
}

function interactionOf(
  trigger: TutorInteraction['trigger'],
  transcript: string,
  { hintLevel = 1, createdAt = TODAY, studentMessage = null }: Partial<TutorInteraction> = {},
): TutorInteraction {
  return {
    id: `i-${transcript}`,
    attemptId: 'a1',
    trigger,
    hintLevel: hintLevel as HintLevel,
    studentMessage,
    transcript,
    emotion: 'joy',
    intensity: 1,
    elusion: false,
    promptVersion: 'v0',
    createdAt,
  };
}

/** A promise the test resolves when it wants. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/** The tutor's answer: meta, the text in two chunks (the second one when `rest` resolves), done. */
async function* answer(
  request: TutorRequest,
  level: HintLevel,
  rest?: Promise<void>,
): AsyncGenerator<TutorEvent> {
  yield { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: level };
  yield { type: 'delta', text: `Respuesta a ${request.kind}, ` };
  await rest;
  yield { type: 'delta', text: 'mira `total`.' };
  yield { type: 'done', interactionId: 'x', silent: false };
}

interface Setup {
  status?: StoredAttemptStatus;
  interactions?: TutorInteraction[];
  history?: AttemptService['history'];
  ask?: TutorService['ask'];
  /** False when a request is left pending: then the panel cannot become stable. */
  settle?: boolean;
  signedIn?: boolean;
  /** The tutor's voice; none, as in the teacher's preview. */
  speaker?: FakeSpeaker;
  /** The call with the tutor; none, as in the teacher's preview. */
  call?: FakeCall;
  /** The speech of the browser, with the voice on; none leaves it off. */
  speech?: FakeSpeechService;
}

/** What the panel reads of the tutor's voice. */
function fakeSpeaker({ available = true } = {}) {
  const speakingTurnId = signal<string | null>(null);
  return {
    available: signal(available),
    ready: signal(true),
    speakingTurnId,
    saying: signal<string | null>(null),
    listen: vi.fn((turnId: string) => speakingTurnId.set(turnId)),
    stop: vi.fn(() => speakingTurnId.set(null)),
  };
}
type FakeSpeaker = ReturnType<typeof fakeSpeaker>;

/** What the panel reads of a call, and what it asks of it. */
function fakeCall({ canCall = true } = {}) {
  const state = signal<CallState | null>(null);
  return {
    state,
    active: computed(() => state() !== null),
    canCall: signal(canCall),
    heard: signal(''),
    microphoneOpen: signal(false),
    notice: signal<CallNotice | null>(null),
    start: vi.fn(() => state.set('listening')),
    hangUp: vi.fn(() => state.set(null)),
    hold: vi.fn(() => state.set('standby')),
    resume: vi.fn(() => state.set('listening')),
    interrupt: vi.fn(() => state.set('listening')),
    correct: vi.fn(() => {
      state.set('standby');
      return 'por qué falla';
    }),
  };
}
type FakeCall = ReturnType<typeof fakeCall>;

async function renderPanel({
  status = 'in_progress',
  interactions = [],
  history,
  ask,
  settle = true,
  signedIn = true,
  speaker,
  call,
  speech,
}: Setup = {}) {
  if (speech) localStorage.setItem(settingKey('voice', 'student-1'), 'true');
  const attempt = signal(attemptOf(status));
  let hints = interactions.filter((interaction) => interaction.trigger === 'hint').length;
  const askTutor = vi.fn<TutorService['ask']>(
    ask ??
      ((request) =>
        answer(
          request,
          Math.min(request.kind === 'hint' ? ++hints : Math.max(hints, 1), 3) as HintLevel,
        )),
  );
  const view = await render(TutorPanel, {
    providers: [
      ...provideSessionOf(signedIn ? 'student' : null),
      TutorStore,
      {
        provide: AttemptStore,
        useValue: {
          attempt,
          status: computed(() => attempt().status),
          readonly: computed(() => attempt().status === 'submitted'),
        },
      },
      {
        provide: AttemptService,
        useValue: {
          history:
            history ??
            ((): Promise<AttemptHistory> =>
              Promise.resolve({ attempt: attempt(), events: [], interactions })),
        },
      },
      { provide: TutorService, useValue: { ask: askTutor } },
      speaker ? [{ provide: TutorSpeaker, useValue: speaker }] : [],
      call ? [{ provide: VoiceCall, useValue: call }] : [],
      speech ? [provideFakeSpeech(speech)] : [],
    ],
  });
  await restoreSession();
  if (settle) {
    await view.fixture.whenStable();
  } else {
    view.fixture.detectChanges();
  }
  return { ...view, askTutor, attempt };
}

function conversation(): HTMLElement {
  return screen.getByRole('group', { name: 'Conversación con el tutor' });
}

function mascots(): HTMLElement[] {
  return Array.from(document.querySelectorAll('app-mascot'));
}

describe('TutorPanel', () => {
  it('greets the student, says what to expect and suggests how to start', async () => {
    await renderPanel();

    expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
    expect(screen.getByText('¡Hola, Usuario!')).toBeTruthy();
    expect(screen.getByText(/No te daré la solución/)).toBeTruthy();
    expect(screen.getByText('Sin pistas pedidas')).toBeTruthy();
    const suggestions = within(screen.getByRole('list', { name: 'Preguntas sugeridas' }));
    expect(suggestions.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      '¿Por dónde empiezo?',
      'No entiendo el enunciado',
    ]);
  });

  it('greets without a name when it has none', async () => {
    await renderPanel({ signedIn: false });

    expect(screen.getByText('¡Hola!')).toBeTruthy();
  });

  it.each([
    ['tests_failed', '¿Por qué falla una de las pruebas?'],
    ['passed', '¿Se puede mejorar mi código?'],
  ] as const)('suggests what fits an attempt in %s', async (status, suggestion) => {
    await renderPanel({ status });

    expect(screen.getByRole('button', { name: suggestion })).toBeTruthy();
  });

  it('asks a suggested question in one click', async () => {
    const { askTutor, fixture } = await renderPanel();

    await userEvent.setup().click(screen.getByRole('button', { name: '¿Por dónde empiezo?' }));
    await fixture.whenStable();

    expect(askTutor).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'question', message: '¿Por dónde empiezo?' }),
    );
    expect(within(conversation()).getByText('¿Por dónde empiezo?')).toBeTruthy();
  });

  it('offers a hint or the statement under a refusal to give the solution', async () => {
    const refusal = {
      ...interactionOf('question', '¿Qué crees que hace falta?', {
        studentMessage: 'Dame la solución',
      }),
      elusion: true,
    };
    const { askTutor, fixture } = await renderPanel({ interactions: [refusal] });
    const user = userEvent.setup();

    const offer = within(screen.getByRole('list', { name: 'Cómo seguir' }));
    expect(offer.getAllByRole('button')).toEqual([
      offer.getByRole('button', { name: 'Dame una pista' }),
      offer.getByRole('button', { name: 'No entiendo el enunciado' }),
    ]);

    await user.click(offer.getByRole('button', { name: 'Dame una pista' }));
    await fixture.whenStable();
    expect(askTutor).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'hint' }));
    // The hint is an ordinary answer: the offer goes away
    expect(screen.queryByRole('list', { name: 'Cómo seguir' })).toBeNull();
  });

  it('asks about the statement from the offer under a refusal', async () => {
    const refusal = { ...interactionOf('question', 'No te la doy'), elusion: true };
    const { askTutor, fixture } = await renderPanel({ interactions: [refusal] });

    await userEvent.setup().click(
      within(screen.getByRole('list', { name: 'Cómo seguir' })).getByRole('button', {
        name: 'No entiendo el enunciado',
      }),
    );
    await fixture.whenStable();

    expect(askTutor).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'question', message: 'No entiendo el enunciado' }),
    );
  });

  it('moves the mascot with the emotion of each new answer, unless the reactions are off', async () => {
    const { fixture } = await renderPanel();
    const user = userEvent.setup();
    const moving = () => mascots().some((mascot) => mascot.classList.contains('mascot-move-tilt'));

    await user.click(screen.getByRole('button', { name: '¿Por dónde empiezo?' }));
    await fixture.whenStable();
    // Joy: a happy tilt
    expect(moving()).toBe(true);

    TestBed.inject(SettingsStore).setReactions('off');
    await fixture.whenStable();
    expect(moving()).toBe(false);
    localStorage.clear();
  });

  it('climbs the hint levels, saying what each one gives', async () => {
    const { fixture } = await renderPanel();
    const user = userEvent.setup();
    const hintButton = () => screen.getByRole('button', { name: /pista/ });

    expect(screen.getByRole('button', { name: 'Pedir pista' })).toBeTruthy();
    expect(hintButton().getAttribute('aria-describedby')).toBeTruthy();

    for (let level = 1; level <= 3; level++) {
      await user.click(hintButton());
      await fixture.whenStable();
    }

    expect(screen.getByText('Pista nivel 3 de 3 · Paso concreto')).toBeTruthy();
    expect(
      within(conversation())
        .getAllByText(/^Pista · nivel/)
        .map((chip) => chip.textContent),
    ).toEqual(['Pista · nivel 1', 'Pista · nivel 2', 'Pista · nivel 3']);
    expect(screen.getByRole('button', { name: 'Otra pista' })).toBeTruthy();
    // The answer marks its inline code
    expect(within(conversation()).getAllByText('total')[0].tagName).toBe('CODE');
  });

  it('shows the tutor typing, then the answer as it arrives, and reads it aloud once complete', async () => {
    const rest = deferred<void>();
    const firstChunk = deferred<void>();
    const { fixture } = await renderPanel({
      ask: (request) =>
        (async function* () {
          await firstChunk.promise;
          yield* answer(request, 1, rest.promise);
        })(),
    });
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;

    await userEvent.setup().click(screen.getByRole('button', { name: 'Pedir pista' }));
    await fixture.whenStable();
    expect(screen.getByText('El tutor está escribiendo…')).toBeTruthy();
    expect(mascots()[0].classList).toContain('mascot-thinking');
    expect(screen.getByRole('button', { name: 'Pedir pista' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    firstChunk.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(within(conversation()).getByText(/Respuesta a hint/)).toBeTruthy();
    });
    expect(document.querySelector('[data-testid="tutor-caret"]')).toBeTruthy();
    expect(live.textContent?.trim()).toBe('');

    rest.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('[data-testid="tutor-caret"]')).toBeNull();
    });
    expect(live.textContent?.trim()).toBe('Respuesta a hint, mira `total`.');
    expect(mascots()[0].classList).not.toContain('mascot-thinking');
  });

  it('sends a question with Intro, keeps a new line with Mayús + Intro, and empties the field', async () => {
    const { askTutor, fixture } = await renderPanel();
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: 'Pregunta al tutor' });
    const send = screen.getByRole('button', { name: 'Enviar la pregunta' });
    expect(send.getAttribute('aria-disabled')).toBe('true');

    await user.click(field);
    expect(mascots()[0].classList).toContain('mascot-chat');
    await user.type(field, '   {Enter}');
    expect(askTutor).not.toHaveBeenCalled();
    await user.clear(field);
    // Intro while an input method composes a character only confirms it
    await user.type(field, 'a');
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(askTutor).not.toHaveBeenCalled();
    await user.clear(field);
    await user.type(field, '¿Qué hago{Shift>}{Enter}{/Shift}ahora?');
    expect((field as HTMLTextAreaElement).value).toBe('¿Qué hago\nahora?');
    await user.keyboard('{Enter}');
    await fixture.whenStable();

    expect(askTutor).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'question', message: '¿Qué hago\nahora?' }),
    );
    expect((field as HTMLTextAreaElement).value).toBe('');
    expect(document.activeElement).toBe(field);

    await user.click(conversation());
    expect(mascots()[0].classList).not.toContain('mascot-chat');
  });

  it('sends a question with its button', async () => {
    const { askTutor, fixture } = await renderPanel();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Pregunta al tutor' }), 'Hola');
    await user.click(screen.getByRole('button', { name: 'Enviar la pregunta' }));
    await fixture.whenStable();

    expect(askTutor).toHaveBeenCalledWith(expect.objectContaining({ message: 'Hola' }));
  });

  it('counts the characters near the limit, which the field does not let pass', async () => {
    const { fixture } = await renderPanel();
    const field = screen.getByRole('textbox', { name: 'Pregunta al tutor' }) as HTMLTextAreaElement;
    const user = userEvent.setup();

    await user.click(field);
    await user.paste('a'.repeat(399));
    await fixture.whenStable();
    expect(screen.queryByText(/\/500$/)).toBeNull();
    await user.paste('a'.repeat(102));
    await fixture.whenStable();

    expect(field.maxLength).toBe(MAX_QUESTION_LENGTH);
    expect(field.value).toHaveLength(MAX_QUESTION_LENGTH);
    expect(screen.getByText(`${MAX_QUESTION_LENGTH}/${MAX_QUESTION_LENGTH}`)).toBeTruthy();
  });

  it('says an answer did not arrive, keeping the question, and asks again on retry', async () => {
    let calls = 0;
    const { fixture } = await renderPanel({
      ask: (request) =>
        (async function* () {
          if (calls++ === 0) throw new DataError('network');
          yield* answer(request, 1);
        })(),
    });
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Pregunta al tutor' }), '¿Y esto?{Enter}');
    await fixture.whenStable();

    expect(screen.getByRole('alert').textContent).toContain(
      'El tutor no ha podido responder. Comprueba la conexión e inténtalo de nuevo.',
    );
    expect(within(conversation()).getByText('¿Y esto?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(conversation()).getByText(/Respuesta a question/)).toBeTruthy();
  });

  it('offers to sign in again when the conversation could not load because the session expired', async () => {
    const { fixture } = await renderPanel({
      history: () => Promise.reject(new DataError('unauthorized')),
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByRole('alert').textContent).toContain(
        'No se ha podido cargar la conversación.',
      );
    });

    expect(screen.getByRole('button', { name: 'Volver a entrar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('offers to sign in again when an answer failed because the session expired', async () => {
    const { fixture } = await renderPanel({
      ask: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new DataError('unauthorized')),
        }),
      }),
    });
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Pregunta al tutor' }), '¿Y esto?{Enter}');
    await fixture.whenStable();

    expect(screen.getByRole('alert').textContent).toContain('Tu sesión ha caducado');
    expect(screen.getByRole('button', { name: 'Volver a entrar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('shows the past conversation by day, with who says what', async () => {
    await renderPanel({
      interactions: [
        interactionOf('proactive', 'Te veo atascado', { createdAt: LONG_AGO }),
        interactionOf('question', 'Piensa en el bucle', {
          createdAt: LONG_AGO,
          studentMessage: '¿Qué falla en `sum([])`?',
        }),
        interactionOf('hint', 'Revisa el acumulador', { hintLevel: 2 }),
      ],
    });
    const chat = within(conversation());

    expect(chat.getByText('El tutor te escribe')).toBeTruthy();
    // The student's code shows as code too, as «Pregúntale al tutor» writes it (6.2d)
    expect(chat.getByText('sum([])').tagName).toBe('CODE');
    expect(chat.getByText('Hoy')).toBeTruthy();
    expect(chat.getAllByText(/2026/)).toHaveLength(1);
    expect(chat.getAllByText('Tú:')).toHaveLength(1);
    expect(chat.getAllByText('Tutor:')).toHaveLength(3);
    // The level reached comes from the hints of the attempt
    expect(screen.getByText('Pista nivel 2 de 3 · Concepto')).toBeTruthy();
    // With a conversation, the mascot moves to the header
    expect(mascots()).toHaveLength(1);
    expect(screen.queryByText(/¡Hola/)).toBeNull();
  });

  it('says when being stuck again got more help, and shows the skeleton as a block', async () => {
    await renderPanel({
      interactions: [
        interactionOf('question', '¿Qué palabra declara una función?', {
          studentMessage: 'No me acuerdo de cómo se empieza',
        }),
        interactionOf('question', 'Así empieza:\n```js\nfunction sum(numbers) {\n}\n```', {
          hintLevel: 2,
          studentMessage: 'Ni idea',
        }),
      ],
    });
    const chat = within(conversation());

    expect(chat.getAllByText(/Más ayuda/)).toHaveLength(1);
    expect(chat.getByText('Más ayuda · nivel 2')).toBeTruthy();
    expect(chat.getByRole('code').textContent).toBe('function sum(numbers) {\n}');
    expect(chat.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    expect(screen.getByText('Pista nivel 2 de 3 · Concepto')).toBeTruthy();
  });

  it('only lets a submitted attempt read its conversation', async () => {
    await renderPanel({
      status: 'submitted',
      interactions: [interactionOf('hint', 'Revisa el acumulador')],
    });

    expect(screen.getByText('Revisa el acumulador')).toBeTruthy();
    expect(screen.getByText(/el tutor ya no da más pistas/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /pista/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('takes the focus to the question, ready to write', async () => {
    const { fixture } = await renderPanel();

    fixture.componentInstance.focusQuestion();

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Pregunta al tutor' }));
  });

  it('takes the focus to the conversation of a submitted attempt, to read it', async () => {
    const { fixture } = await renderPanel({ status: 'submitted' });

    fixture.componentInstance.focusQuestion();

    expect(document.activeElement).toBe(conversation());
  });

  it('says a submitted attempt had no help, without suggestions', async () => {
    await renderPanel({ status: 'submitted' });

    expect(screen.getByText('En este ejercicio no pediste ayuda al tutor.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows the conversation loading, and retries when it could not load', async () => {
    const failure = deferred<void>();
    let calls = 0;
    const { fixture } = await renderPanel({
      history: async () => {
        calls++;
        if (calls === 1) {
          await failure.promise;
          throw new DataError('network');
        }
        return { attempt: attemptOf(), events: [], interactions: [] };
      },
      settle: false,
    });

    expect(conversation().getAttribute('aria-busy')).toBe('true');
    // The skeleton only shows after a short wait, so it never flickers
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByText('Cargando la conversación…')).toBeTruthy();
    });

    failure.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByRole('alert').textContent).toContain(
        'No se ha podido cargar la conversación.',
      );
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();
    expect(screen.getByText(/¡Hola/)).toBeTruthy();
  });

  it('shows what the tutor did under its answer, with the button and the undo (2.5e)', async () => {
    const settings = vi.fn((): unknown => ({
      changed: { theme: 'dark' },
      previous: { theme: 'light' },
    }));
    const open = vi.fn((): unknown => ({ opened: 'Suma' }));
    const { fixture } = await renderPanel({
      ask: () =>
        (async function* () {
          yield {
            type: 'meta',
            emotion: 'joy',
            intensity: 2,
            hintLevel: 1,
            actions: [
              { name: 'updateSettings', arguments: { theme: 'dark' } },
              { name: 'openExercise', arguments: { exercise: 'next' } },
            ],
          } satisfies TutorEvent;
          yield { type: 'delta', text: 'Hecho.' } satisfies TutorEvent;
          yield { type: 'done', interactionId: 'i1', silent: false } satisfies TutorEvent;
        })(),
    });
    const registry = TestBed.inject(ToolRegistry);
    registry.register(appTool(TUTOR_TOOL.updateSettings, settings), TestBed.inject(DestroyRef));
    registry.register(appTool(TUTOR_TOOL.openExercise, open), TestBed.inject(DestroyRef));
    const user = userEvent.setup();

    await TestBed.inject(TutorStore).ask('Modo oscuro y el siguiente');
    await fixture.whenStable();

    const actions = screen.getByRole('list', { name: 'Lo que ha hecho el tutor' });
    expect(within(actions).getByText('Tema oscuro')).toBeTruthy();
    await user.click(within(actions).getByRole('button', { name: /Abrir el siguiente ejercicio/ }));
    expect(open).toHaveBeenCalled();

    await user.click(within(actions).getByRole('button', { name: 'Deshacer' }));
    expect(settings).toHaveBeenLastCalledWith({ theme: 'light' }, expect.anything());
    await fixture.whenStable();
    expect(within(actions).getByText('Ajustes como estaban')).toBeTruthy();
  });

  describe('voice', () => {
    const past = [
      interactionOf('question', 'Mira el bucle.', { studentMessage: '¿Qué hago?' }),
      interactionOf('hint', 'Empieza en cero.'),
    ];

    it('offers no «Escuchar» without the voice, with it off or without voices', async () => {
      await renderPanel({ interactions: past });
      expect(screen.queryByRole('button', { name: /Escuchar/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /Escuchar/ })).toBeNull();
    });

    it('offers no «Escuchar» when the browser cannot speak the language', async () => {
      await renderPanel({ interactions: past, speaker: fakeSpeaker({ available: false }) });
      expect(screen.queryByRole('button', { name: /Escuchar/ })).toBeNull();
    });

    it('says an answer with «Escuchar», which turns into «Parar» and back', async () => {
      const speaker = fakeSpeaker();
      const { fixture } = await renderPanel({ interactions: past, speaker });
      const buttons = screen.getAllByRole('button', { name: 'Escuchar' });
      expect(buttons).toHaveLength(2);

      await userEvent.click(buttons[0]);
      fixture.detectChanges();
      expect(speaker.listen).toHaveBeenCalledWith('i-Mira el bucle.');
      const stop = screen.getByRole('button', { name: 'Parar' });
      expect(stop).toBe(buttons[0]);
      expect(document.querySelector('app-mascot')?.classList).toContain('mascot-speaking');

      expect(screen.getByRole('button', { name: 'El tutor está hablando. Parar' })).toBeTruthy();

      await userEvent.click(stop);
      fixture.detectChanges();
      expect(speaker.stop).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /El tutor está hablando/ })).toBeNull();
    });

    it('silences the tutor from the header, wherever the answer is', async () => {
      const speaker = fakeSpeaker();
      const { fixture } = await renderPanel({ interactions: past, speaker });
      speaker.listen('i-Empieza en cero.');
      fixture.detectChanges();
      await userEvent.click(screen.getByRole('button', { name: 'El tutor está hablando. Parar' }));
      fixture.detectChanges();
      expect(speaker.stop).toHaveBeenCalled();
      expect(screen.getAllByRole('button', { name: 'Escuchar' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Escuchar' })).toHaveLength(2);
    });

    it('offers «Escuchar» only under a whole answer', async () => {
      const rest = deferred<void>();
      const { fixture } = await renderPanel({
        speaker: fakeSpeaker(),
        settle: false,
        ask: (request) => answer(request, 1, rest.promise),
      });
      await fixture.whenStable();
      await userEvent.click(screen.getByRole('button', { name: /pista/ }));
      fixture.detectChanges();
      expect(screen.queryByRole('button', { name: 'Escuchar' })).toBeNull();
      rest.resolve();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByRole('button', { name: 'Escuchar' })).toBeTruthy();
      });
    });
  });

  describe('call', () => {
    const past = [interactionOf('question', 'Mira el bucle.', { studentMessage: '¿Qué hago?' })];

    // The voice turned on for one of them must not reach the others
    afterEach(() => localStorage.clear());

    function callButton(): HTMLElement {
      return screen.getByRole('button', { name: /Llamar al tutor|En llamada/ });
    }

    function callCard(): HTMLElement | null {
      return screen.queryByRole('group', { name: 'Llamada con el tutor' });
    }

    it('offers «Llamar al tutor» only where the call can be made', async () => {
      await renderPanel({ call: fakeCall({ canCall: false }), speaker: fakeSpeaker() });
      expect(screen.queryByRole('button', { name: 'Llamar al tutor' })).toBeNull();
    });

    it("has no call in the teacher's preview", async () => {
      await renderPanel();
      expect(screen.queryByRole('button', { name: 'Llamar al tutor' })).toBeNull();
    });

    it('calls, shows the card and keeps «En llamada» disabled but reachable', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ interactions: past, call, speaker: fakeSpeaker() });
      expect(mascots()).toHaveLength(1);
      await userEvent.click(callButton());
      fixture.detectChanges();

      expect(call.start).toHaveBeenCalledOnce();
      expect(callCard()).toBeTruthy();
      expect(callButton().getAttribute('aria-label')).toBe('En llamada');
      expect(callButton().getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(callButton());
      expect(call.start).toHaveBeenCalledOnce();
      // The mascot goes down to the card, as the face of the tutor
      expect(mascots()).toHaveLength(1);
      expect(within(callCard()!).getByText('Te escucho')).toBeTruthy();
      expect(mascots()[0].classList).toContain('mascot-chat');
    });

    it('shows only the face of the card while the chat is empty', async () => {
      const call = fakeCall();
      call.state.set('thinking');
      await renderPanel({ call, speaker: fakeSpeaker() });
      expect(mascots()).toHaveLength(1);
      expect(mascots()[0].classList).toContain('mascot-thinking');
    });

    it('moves the mascot with each state of the call', async () => {
      const call = fakeCall();
      const speaker = fakeSpeaker();
      const { fixture } = await renderPanel({ interactions: past, call, speaker });
      const moods: Partial<Record<CallState, string>> = {
        hearing: 'mascot-chat',
        thinking: 'mascot-thinking',
        speaking: 'mascot-speaking',
      };
      for (const [state, mood] of Object.entries(moods)) {
        call.state.set(state as CallState);
        fixture.detectChanges();
        expect(mascots()[0].classList).toContain(mood);
      }
      call.state.set('standby');
      fixture.detectChanges();
      expect(mascots()[0].className).not.toMatch(/mascot-(chat|thinking|speaking)/);
    });

    it('shows «Hablando» only in the card while in a call', async () => {
      const call = fakeCall();
      const speaker = fakeSpeaker();
      const { fixture } = await renderPanel({ interactions: past, call, speaker });
      call.state.set('speaking');
      speaker.listen('i-Mira el bucle.');
      speaker.saying.set('Mira el bucle.');
      fixture.detectChanges();
      expect(screen.queryByRole('button', { name: /El tutor está hablando/ })).toBeNull();
      expect(within(callCard()!).getByText('Mira el bucle.')).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Interrumpir' }));
      expect(call.interrupt).toHaveBeenCalledOnce();
    });

    it('pauses and keeps talking from the card', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker() });
      call.state.set('listening');
      fixture.detectChanges();
      await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
      fixture.detectChanges();
      expect(call.hold).toHaveBeenCalledOnce();
      await userEvent.click(screen.getByRole('button', { name: 'Seguir hablando' }));
      expect(call.resume).toHaveBeenCalledOnce();
    });

    it('leaves what was said in the field with «Corregir», with the focus', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker() });
      call.state.set('hearing');
      call.heard.set('por qué falla');
      fixture.detectChanges();
      await userEvent.click(screen.getByRole('button', { name: 'Corregir' }));
      fixture.detectChanges();
      const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Pregunta al tutor' });
      expect(field.value).toBe('Por qué falla');
      expect(document.activeElement).toBe(field);
    });

    it('gives the focus back to «Llamar al tutor» on hanging up', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker() });
      await userEvent.click(callButton());
      fixture.detectChanges();
      await userEvent.click(screen.getByRole('button', { name: 'Colgar' }));
      await fixture.whenStable();
      expect(call.hangUp).toHaveBeenCalledOnce();
      expect(callCard()).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Llamar al tutor' }));
    });

    it('moves no focus when the state changes', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker() });
      await userEvent.click(callButton());
      fixture.detectChanges();
      const field = screen.getByRole('textbox', { name: 'Pregunta al tutor' });
      field.focus();
      for (const state of ['hearing', 'thinking', 'speaking', 'standby'] as const) {
        call.state.set(state);
        fixture.detectChanges();
        expect(document.activeElement).toBe(field);
      }
    });

    it('says where the audio goes before the first call', async () => {
      const call = fakeCall();
      const speech = new FakeSpeechService();
      speech.voiceList = [{ id: 'jorge', name: 'Jorge', lang: 'es-ES' }];
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker(), speech });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByRole('button', { name: 'Dictar' })).toBeTruthy();
      });
      await userEvent.click(callButton());
      fixture.detectChanges();
      expect(call.start).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
      fixture.detectChanges();
      expect(call.start).toHaveBeenCalledOnce();
      expect(TestBed.inject(SettingsStore).audioNoticeSeen()).toBe(true);
      expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
    });

    it('says why a call ended by itself', async () => {
      const call = fakeCall();
      const { fixture } = await renderPanel({ call, speaker: fakeSpeaker() });
      call.notice.set('unstable');
      fixture.detectChanges();
      expect(screen.getByRole('alert').textContent).toContain(
        'La llamada se ha cortado: el micrófono se cierra solo.',
      );
      call.notice.set('no-microphone');
      fixture.detectChanges();
      expect(screen.getByRole('alert').textContent).toContain('No encuentro ningún micrófono.');
    });
  });
});
