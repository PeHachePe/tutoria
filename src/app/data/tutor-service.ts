import type { TutorEvent, TutorPreviewRequest, TutorRequest } from './tutor';

/**
 * The AI tutor (2.6). Abstract class without a decorator: it is the injection token (4.2, D-005).
 */
export abstract class TutorService {
  /** The answer as `meta` → `delta`(s) → `done`; the server decides the hint level. */
  abstract ask(request: TutorRequest): AsyncIterable<TutorEvent>;

  /**
   * «Probar como alumno» (4.3e, D-061): the same answer for a teacher trying an exercise, with the
   * exercise and the try instead of an attempt, and nothing kept. `forbidden` for a student.
   */
  abstract tryOut(request: TutorPreviewRequest): AsyncIterable<TutorEvent>;
}
