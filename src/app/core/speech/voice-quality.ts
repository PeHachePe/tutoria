import type { AppLocale } from '../i18n/locale';
import type { SpeechVoice } from './speech-service';

/** Words in the names of the voices that sound natural: neural, network or enhanced ones. */
const NATURAL = /\b(natural|neural|online|premium|enhanced|mejorada|millorada|google)\b/i;

/**
 * The voices of macOS that Chrome offers and that sound robotic or are a joke: the old Eloquence
 * voices and the novelty ones. They are only shown on demand.
 */
const NOVELTY = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'eddy',
  'flo',
  'fred',
  'good news',
  'grandma',
  'grandpa',
  'jester',
  'junior',
  'kathy',
  'organ',
  'ralph',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
]);

/** Its first name, without the language that Chrome adds («Eddy (español (España))»). */
function baseName(voice: SpeechVoice): string {
  return voice.name
    .replace(/\s*\(.*$/, '')
    .trim()
    .toLowerCase();
}

export function isNoveltyVoice(voice: SpeechVoice): boolean {
  return NOVELTY.has(baseName(voice));
}

/** 0 sounds natural, 1 is a voice of the system, 2 a novelty one. */
function rank(voice: SpeechVoice): number {
  if (isNoveltyVoice(voice)) return 2;
  return NATURAL.test(voice.name) || voice.local === false ? 0 : 1;
}

/** Orders the voices from the most natural, and by name within each kind. */
export function byQuality(language: AppLocale): (a: SpeechVoice, b: SpeechVoice) => number {
  return (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, language);
}
