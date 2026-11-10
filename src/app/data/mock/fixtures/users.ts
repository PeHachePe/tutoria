import type { AppUser, ClassGroup, Enrollment, Role, UserStatus } from '../../user';
import { fixtureId } from './fixture-id';

/**
 * Password of every seed user, in the mock data and in local Supabase. A test value: these
 * accounts exist only in development.
 */
export const MOCK_PASSWORD = 'tutoria';

const CREATED_AT = '2026-09-01T08:00:00.000Z';

export const ADMIN_ID = fixtureId('user', 1);
/** Teacher of 1.º DAW A. */
export const TEACHER_ID = fixtureId('user', 2);
/** Teacher of 1.º DAM B. */
export const OTHER_TEACHER_ID = fixtureId('user', 3);
export const DISABLED_STUDENT_ID = fixtureId('user', 50);

export const DAW_GROUP_ID = fixtureId('group', 1);
export const DAM_GROUP_ID = fixtureId('group', 2);

/** Students of 1.º DAW A, a full class (24): the first four have the richest history. */
const DAW_STUDENTS: readonly (readonly [name: string, email: string])[] = [
  ['Lucía Martín Gómez', 'lucia.martin'],
  ['Hugo Sánchez Ferrer', 'hugo.sanchez'],
  ['Aya Benali Haddad', 'aya.benali'],
  ['Daniel Mendoza Rojas', 'daniel.mendoza'],
  ['Carmen Navarro Gil', 'carmen.navarro'],
  ['Iker Etxeberria Lasa', 'iker.etxeberria'],
  ['Valentina Castro Ríos', 'valentina.castro'],
  ['Adrián López Vidal', 'adrian.lopez'],
  ['Nerea Torres Pascual', 'nerea.torres'],
  ['Omar El Idrissi', 'omar.elidrissi'],
  ['Paula Romero Serrano', 'paula.romero'],
  ['Marc Puig Soler', 'marc.puig'],
  ['Irene Delgado Cano', 'irene.delgado'],
  ['Samuel Okafor Díaz', 'samuel.okafor'],
  ['Laura Herrera Molina', 'laura.herrera'],
  ['Pablo Jiménez Ramos', 'pablo.jimenez'],
  ['Sofía Morales Vega', 'sofia.morales'],
  ['Andrei Popescu', 'andrei.popescu'],
  ['Alba Rubio Campos', 'alba.rubio'],
  ['Mario Garrido Peña', 'mario.garrido'],
  ['Yanira Santana Suárez', 'yanira.santana'],
  ['Álex Ruiz Moreno', 'alex.ruiz'],
  ['Noa Fernández Prieto', 'noa.fernandez'],
  ['Lucas Ortiz Blanco', 'lucas.ortiz'],
];

/** Students of 1.º DAM B, a smaller group with another teacher. */
const DAM_STUDENTS: readonly (readonly [name: string, email: string])[] = [
  ['Elena Vázquez Lorenzo', 'elena.vazquez'],
  ['Rubén Cabrera Méndez', 'ruben.cabrera'],
  ['Mei Chen Wang', 'mei.chen'],
  ['Jorge Domínguez Rey', 'jorge.dominguez'],
  ['Inés Calvo Sanz', 'ines.calvo'],
  ['Bilal Amrani', 'bilal.amrani'],
];

export const DAW_STUDENT_IDS = DAW_STUDENTS.map((_, index) => fixtureId('user', 11 + index));
export const DAM_STUDENT_IDS = DAM_STUDENTS.map((_, index) => fixtureId('user', 41 + index));

function user(
  id: string,
  name: string,
  email: string,
  role: Role,
  status: UserStatus = 'active',
): AppUser {
  return {
    id,
    name,
    email: `${email}@tutoria.test`,
    role,
    status,
    // Every account starts without having seen the data notice, so the demo shows it
    privacyNoticeSeenAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

export const USERS: readonly AppUser[] = [
  user(ADMIN_ID, 'Administración TutorIA', 'admin', 'admin'),
  user(TEACHER_ID, 'Marta Ibáñez Soler', 'marta.ibanez', 'teacher'),
  user(OTHER_TEACHER_ID, 'Javier Ortega Ruiz', 'javier.ortega', 'teacher'),
  ...DAW_STUDENTS.map(([name, email], index) =>
    user(DAW_STUDENT_IDS[index], name, email, 'student'),
  ),
  ...DAM_STUDENTS.map(([name, email], index) =>
    user(DAM_STUDENT_IDS[index], name, email, 'student'),
  ),
  // Left the course: cannot sign in and belongs to no group.
  user(DISABLED_STUDENT_ID, 'Raúl Medina Cortés', 'raul.medina', 'student', 'disabled'),
];

export const GROUPS: readonly ClassGroup[] = [
  { id: DAW_GROUP_ID, name: '1.º DAW A', schoolYear: '2026/27', teacherId: TEACHER_ID },
  { id: DAM_GROUP_ID, name: '1.º DAM B', schoolYear: '2026/27', teacherId: OTHER_TEACHER_ID },
];

export const ENROLLMENTS: readonly Enrollment[] = [
  ...DAW_STUDENT_IDS.map((userId) => ({ groupId: DAW_GROUP_ID, userId })),
  ...DAM_STUDENT_IDS.map((userId) => ({ groupId: DAM_GROUP_ID, userId })),
].map((enrollment, index) => ({ id: fixtureId('enrollment', index + 1), ...enrollment }));
