import type { TutorEvent, TutorRequest } from './tutor';

/**
 * The AI tutor (2.6). Abstract class without a decorator: it is the injection token (4.2, D-005).
 */
export abstract class TutorService {
  /** The answer as `meta` → `delta`(s) → `done`; the server decides the hint level. */
  abstract ask(request: TutorRequest): AsyncIterable<TutorEvent>;
}
