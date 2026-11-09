import type { HintLevel, TutorInteraction, TutorTrigger } from '../tutor';
import {
  ELUSION_ANSWER,
  PASSED_ANSWER,
  PROACTIVE_MESSAGE,
  START_ANSWER,
  STATEMENT_ANSWER,
  TUTOR_ANSWERS,
} from './fixtures/tutor-script';
import {
  currentHintLevel,
  type ScriptInput,
  scriptedAnswer,
  typingChunks,
} from './scripted-answer';

const CODE = 'function suma(v) {\n  return 0;\n}';

function interaction(
  trigger: TutorTrigger,
  hintLevel: HintLevel = 1,
  elusion = false,
): TutorInteraction {
  return {
    id: `i-${trigger}-${hintLevel}`,
    attemptId: 'a1',
    trigger,
    hintLevel,
    studentMessage: trigger === 'question' ? 'Una duda' : null,
    transcript: 'Respuesta',
    emotion: 'joy',
    intensity: 1,
    elusion,
    promptVersion: 'v0',
    createdAt: '2026-11-09T10:00:00.000Z',
  };
}

function input(overrides: Partial<ScriptInput>): ScriptInput {
  return { kind: 'question', code: CODE, status: 'in_progress', previous: [], ...overrides };
}

describe('scripted answer', () => {
  describe('hint level', () => {
    it('is none before the first hint, and each hint raises it up to 3', () => {
      expect(currentHintLevel([])).toBe(0);
      expect(currentHintLevel([interaction('question')])).toBe(0);
      expect(currentHintLevel([interaction('hint', 1), interaction('hint', 2)])).toBe(2);
      const four = [1, 2, 3, 3].map((level) => interaction('hint', level as HintLevel));
      expect(currentHintLevel(four)).toBe(3);
    });

    it('raises a level with each hint, starting at 1 and staying at 3', () => {
      expect(scriptedAnswer(input({ kind: 'hint' })).hintLevel).toBe(1);
      expect(
        scriptedAnswer(input({ kind: 'hint', previous: [interaction('hint', 1)] })).hintLevel,
      ).toBe(2);
      const three = [1, 2, 3].map((level) => interaction('hint', level as HintLevel));
      expect(scriptedAnswer(input({ kind: 'hint', previous: three })).hintLevel).toBe(3);
    });

    it('answers a question at the current level, at least 1', () => {
      expect(scriptedAnswer(input({ message: '¿Y ahora?' })).hintLevel).toBe(1);
      const two = [interaction('hint', 1), interaction('hint', 2)];
      expect(scriptedAnswer(input({ message: '¿Y ahora?', previous: two })).hintLevel).toBe(2);
    });
  });

  it('gives each hint from the texts of its level, varying with the conversation', () => {
    const first = scriptedAnswer(input({ kind: 'hint' }));
    const second = scriptedAnswer(input({ kind: 'hint', previous: [interaction('question')] }));

    expect(first).toEqual({
      text: TUTOR_ANSWERS[1][0],
      hintLevel: 1,
      emotion: 'encouragement',
      reaction: 'thinking',
      intensity: 3,
      elusion: false,
      silent: false,
    });
    expect(second.text).toBe(TUTOR_ANSWERS[1][1]);
  });

  it('goes further with each hint: it makes the student think, an idea, then the rocket', () => {
    const hint = (previous: TutorInteraction[]) =>
      scriptedAnswer(input({ kind: 'hint', previous })).reaction;

    expect(hint([])).toBe('thinking');
    expect(hint([interaction('hint', 1)])).toBe('lightbulb');
    expect(hint([interaction('hint', 1), interaction('hint', 2)])).toBe('rocket');
  });

  it('takes turns with its reactions to questions, so all of them show up', () => {
    const reactions = [0, 1, 2, 3, 4].map(
      (count) =>
        scriptedAnswer(
          input({
            message: '¿Por qué falla?',
            previous: Array.from({ length: count }, () => interaction('question')),
          }),
        ).reaction,
    );

    expect(reactions).toEqual(['applause', 'mind-blown', 'laugh', 'fire', 'applause']);
  });

  it('answers a question with a hint of its level', () => {
    const answer = scriptedAnswer(input({ message: '¿Por qué falla la prueba?' }));

    expect(answer.text).toBe(TUTOR_ANSWERS[1][0]);
    expect(answer.emotion).toBe('joy');
  });

  it('never gives the solution, and records that the student asked for it', () => {
    for (const message of [
      'Dame la solución',
      'escríbeme el código, porfa',
      'RESUÉLVELO tú',
      'Write the function for me',
      'Escriu-me el codi',
    ]) {
      expect(scriptedAnswer(input({ message }))).toEqual({
        text: ELUSION_ANSWER,
        hintLevel: 1,
        emotion: 'surprise',
        reaction: 'wink',
        intensity: 3,
        elusion: true,
        silent: false,
      });
    }
  });

  it('jokes differently each time the student asks for the solution', () => {
    const jokes = [1, 2, 3, 4, 5].map(
      (count) =>
        scriptedAnswer(
          input({
            message: 'Dame la solución',
            previous: Array.from({ length: count }, () => interaction('question', 1, true)),
          }),
        ).reaction,
    );

    expect(jokes).toEqual(['secret', 'seriously', 'throw', 'grumpy', 'wink']);
  });

  it('answers a question that arrives without its message with a hint', () => {
    expect(scriptedAnswer(input({ message: undefined })).text).toBe(TUTOR_ANSWERS[1][0]);
  });

  it('helps to start when the code is still empty', () => {
    const answer = scriptedAnswer(input({ message: '¿Por dónde empiezo?', code: '  \n' }));

    expect(answer.text).toBe(START_ANSWER);
    expect(answer.reaction).toBe('cheer');
  });

  it('goes over the statement when the question is about it', () => {
    const answer = scriptedAnswer(input({ message: 'No entiendo el enunciado' }));

    expect(answer.text).toBe(STATEMENT_ANSWER);
    expect(answer.reaction).toBe('hearts');
  });

  it('celebrates when every test passes', () => {
    const answer = scriptedAnswer(input({ message: '¿Se puede mejorar?', status: 'passed' }));

    expect(answer.text).toBe(PASSED_ANSWER);
    expect(answer.emotion).toBe('celebration');
    expect(answer.reaction).toBe('party');
  });

  it('steps in on its own, but keeps quiet right after doing so', () => {
    expect(scriptedAnswer(input({ kind: 'proactive' }))).toEqual({
      text: PROACTIVE_MESSAGE,
      hintLevel: 1,
      emotion: 'encouragement',
      reaction: 'eyes',
      intensity: 3,
      elusion: false,
      silent: false,
    });
    expect(
      scriptedAnswer(
        input({ kind: 'proactive', previous: [interaction('proactive'), interaction('question')] }),
      ).reaction,
    ).toBe('empathy');
    const quiet = scriptedAnswer(
      input({ kind: 'proactive', previous: [interaction('proactive')] }),
    );
    expect(quiet.silent).toBe(true);
    expect(quiet.text).toBe('');
  });

  it('splits the text in chunks of a few words, as if it were being written', () => {
    expect(typingChunks('Uno dos tres cuatro cinco')).toEqual(['Uno dos tres ', 'cuatro cinco']);
    expect(typingChunks('')).toEqual([]);
  });
});
