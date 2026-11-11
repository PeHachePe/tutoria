import { TestBed } from '@angular/core/testing';

import { DEMO_ACCOUNTS } from '../auth/demo-accounts';
import { MOCK_PASSWORD, USERS } from '../data/mock/fixtures/users';
import { provideDemoAccounts } from './provide-demo-accounts';

describe('provideDemoAccounts', () => {
  it('leaves the login without demo accounts when nobody provides them', () => {
    expect(TestBed.inject(DEMO_ACCOUNTS)).toEqual([]);
  });

  it('offers a seed account per role, two students and the disabled one, with the test password', () => {
    TestBed.configureTestingModule({ providers: [provideDemoAccounts()] });

    const accounts = TestBed.inject(DEMO_ACCOUNTS);

    expect(accounts.map(({ label, detail }) => `${label}: ${detail}`)).toEqual([
      'Alumna: Lucía Martín Gómez · 1.º DAW A',
      'Alumna: Elena Vázquez Lorenzo · 1.º DAM B',
      'Docente: Marta Ibáñez Soler · 1.º DAW A',
      'Administración: Administración TutorIA',
      'Cuenta desactivada: Raúl Medina Cortés',
    ]);
    for (const account of accounts) {
      expect(USERS.some((user) => user.email === account.email)).toBe(true);
      expect(account.password).toBe(MOCK_PASSWORD);
    }
  });
});
