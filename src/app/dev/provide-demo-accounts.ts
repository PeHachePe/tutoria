import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { DEMO_ACCOUNTS, DemoAccount } from '../auth/demo-accounts';
import {
  ADMIN_ID,
  DAM_STUDENT_IDS,
  DAW_STUDENT_IDS,
  DISABLED_STUDENT_ID,
  CLASSES,
  FRESH_STUDENT_ID,
  MOCK_PASSWORD,
  NEW_TEACHER_ID,
  TEACHER_ID,
  USERS,
} from '../data/mock/fixtures/users';

const [DAW_CLASS, DAM_CLASS] = CLASSES;

/**
 * One seed account per role, plus the disabled one to see how the login rejects it. Two students,
 * as their classes study different subjects (2.5c): Lucía, basic programming and web development;
 * Elena, basic and advanced programming. And a student and a teacher who start from scratch, to
 * try the guided help (7.0b1). Their labels
 * are translated: they show on the login, unlike the rest of the dev tools (D-023).
 */
const ACCOUNTS: readonly (readonly [
  label: string,
  icon: string,
  userId: string,
  group?: string,
])[] = [
  [$localize`:@@demo.student:Alumna`, 'school', DAW_STUDENT_IDS[0], DAW_CLASS.name],
  [$localize`:@@demo.student:Alumna`, 'school', DAM_STUDENT_IDS[0], DAM_CLASS.name],
  [$localize`:@@demo.freshStudent:Alumno sin empezar`, 'school', FRESH_STUDENT_ID, DAM_CLASS.name],
  [$localize`:@@demo.teacher:Docente`, 'co_present', TEACHER_ID, DAW_CLASS.name],
  [$localize`:@@demo.newTeacher:Docente sin clases`, 'co_present', NEW_TEACHER_ID],
  [$localize`:@@demo.admin:Administración`, 'admin_panel_settings', ADMIN_ID],
  [$localize`:@@demo.disabled:Cuenta desactivada`, 'person_off', DISABLED_STUDENT_ID],
];

/** The demo accounts, in the order of ACCOUNTS (a `flatMap` over the seed: no missing user to handle). */
const DEMO_ACCOUNT_LIST: readonly DemoAccount[] = ACCOUNTS.flatMap(([label, icon, userId, group]) =>
  USERS.filter((user) => user.id === userId).map((user) => ({
    label,
    detail: group ? `${user.name} · ${group}` : user.name,
    icon,
    email: user.email,
    password: MOCK_PASSWORD,
  })),
);

/**
 * Offers the seed accounts as one-click sign-ins on the login. Only the development environments
 * register it: the seed (and so these accounts) is the same in the mock data and in local Supabase.
 */
export function provideDemoAccounts(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DEMO_ACCOUNTS, useValue: DEMO_ACCOUNT_LIST }]);
}
