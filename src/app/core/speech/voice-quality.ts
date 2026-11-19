import type { AppLocale } from '../i18n/locale';
import type { SpeechVoice } from './speech-service';

/** Words in the names of the voices that sound natural: neural, network or enhanced ones. */
const NATURAL = /\b(natural|neural|online|premium|enhanced|mejorada|millorada|google)\b/i;

/** The old Eloquence voices of macOS that Chrome offers: they speak, but sound robotic. */
const ROBOTIC = new Set([
  'eddy',
  'flo',
  'grandma',
  'grandpa',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'albert',
  'fred',
  'junior',
  'kathy',
  'ralph',
]);

/**
 * The joke voices of macOS, which sing or make noises: shown on demand, for fun. macOS translates
 * their names into the language of the system (and so their `voiceURI`), so they are listed in
 * English, Spanish and Catalan.
 */
const JOKES = new Set([
  'bahh',
  'boing',
  'trinoids',
  'wobble',
  'zarvox',
  'bad news',
  'bells',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'superstar',
  'whisper',
  'buenas noticias',
  'bufón',
  'burbujas',
  'campanas',
  'malas noticias',
  'órgano',
  'superestrella',
  'susurro',
  'violonchelos',
  'bones notícies',
  'bufó',
  'bombolles',
  'campanes',
  'males notícies',
  'orgue',
  'xiuxiueig',
  'violoncels',
]);

/** Its first name, without the language that Chrome adds («Eddy (español (España))»). */
function baseName(voice: SpeechVoice): string {
  return voice.name
    .replace(/\s*\(.*$/, '')
    .trim()
    .toLowerCase();
}

/** A robotic voice, or a joke one that sings or makes noises: shown only on demand. */
export function isNoveltyVoice(voice: SpeechVoice): boolean {
  const name = baseName(voice);
  return ROBOTIC.has(name) || JOKES.has(name);
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
