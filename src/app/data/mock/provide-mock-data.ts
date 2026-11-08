import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { AttemptService } from '../attempt-service';
import { AuthService } from '../auth-service';
import { CodeRunnerService } from '../code-runner-service';
import { EventService } from '../event-service';
import { ExerciseService } from '../exercise-service';
import { MockAttemptService } from './mock-attempt-service';
import { MockAuthService } from './mock-auth-service';
import { MockCodeRunnerService } from './mock-code-runner-service';
import { MockEventService } from './mock-event-service';
import { MockExerciseService } from './mock-exercise-service';

/**
 * The mock version of every data service (4.4). Only environment.development.ts imports it, so the
 * mock data never reaches the production build. The rest of the services join in their own steps.
 */
export function provideMockData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthService, useClass: MockAuthService },
    { provide: ExerciseService, useClass: MockExerciseService },
    { provide: AttemptService, useClass: MockAttemptService },
    { provide: CodeRunnerService, useClass: MockCodeRunnerService },
    { provide: EventService, useClass: MockEventService },
  ]);
}
