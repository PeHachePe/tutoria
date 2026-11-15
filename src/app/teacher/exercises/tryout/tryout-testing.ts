import { createEnvironmentInjector, EnvironmentInjector, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../../auth/auth-store';
import type { Exercise } from '../../../data/exercise';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_EXERCISE, type TryoutExercise } from './tryout-exercise';

/** «Suma» as the form has it: one example and one hidden test. */
export const TRYOUT_SUM: TryoutExercise = {
  content: {
    exercise: {
      id: 'preview',
      title: 'Suma',
      statement: 'Escribe `sum`.',
      topics: ['Bucles'],
      sourceLocale: 'es',
      translations: {},
      difficulty: 'initial',
      functionName: 'sum',
      parameters: ['values'],
      language: 'javascript',
      maxRepeatedFailures: 3,
      maxIdleMinutes: 5,
      createdBy: '',
      createdAt: '',
      updatedAt: '',
      archivedAt: null,
    } satisfies Exercise,
    visibleTests: [],
    hiddenTestCount: 1,
  },
  tests: [
    { input: [[1, 2]], expectedOutput: 3, isHidden: false },
    { input: [[]], expectedOutput: 0, isHidden: true },
  ],
};

/**
 * The services of a try in an injector of their own under the one of TestBed, as the dialog provides
 * them: the services of the app they take the place of stay in TestBed, where `skipSelf` finds them.
 */
export function tryoutInjector(providers: Provider[]): EnvironmentInjector {
  return createEnvironmentInjector(
    [
      TryoutAttemptService,
      { provide: TRYOUT_EXERCISE, useValue: TRYOUT_SUM },
      { provide: AuthStore, useValue: { userId: () => 'marta' } },
      ...providers,
    ],
    TestBed.inject(EnvironmentInjector),
  );
}
