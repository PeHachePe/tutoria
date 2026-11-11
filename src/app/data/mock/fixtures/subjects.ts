import type { Subject } from '../../subject';
import { fixtureId } from './fixture-id';

/** Subjects of vocational training that can be solved in JavaScript (2.5c), written in Spanish. */
export const BASIC_PROGRAMMING_ID = fixtureId('subject', 1);
export const ADVANCED_PROGRAMMING_ID = fixtureId('subject', 2);
export const WEB_CLIENT_ID = fixtureId('subject', 3);

export const SUBJECTS: readonly Subject[] = [
  {
    id: BASIC_PROGRAMMING_ID,
    name: 'Programación básica',
    sourceLocale: 'es',
    translations: { en: { name: 'Basic programming' }, ca: { name: 'Programació bàsica' } },
  },
  {
    id: ADVANCED_PROGRAMMING_ID,
    name: 'Programación avanzada',
    sourceLocale: 'es',
    translations: { en: { name: 'Advanced programming' }, ca: { name: 'Programació avançada' } },
  },
  {
    id: WEB_CLIENT_ID,
    name: 'Desarrollo web en entorno cliente',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Client-side web development' },
      ca: { name: 'Desenvolupament web en entorn client' },
    },
  },
];
