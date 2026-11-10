import {
  answerHintLevel,
  EMOTION_REACTIONS,
  EMOTIONS,
  type HintLevel,
  REACTION_KINDS,
  REACTION_USES,
  reachedHintLevel,
  type TutorTrigger,
} from './tutor-contract';

const turn = (trigger: TutorTrigger, hintLevel: HintLevel | null = 1) => ({ trigger, hintLevel });

describe('tutor contract', () => {
  describe('reachedHintLevel', () => {
    it('is none before the first hint', () => {
      expect(reachedHintLevel([])).toBe(0);
      expect(reachedHintLevel([turn('question', 2), turn('proactive', 3)])).toBe(0);
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
