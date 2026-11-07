import { InjectionToken } from '@angular/core';

/** A seed account the login offers as a one-click sign-in during development. */
export interface DemoAccount {
  /** What the account is for, such as `Alumna`: the name of its button. */
  readonly label: string;
  /** Who it is, under the label: `Lucía Martín · 1.º DAW A`. */
  readonly detail: string;
  /** Material Symbols icon of the role. */
  readonly icon: string;
  readonly email: string;
  /** A test password of the seed data, never a real one. */
  readonly password: string;
}

/**
 * Demo accounts of the login. Empty unless the environment provides them (provideDemoAccounts() in
 * `dev/`), so neither the accounts nor their test password reach the production build (D-014, D-021).
 */
export const DEMO_ACCOUNTS = new InjectionToken<readonly DemoAccount[]>('DEMO_ACCOUNTS', {
  factory: () => [],
});
