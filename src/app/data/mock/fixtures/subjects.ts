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
  // The rest of the modules of DAW and DAM, without exercises: a school has many subjects, and the
  // lists that offer them (adding subjects to a class, filters) must work with all of them
  {
    id: fixtureId('subject', 4),
    name: 'Bases de datos',
    sourceLocale: 'es',
    translations: { en: { name: 'Databases' }, ca: { name: 'Bases de dades' } },
  },
  {
    id: fixtureId('subject', 5),
    name: 'Sistemas informáticos',
    sourceLocale: 'es',
    translations: { en: { name: 'Computer systems' }, ca: { name: 'Sistemes informàtics' } },
  },
  {
    id: fixtureId('subject', 6),
    name: 'Lenguajes de marcas',
    sourceLocale: 'es',
    translations: { en: { name: 'Markup languages' }, ca: { name: 'Llenguatges de marques' } },
  },
  {
    id: fixtureId('subject', 7),
    name: 'Entornos de desarrollo',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Development environments' },
      ca: { name: 'Entorns de desenvolupament' },
    },
  },
  {
    id: fixtureId('subject', 8),
    name: 'Desarrollo web en entorno servidor',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Server-side web development' },
      ca: { name: 'Desenvolupament web en entorn servidor' },
    },
  },
  {
    id: fixtureId('subject', 9),
    name: 'Despliegue de aplicaciones web',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Web application deployment' },
      ca: { name: "Desplegament d'aplicacions web" },
    },
  },
  {
    id: fixtureId('subject', 10),
    name: 'Diseño de interfaces web',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Web interface design' },
      ca: { name: "Disseny d'interfícies web" },
    },
  },
  {
    id: fixtureId('subject', 11),
    name: 'Acceso a datos',
    sourceLocale: 'es',
    translations: { en: { name: 'Data access' }, ca: { name: 'Accés a dades' } },
  },
  {
    id: fixtureId('subject', 12),
    name: 'Programación de servicios y procesos',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Services and processes programming' },
      ca: { name: 'Programació de serveis i processos' },
    },
  },
  {
    id: fixtureId('subject', 13),
    name: 'Programación multimedia y dispositivos móviles',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Multimedia and mobile programming' },
      ca: { name: 'Programació multimèdia i dispositius mòbils' },
    },
  },
  {
    id: fixtureId('subject', 14),
    name: 'Sistemas de gestión empresarial',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Business management systems' },
      ca: { name: 'Sistemes de gestió empresarial' },
    },
  },
  {
    id: fixtureId('subject', 15),
    name: 'Desarrollo de interfaces',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Interface development' },
      ca: { name: "Desenvolupament d'interfícies" },
    },
  },
  {
    id: fixtureId('subject', 16),
    name: 'Itinerario personal para la empleabilidad',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Personal employability pathway' },
      ca: { name: "Itinerari personal per a l'ocupabilitat" },
    },
  },
  {
    id: fixtureId('subject', 17),
    name: 'Inglés profesional',
    sourceLocale: 'es',
    translations: { en: { name: 'Professional English' }, ca: { name: 'Anglès professional' } },
  },
  {
    id: fixtureId('subject', 18),
    name: 'Digitalización aplicada a los sectores productivos',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Digitalisation applied to productive sectors' },
      ca: { name: 'Digitalització aplicada als sectors productius' },
    },
  },
  {
    id: fixtureId('subject', 19),
    name: 'Sostenibilidad aplicada al sistema productivo',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Sustainability applied to the productive system' },
      ca: { name: 'Sostenibilitat aplicada al sistema productiu' },
    },
  },
  {
    id: fixtureId('subject', 20),
    name: 'Proyecto intermodular',
    sourceLocale: 'es',
    translations: { en: { name: 'Cross-module project' }, ca: { name: 'Projecte intermodular' } },
  },
  {
    id: fixtureId('subject', 21),
    name: 'Seguridad y alta disponibilidad',
    sourceLocale: 'es',
    translations: {
      en: { name: 'Security and high availability' },
      ca: { name: 'Seguretat i alta disponibilitat' },
    },
  },
];
