import {
  answerHintLevel,
  EMOTION_REACTIONS,
  EMOTIONS,
  type HintLevel,
  REACTION_KINDS,
  REACTION_USES,
  raisesHintLevel,
  reachedHintLevel,
  isStuckMessage,
  skeletonBlock,
  type TutorTrigger,
} from './tutor-contract';

const turn = (
  trigger: TutorTrigger,
  hintLevel: HintLevel | null = 1,
  studentMessage: string | null = trigger === 'question' ? '¿Qué hago?' : null,
) => ({ trigger, hintLevel, studentMessage });

const stuck = (hintLevel: HintLevel | null = 1) => turn('question', hintLevel, 'No me acuerdo');

describe('tutor contract', () => {
  describe('reachedHintLevel', () => {
    it('is none before the first hint', () => {
      expect(reachedHintLevel([])).toBe(0);
      expect(reachedHintLevel([turn('question', 1), turn('proactive', 1)])).toBe(0);
    });

    it('counts an answer that was not a hint once it went past level 1, as being stuck does', () => {
      expect(reachedHintLevel([stuck(1), stuck(2)])).toBe(2);
      expect(reachedHintLevel([turn('hint', 1), stuck(1), stuck(2), turn('proactive', 3)])).toBe(3);
    });

    it('is the highest level of the hints so far', () => {
      expect(reachedHintLevel([turn('hint', 1), turn('hint', 2), turn('question', 2)])).toBe(2);
      expect(reachedHintLevel([turn('hint', 3), turn('hint', 3)])).toBe(3);
    });

    it('ignores a hint whose level is not known yet', () => {
      expect(reachedHintLevel([turn('hint', 1), turn('hint', null)])).toBe(1);
    });
  });

  describe('answerHintLevel', () => {
    it('raises a level with each hint, starting at 1 and staying at 3', () => {
      expect(answerHintLevel('hint', [])).toBe(1);
      expect(answerHintLevel('hint', [turn('hint', 1)])).toBe(2);
      expect(answerHintLevel('hint', [turn('hint', 1), turn('hint', 2), turn('hint', 3)])).toBe(3);
    });

    it('answers a question or steps in at the current level, at least 1', () => {
      expect(answerHintLevel('question', [])).toBe(1);
      expect(answerHintLevel('proactive', [])).toBe(1);
      expect(answerHintLevel('question', [turn('hint', 1), turn('hint', 2)])).toBe(2);
      expect(answerHintLevel('proactive', [turn('hint', 1), turn('hint', 2)])).toBe(2);
    });

    it('raises a level when the student says again that they are stuck', () => {
      expect(answerHintLevel('question', [], 'No me acuerdo')).toBe(1);
      expect(answerHintLevel('question', [stuck(1)], 'ni idea')).toBe(2);
      expect(answerHintLevel('question', [stuck(1), stuck(2)], 'sigo sin saberlo')).toBe(3);
      expect(answerHintLevel('question', [stuck(1), stuck(2), stuck(3)], 'no sé')).toBe(3);
      expect(answerHintLevel('question', [turn('hint', 2), stuck(2)], "I don't know")).toBe(3);
    });

    it('looks at the last thing the student said, past the interventions of the tutor', () => {
      expect(answerHintLevel('question', [stuck(1), turn('proactive', 1)], 'no sé')).toBe(2);
      expect(answerHintLevel('question', [stuck(1), turn('question', 1)], 'no sé')).toBe(1);
      expect(answerHintLevel('question', [stuck(1), turn('hint', 2)], 'no sé')).toBe(2);
    });

    it('does not raise the level of a question that is not stuck, nor of a hint by the message', () => {
      expect(answerHintLevel('question', [stuck(1)], '¿Está bien así?')).toBe(1);
      expect(answerHintLevel('hint', [stuck(1)], 'no sé')).toBe(1);
    });
  });

  describe('isStuckMessage', () => {
    it.each([
      'No sé',
      'no se como seguir',
      'Ni idea',
      'No me acuerdo de cómo se empieza una función',
      'no recuerdo la sintaxis',
      'No lo entiendo',
      'estoy atascada',
      'Me he atascado',
      'sigo sin saberlo',
      'No sé hacerlo, de verdad',
      "I don't know",
      'dont know how to start',
      'I can’t remember the syntax',
      "I'm stuck",
      "I don't get it",
      'No ho sé',
      'no me’n recordo',
      'No ho entenc',
      'estic encallat',
    ])('takes «%s» as stuck', (message) => {
      expect(isStuckMessage(message)).toBe(true);
    });

    it.each([
      '¿Está bien mi código?',
      '¿Por qué falla la segunda prueba?',
      'Dame la solución',
      'Is this right?',
      'Noséqué',
      'Ja ho tinc!',
      '',
    ])('does not take «%s» as stuck', (message) => {
      expect(isStuckMessage(message)).toBe(false);
    });

    it('is not stuck without a message', () => {
      expect(isStuckMessage(null)).toBe(false);
      expect(isStuckMessage(undefined)).toBe(false);
    });
  });

  describe('raisesHintLevel', () => {
    it('tells an answer that went up a level without a hint being asked', () => {
      expect(raisesHintLevel(stuck(2), [stuck(1)])).toBe(true);
      expect(raisesHintLevel(stuck(3), [turn('hint', 2), stuck(2)])).toBe(true);
    });

    it('is not a raise at the current level, for a hint or before the level is known', () => {
      expect(raisesHintLevel(stuck(1), [])).toBe(false);
      expect(raisesHintLevel(stuck(2), [turn('hint', 2)])).toBe(false);
      expect(raisesHintLevel(turn('hint', 2), [turn('hint', 1)])).toBe(false);
      expect(raisesHintLevel(stuck(null), [stuck(1)])).toBe(false);
    });
  });

  it('says when to use every reaction, for the prompt of the tutor', () => {
    expect(Object.keys(REACTION_USES).sort()).toEqual([...REACTION_KINDS].sort());
    for (const kind of REACTION_KINDS) {
      expect(REACTION_USES[kind].length, kind).toBeGreaterThan(10);
    }
  });

  it('gives every emotion a reaction of the catalog', () => {
    expect(Object.keys(EMOTION_REACTIONS).sort()).toEqual([...EMOTIONS].sort());
    for (const emotion of EMOTIONS) {
      expect(REACTION_KINDS).toContain(EMOTION_REACTIONS[emotion]);
    }
  });
});

describe('skeletonBlock', () => {
  it('writes the empty function in a block, with the names suggested', () => {
    expect(skeletonBlock('sum', 1, ['numbers'])).toBe('```js\nfunction sum(numbers) {\n}\n```');
    expect(skeletonBlock('pow', 2, ['base', 'exponent'])).toBe(
      '```js\nfunction pow(base, exponent) {\n}\n```',
    );
  });

  it('takes as many names as parameters, only plain ones, and letters for those missing', () => {
    expect(skeletonBlock('pow', 2)).toBe('```js\nfunction pow(a, b) {\n}\n```');
    expect(skeletonBlock('pow', 2, ['base'])).toBe('```js\nfunction pow(base, b) {\n}\n```');
    expect(skeletonBlock('sum', 1, ['x = []', 'numbers', 'extra'])).toBe(
      '```js\nfunction sum(numbers) {\n}\n```',
    );
    expect(skeletonBlock('now', 0, ['date'])).toBe('```js\nfunction now() {\n}\n```');
  });
});
