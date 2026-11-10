import { DataError, type DataErrorKind } from '../data-error';

/** What a failure of supabase-js carries, from PostgREST or from Auth. */
export interface SupabaseFailure {
  readonly message: string;
  /** SQLSTATE or PostgREST code (`P0002`, `PGRST116`) or Auth code (`invalid_credentials`). */
  readonly code?: string;
  /** HTTP status; 0 when the request never got an answer. */
  readonly status?: number;
}

/** The codes that say more than their status. */
const KIND_OF_CODE: Readonly<Record<string, DataErrorKind>> = {
  // Raised by the RPCs (20261110100200_attempt_workflow.sql)
  P0002: 'not_found',
  P0001: 'invalid',
  // `.single()` found no row: it does not exist or the RLS hides it
  PGRST116: 'not_found',
  // A malformed id, as in a link typed by hand: there is nothing with that id
  '22P02': 'not_found',
  // Unique, foreign key and check violations
  '23505': 'invalid',
  '23503': 'invalid',
  '23514': 'invalid',
  // The RLS or the column privileges reject the write
  '42501': 'forbidden',
  // Auth: wrong credentials, a disabled account or a session that cannot be renewed
  invalid_credentials: 'unauthorized',
  user_banned: 'unauthorized',
  session_not_found: 'unauthorized',
  refresh_token_not_found: 'unauthorized',
  bad_jwt: 'unauthorized',
  over_request_rate_limit: 'rate_limited',
};

/** The kind of each status without a known code; anything else is `unknown`. */
const KIND_OF_STATUS: Readonly<Record<number, DataErrorKind>> = {
  0: 'network',
  400: 'invalid',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'invalid',
  422: 'invalid',
  429: 'rate_limited',
  502: 'unavailable',
  503: 'unavailable',
  504: 'unavailable',
};

/** Translates a failure of Supabase into the only error the data services throw (4.2). */
export function toDataError(failure: SupabaseFailure): DataError {
  const kind =
    (failure.code && KIND_OF_CODE[failure.code]) ||
    (failure.status !== undefined && KIND_OF_STATUS[failure.status]) ||
    'unknown';
  return new DataError(kind, failure.message, { cause: failure });
}

/** An answer of PostgREST: its data, or its error with the HTTP status. */
export interface PostgrestAnswer {
  readonly data: unknown;
  readonly error: Omit<SupabaseFailure, 'status'> | null;
  readonly status: number;
}

/** The data of an answer of PostgREST that must bring some, or its DataError. */
export function unwrap<Answer extends PostgrestAnswer>(
  answer: Answer,
): NonNullable<Answer['data']> {
  check(answer);
  return answer.data as NonNullable<Answer['data']>;
}

/** Throws the DataError of an answer of PostgREST with an error, for the writes without data. */
export function check(answer: PostgrestAnswer): void {
  if (answer.error) throw toDataError({ ...answer.error, status: answer.status });
}
