import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import type { ProcessEvent } from '../process-event';
import type { TutorEvent, TutorInteraction, TutorRequest } from '../tutor';
import { TutorService } from '../tutor-service';
import { findOwnAttempt, now } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';
import { TUTOR_TYPING_MS, typeOut } from '../tutor/typing';
import { type ScriptedAnswer, scriptedAnswer } from './scripted-answer';

/** Version of the prompt the interactions record (2.6); the scripted tutor follows v0. */
const PROMPT_VERSION = 'v0';

/**
 * The scripted tutor (4.3): it answers by level and kind with the texts of the fixtures, as `meta`,
 * the text in chunks with short pauses and `done`, like the Edge Function `tutor` will. It also does
 * what the server does: decides the level (2.6), records the interaction and the `hint_requested` or
 * `proactive_intervention` events (2.8), and sometimes keeps quiet when it steps in on its own.
 */
@Service({ autoProvided: false })
export class MockTutorService extends TutorService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);
  private readonly typingMs = inject(TUTOR_TYPING_MS);

  ask(request: TutorRequest): AsyncIterable<TutorEvent> {
    return this.answer(request);
  }

  private async *answer(request: TutorRequest): AsyncGenerator<TutorEvent> {
    const { answer, interactionId } = await this.network.request(() => this.record(request));
    const { emotion, intensity, reaction, hintLevel, text, silent, elusion } = answer;
    yield { type: 'meta', emotion, intensity, hintLevel, reaction, elusion };
    for await (const chunk of typeOut(text, this.typingMs)) {
      yield { type: 'delta', text: chunk };
    }
    yield { type: 'done', interactionId, silent };
  }

  /** Picks the answer and records it, as the server does before answering. */
  private record(request: TutorRequest): {
    answer: ScriptedAnswer;
    interactionId: string | null;
  } {
    const { attemptId, kind, message, code } = request;
    if (kind === 'question' && !message?.trim()) {
      throw new DataError('invalid', 'A question needs its message');
    }
    const tables = this.db.tables();
    const attempt = findOwnAttempt(tables, this.db.requireUser(), attemptId);
    if (attempt.status === 'submitted') {
      throw new DataError('invalid', 'A submitted attempt gets no more help');
    }
    // In the order they were recorded, oldest first
    const previous = tables.interactions.filter(
      (interaction) => interaction.attemptId === attemptId,
    );
    const answer = scriptedAnswer({ kind, message, code, status: attempt.status, previous });
    const timestamp = now();

    const event = this.eventOf(request, answer, timestamp);
    if (event) {
      this.db.update('events', (rows) => [...rows, event]);
    }
    if (answer.silent) {
      return { answer, interactionId: null };
    }
    const interaction: TutorInteraction = {
      id: crypto.randomUUID(),
      attemptId,
      trigger: kind,
      hintLevel: answer.hintLevel,
      // Only a question carries a message (2.6)
      studentMessage: message ?? null,
      transcript: answer.text,
      emotion: answer.emotion,
      intensity: answer.intensity,
      elusion: answer.elusion,
      promptVersion: PROMPT_VERSION,
      createdAt: timestamp,
    };
    this.db.update('interactions', (rows) => [...rows, interaction]);
    return { answer, interactionId: interaction.id };
  }

  /** The process event the server records for a hint or a proactive intervention (2.8). */
  private eventOf(
    { attemptId, kind }: TutorRequest,
    answer: ScriptedAnswer,
    timestamp: string,
  ): ProcessEvent | undefined {
    const base = { id: crypto.randomUUID(), attemptId, timestamp };
    switch (kind) {
      case 'hint':
        return { ...base, type: 'hint_requested', detail: { level: answer.hintLevel } };
      case 'proactive':
        return { ...base, type: 'proactive_intervention', detail: { silent: answer.silent } };
      case 'question':
        return undefined;
    }
  }
}
