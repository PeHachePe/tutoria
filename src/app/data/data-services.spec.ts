import type { AbstractType } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdminService } from './admin-service';
import { AttemptService } from './attempt-service';
import { AuthService } from './auth-service';
import { CodeRunnerService } from './code-runner-service';
import { EventService } from './event-service';
import { ExerciseService } from './exercise-service';
import { LiveService } from './live-service';
import { StatsService } from './stats-service';
import { TutorService } from './tutor-service';

const DATA_SERVICES: AbstractType<unknown>[] = [
  AuthService,
  ExerciseService,
  AttemptService,
  CodeRunnerService,
  TutorService,
  EventService,
  LiveService,
  StatsService,
  AdminService,
];

// The data services are abstract classes without a decorator (D-005): an environment that forgets
// to provide one of them must fail right away with an injection error.
describe('data services', () => {
  it.each(DATA_SERVICES.map((service) => [service.name, service] as const))(
    '%s needs a provider',
    (_name, service) => {
      expect(() => TestBed.inject(service)).toThrowError(/No provider/);
    },
  );
});
