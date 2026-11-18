import { TestBed } from '@angular/core/testing';

import { AdminService } from '../admin-service';
import { AttemptService } from '../attempt-service';
import { AuthService } from '../auth-service';
import { BlockService } from '../block-service';
import { StatsService } from '../stats-service';
import { CodeRunnerService } from '../code-runner-service';
import { EventService } from '../event-service';
import { ExerciseService } from '../exercise-service';
import { LiveService } from '../live-service';
import { TutorService } from '../tutor-service';
import { MockAdminService } from './mock-admin-service';
import { MockAttemptService } from './mock-attempt-service';
import { MockAuthService } from './mock-auth-service';
import { MockCodeRunnerService } from './mock-code-runner-service';
import { MockEventService } from './mock-event-service';
import { MockExerciseService } from './mock-exercise-service';
import { MockLiveService } from './mock-live-service';
import { MockBlockService } from './mock-block-service';
import { MockStatsService } from './mock-stats-service';
import { MockTutorService } from './mock-tutor-service';
import { provideMockData } from './provide-mock-data';

describe('provideMockData', () => {
  it('provides the mock version of each data service', () => {
    TestBed.configureTestingModule({ providers: [provideMockData()] });

    expect(TestBed.inject(AuthService)).toBeInstanceOf(MockAuthService);
    expect(TestBed.inject(ExerciseService)).toBeInstanceOf(MockExerciseService);
    expect(TestBed.inject(AttemptService)).toBeInstanceOf(MockAttemptService);
    expect(TestBed.inject(CodeRunnerService)).toBeInstanceOf(MockCodeRunnerService);
    expect(TestBed.inject(EventService)).toBeInstanceOf(MockEventService);
    expect(TestBed.inject(TutorService)).toBeInstanceOf(MockTutorService);
    expect(TestBed.inject(LiveService)).toBeInstanceOf(MockLiveService);
    expect(TestBed.inject(BlockService)).toBeInstanceOf(MockBlockService);
    expect(TestBed.inject(StatsService)).toBeInstanceOf(MockStatsService);
    expect(TestBed.inject(AdminService)).toBeInstanceOf(MockAdminService);
  });
});
