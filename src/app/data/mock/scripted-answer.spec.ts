import type { HintLevel, TutorInteraction, TutorTrigger } from '../tutor';
import { syntaxBlocks } from '../tutor/syntax-examples';
import { TUTOR_SCRIPTS } from './fixtures/tutor-script';
import { type ScriptInput, scriptedAnswer } from './scripted-answer';

const CODE = 'function sum(numbers) {\n  return 0;\n}';
const SPANISH = TUTOR_SCRIPTS.es;

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
  return {
    kind: 'question',
    code: CODE,
    status: 'in_progress',
    previous: [],
    language: 'es',
    exerciseFunction: { name: 'sum', parameters: 1 },
    ...overrides,
  };
}

describe('scripted answer', () => {
  describe('hint level', () => {
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
      text: SPANISH.hints[1][0],
      hintLevel: 1,
      emotion: 'encouragement',
      reaction: 'thinking',
      intensity: 3,
      elusion: false,
      silent: false,
    });
    expect(second.text).toBe(SPANISH.hints[1][1]);
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

    expect(answer.text).toBe(SPANISH.hints[1][0]);
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
        text: SPANISH.elusion,
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
    expect(scriptedAnswer(input({ message: undefined })).text).toBe(SPANISH.hints[1][0]);
  });

  it('helps to start when the code is still empty', () => {
    const answer = scriptedAnswer(input({ message: '¿Por dónde empiezo?', code: '  \n' }));

    expect(answer.text).toBe(SPANISH.start);
    expect(answer.reaction).toBe('cheer');
  });

  it('goes over the statement when the question is about it', () => {
    const answer = scriptedAnswer(input({ message: 'No entiendo el enunciado' }));

    expect(answer.text).toBe(SPANISH.statement);
    expect(answer.reaction).toBe('hearts');
  });

  it('celebrates when every test passes', () => {
    const answer = scriptedAnswer(input({ message: '¿Se puede mejorar?', status: 'passed' }));

    expect(answer.text).toBe(SPANISH.passed);
    expect(answer.emotion).toBe('celebration');
    expect(answer.reaction).toBe('party');
  });

  describe('stepping in on its own (2.7)', () => {
    const proactive = (overrides: Partial<ScriptInput>) =>
      scriptedAnswer(input({ kind: 'proactive', reason: 'failures', ...overrides }));

    it('helps with the failures, taking turns between looking in and understanding', () => {
      expect(proactive({})).toEqual({
        text: SPANISH.proactive.failures,
        hintLevel: 1,
        emotion: 'encouragement',
        reaction: 'eyes',
        intensity: 3,
        elusion: false,
        silent: false,
      });
      expect(
        proactive({ previous: [interaction('proactive'), interaction('question')] }).reaction,
      ).toBe('empathy');
    });

    it('asks a student who stopped what holds them back, sleepily', () => {
      const answer = proactive({ reason: 'idle' });

      expect(answer.text).toBe(SPANISH.proactive.idle);
      expect(answer.reaction).toBe('sleepy');
      expect(answer.silent).toBe(false);
    });

    it('keeps quiet when it stepped in right before for the same reason', () => {
      const quiet = proactive({
        reason: 'idle',
        previous: [interaction('proactive')],
        lastIntervention: 'idle',
      });

      expect(quiet.silent).toBe(true);
      expect(quiet.text).toBe('');
    });

    it('helps with a pause right after helping with the failures', () => {
      const answer = proactive({
        reason: 'idle',
        previous: [interaction('proactive')],
        lastIntervention: 'failures',
      });

      expect(answer.text).toBe(SPANISH.proactive.idle);
    });

    it('always celebrates an achievement, also right after stepping in', () => {
      expect(
        proactive({
          reason: 'achievement',
          previous: [interaction('proactive')],
          lastIntervention: 'achievement',
        }),
      ).toEqual(
        expect.objectContaining({
          text: SPANISH.proactive.achievement,
          emotion: 'celebration',
          reaction: 'party',
          silent: false,
        }),
      );
    });
  });

  it('answers in the language of the request, like the real tutor', () => {
    expect(scriptedAnswer(input({ kind: 'hint', language: 'en' })).text).toBe(
      TUTOR_SCRIPTS.en.hints[1][0],
    );
    expect(scriptedAnswer(input({ message: 'Give me the code', language: 'en' })).text).toBe(
      TUTOR_SCRIPTS.en.elusion,
    );
    expect(scriptedAnswer(input({ kind: 'proactive', reason: 'idle', language: 'ca' })).text).toBe(
      TUTOR_SCRIPTS.ca.proactive.idle,
    );
  });

  it('shows the examples of the catalog to a question about how something is written', () => {
    const answer = scriptedAnswer(input({ message: '¿Cómo es la sintaxis del for?' }));

    expect(answer.text).toBe(`${SPANISH.syntax}\n${syntaxBlocks(['for'])}`);
    expect(answer.reaction).toBe('lightbulb');
    expect(answer.emotion).toBe('joy');
  });

  describe('a stuck student', () => {
    const stuck = (overrides: Partial<ScriptInput> = {}) =>
      scriptedAnswer(
        input({ message: 'No me acuerdo de cómo se empieza', code: '', ...overrides }),
      );

    it('gets the empty function of the exercise in a block, with what goes inside', () => {
      expect(stuck()).toEqual({
        text: `${SPANISH.stuck.before}\n\`\`\`js\nfunction sum(a) {\n}\n\`\`\`\n${SPANISH.stuck.after}`,
        hintLevel: 1,
        emotion: 'encouragement',
        reaction: 'empathy',
        intensity: 3,
        elusion: false,
        silent: false,
        // With «Insertar», as the server adds it (2.5f)
        actions: [{ name: 'insertSkeleton', arguments: { parameters: ['a'] } }],
      });
      expect(stuck({ language: 'ca' }).text).toContain(TUTOR_SCRIPTS.ca.stuck.after);
    });

    it('gets a hint, one level up if stuck again, once the function is written', () => {
      const again = stuck({
        code: CODE,
        previous: [{ ...interaction('question'), studentMessage: 'Ni idea' }],
      });
      expect(again.hintLevel).toBe(2);
      expect(again.text).toBe(SPANISH.hints[2][1]);
    });

    it('gets the skeleton only once: stuck again, one level up and how to start', () => {
      const skeleton = stuck().text;
      const again = stuck({
        previous: [{ ...interaction('question'), studentMessage: 'No sé', transcript: skeleton }],
      });
      expect(again.hintLevel).toBe(2);
      expect(again.text).toBe(SPANISH.start);
    });
  });

  it('has every text in every language', () => {
    for (const script of Object.values(TUTOR_SCRIPTS)) {
      expect(Object.values(script.hints).map((hints) => hints.length)).toEqual([3, 3, 3]);
      expect(
        [
          script.elusion,
          ...Object.values(script.proactive),
          script.start,
          script.statement,
          script.passed,
          script.stuck.before,
          script.stuck.after,
          script.syntax,
        ].every((text) => text.trim() !== ''),
      ).toBe(true);
    }
  });
});
