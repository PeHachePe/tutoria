/** Why a data service failed. The screens choose their message and whether to offer a retry from it. */
export type DataErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  /** The service is down or not there yet, such as the runner and the tutor before steps 2.3 and 2.4. */
  | 'unavailable'
  | 'invalid'
  | 'unknown';

export interface DataErrorOptions extends ErrorOptions {
  /** How long the server asked to wait before trying again (`Retry-After`), for `rate_limited`. */
  readonly retryAfterSeconds?: number;
}

/** The only error the data services throw: both versions (mock and Supabase) translate their errors into it. */
export class DataError extends Error {
  override readonly name = 'DataError';
  /** When it makes sense to try again (epoch milliseconds), if the server said so. */
  readonly retryAt?: number;

  constructor(
    readonly kind: DataErrorKind,
    message = `Data error: ${kind}`,
    options?: DataErrorOptions,
  ) {
    super(message, options);
    if (options?.retryAfterSeconds) {
      this.retryAt = Date.now() + options.retryAfterSeconds * 1000;
    }
  }
}
