import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../../auth/auth-testing';
import type { Attempt, AttemptHistory, StoredAttemptStatus } from '../../../data/attempt';
import { AttemptService } from '../../../data/attempt-service';
import { DataError } from '../../../data/data-error';
import type { HintLevel, TutorEvent, TutorInteraction, TutorRequest } from '../../../data/tutor';
import { TutorService } from '../../../data/tutor-service';
import { SettingsStore } from '../../settings/settings-store';
import { AttemptStore } from '../attempt-store';
import { TutorStore } from '../tutor-store';
import { MAX_QUESTION_LENGTH } from './tutor-composer';
import { TutorPanel } from './tutor-panel';

const TODAY = new Date().toISOString();
const LONG_AGO = '2026-10-13T09:00:00.000Z';

function attemptOf(status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id: 'a1',
    exerciseId: 'e3',
    userId: 'student-1',
    assignmentId: null,
    currentCode: 'function suma(v) {}',
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
}

async function renderPanel({
  status = 'in_progress',
  interactions = [],
  history,
  ask,
  settle = true,
  signedIn = true,
}: Setup = {}) {
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
    expect(document.querySelector('.tutor-caret')).toBeTruthy();
    expect(live.textContent?.trim()).toBe('');

    rest.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('.tutor-caret')).toBeNull();
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

  it('shows the past conversation by day, with who says what', async () => {
    await renderPanel({
      interactions: [
        interactionOf('proactive', 'Te veo atascado', { createdAt: LONG_AGO }),
        interactionOf('question', 'Piensa en el bucle', {
          createdAt: LONG_AGO,
          studentMessage: '¿Qué falla?',
        }),
        interactionOf('hint', 'Revisa el acumulador', { hintLevel: 2 }),
      ],
    });
    const chat = within(conversation());

    expect(chat.getByText('El tutor se acerca')).toBeTruthy();
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
});
