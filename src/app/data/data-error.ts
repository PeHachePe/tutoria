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

/** The only error the data services throw: both versions (mock and Supabase) translate their errors into it. */
export class DataError extends Error {
  override readonly name = 'DataError';

  constructor(
    readonly kind: DataErrorKind,
    message = `Data error: ${kind}`,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
