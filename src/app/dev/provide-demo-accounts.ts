import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { DEMO_ACCOUNTS, DemoAccount } from '../auth/demo-accounts';
import {
  ADMIN_ID,
  DAW_STUDENT_IDS,
  DISABLED_STUDENT_ID,
  GROUPS,
  MOCK_PASSWORD,
  TEACHER_ID,
  USERS,
} from '../data/mock/fixtures/users';

const [DAW_GROUP] = GROUPS;

/**
 * One seed account per role, plus the disabled one to see how the login rejects it. Their labels
 * are translated: they show on the login, unlike the rest of the dev tools (D-023).
 */
const ACCOUNTS: readonly (readonly [
  label: string,
  icon: string,
  userId: string,
  group?: string,
])[] = [
  [$localize`:@@demo.student:Alumna`, 'school', DAW_STUDENT_IDS[0], DAW_GROUP.name],
  [$localize`:@@demo.teacher:Docente`, 'co_present', TEACHER_ID, DAW_GROUP.name],
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
