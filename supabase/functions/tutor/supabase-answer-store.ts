import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { ExerciseTranslations } from '../../../src/app/data/localized-text.ts';
import type { HintLevel, Intensity } from '../../../src/app/data/tutor/tutor-contract.ts';
import { providerSettingOf } from './provider-setting.ts';
import type {
  AnswerStore,
  LastRun,
  NewAnswer,
  ProviderSetting,
  RecordedAnswer,
  RecordOutcome,
  TutorAttempt,
} from './answer-store.ts';

/** The row of `app_setting` with the active provider (2.3). */
const AI_PROVIDER_KEY = 'ai_provider';

/** The tables and the functions of step 2.4, with `service_role`, which skips the RLS. */
export class SupabaseAnswerStore implements AnswerStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async userOf(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    return error ? null : data.user.id;
  }

  async findAttempt(attemptId: string): Promise<TutorAttempt | null> {
    const [attempt, lastRun] = await Promise.all([
      this.admin
        .from('attempt')
        .select(
          'user_id, status, current_code, app_user(status), exercise(title, statement, topics, source_locale, translations, function_name, test(id, input, expected_output, is_hidden, position)), tutor_interaction(trigger, hint_level, student_message, transcript, emotion, intensity, elusion, created_at)',
        )
        .eq('id', attemptId)
        .maybeSingle(),
      this.admin
        .from('process_event')
        .select('detail')
        .eq('attempt_id', attemptId)
        .eq('type', 'run')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (attempt.error) throw new Error(`Reading the attempt failed: ${attempt.error.message}`);
    if (lastRun.error) throw new Error(`Reading the last run failed: ${lastRun.error.message}`);
    const data = attempt.data;
    if (!data?.exercise || !data.app_user) return null;
    return {
      userId: data.user_id,
      ownerActive: data.app_user.status === 'active',
      status: data.status,
      currentCode: data.current_code,
      exercise: {
        title: data.exercise.title,
        statement: data.exercise.statement,
        topics: data.exercise.topics,
        sourceLocale: data.exercise.source_locale,
        // A check of the table gives it this shape (is_valid_exercise_translations)
        translations: data.exercise.translations as ExerciseTranslations,
        functionName: data.exercise.function_name,
        tests: data.exercise.test
          .toSorted((a, b) => a.position - b.position)
          .map((test) => ({
            id: test.id,
            input: test.input as unknown[],
            expectedOutput: test.expected_output,
            isHidden: test.is_hidden,
          })),
      },
      lastRun: (lastRun.data?.detail ?? null) as LastRun | null,
      previous: data.tutor_interaction
        .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
        .map((turn) => ({
          trigger: turn.trigger,
          hintLevel: turn.hint_level as HintLevel,
          studentMessage: turn.student_message,
          transcript: turn.transcript,
          emotion: turn.emotion,
          intensity: turn.intensity as Intensity,
          elusion: turn.elusion,
        })),
    };
  }

  async findAnswer(requestId: string): Promise<RecordedAnswer | null> {
    const { data, error } = await this.admin
      .from('tutor_interaction')
      .select('id, attempt_id, hint_level, emotion, intensity, transcript, elusion')
      .eq('request_id', requestId)
      .maybeSingle();
    if (error) throw new Error(`Reading the answer failed: ${error.message}`);
    return (
      data && {
        id: data.id,
        attemptId: data.attempt_id,
        hintLevel: data.hint_level as HintLevel,
        emotion: data.emotion,
        intensity: data.intensity as Intensity,
        transcript: data.transcript,
        elusion: data.elusion,
      }
    );
  }

  async latestCalls(userId: string, since: Date, limit: number): Promise<readonly Date[]> {
    const { data, error } = await this.admin.rpc('latest_tutor_calls', {
      target_user_id: userId,
      since: since.toISOString(),
      max_count: limit,
    });
    if (error) throw new Error(`Reading the latest calls failed: ${error.message}`);
    return data.map((calledAt) => new Date(calledAt));
  }

  async providerSetting(): Promise<ProviderSetting | null> {
    const { data, error } = await this.admin
      .from('app_setting')
      .select('value')
      .eq('key', AI_PROVIDER_KEY)
      .maybeSingle();
    if (error) throw new Error(`Reading the AI provider failed: ${error.message}`);
    return providerSettingOf(data?.value);
  }

  async recordAnswer(answer: NewAnswer): Promise<RecordOutcome> {
    const { data, error } = await this.admin.rpc('record_tutor_interaction', {
      target_attempt_id: answer.attemptId,
      target_request_id: answer.requestId,
      asked_trigger: answer.trigger,
      answer_hint_level: answer.hintLevel,
      // The generated types do not know SQL arguments may be null: a hint or an intervention has none
      asked_message: answer.studentMessage as string,
      answer_transcript: answer.answer?.message ?? '',
      answer_emotion: answer.answer?.emotion ?? 'encouragement',
      answer_intensity: answer.answer?.intensity ?? 1,
      answer_elusion: answer.answer?.elusion ?? false,
      answer_prompt_version: answer.promptVersion,
      answer_model: answer.model,
      answer_silent: answer.answer === null,
      answer_rejected: answer.rejected,
    });
    // Raised by record_tutor_interaction (20261110100600_tutor.sql) and its unique request id
    if (error?.code === '23505') return { status: 'duplicate' };
    if (error?.code === 'P0001') return { status: 'submitted' };
    if (error?.code === 'P0002') return { status: 'not_found' };
    if (error) throw new Error(`Recording the answer failed: ${error.message}`);
    return { status: 'recorded', interactionId: data ?? null };
  }
}
