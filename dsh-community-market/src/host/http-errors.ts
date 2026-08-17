/**
 * Stable error reasons for the restricted HTTP client.
 *
 * Every error from `RestrictedHttpClient.fetchJson` carries a `reason` from
 * this union. Callers and tests assert on `reason`, never on the human
 * `message`. Reasons are stable across releases; messages are not.
 */

export type RestrictedHttpErrorReason =
  /** URL scheme is not `https:`. */
  | 'scheme'
  /** URL carried userinfo (user:pass@). */
  | 'credentials'
  /** URL had a fragment. */
  | 'fragment'
  /** URL parser rejected the input. */
  | 'parse'
  /** DNS resolver failed or returned no addresses. */
  | 'unresolvable'
  /** DNS resolved to a private/loopback/link-local/etc address. */
  | 'private-address'
  /** DNS rebinding detected (resolved IP differs between resolution and connect). */
  | 'dns-rebinding'
  /** Redirect chain rejected (count exceeded, target URL bad, scheme downgrade). */
  | 'redirect-rejected'
  /** Connect deadline exceeded. */
  | 'timeout-connect'
  /** First-byte deadline exceeded. */
  | 'timeout-first-byte'
  /** Total deadline exceeded. */
  | 'timeout-total'
  /** Response status was not 2xx. */
  | 'status'
  /** `Content-Type` header is not application/json (or compatible). */
  | 'content-type'
  /** Compressed body exceeds the configured budget. */
  | 'body-too-large'
  /** Decompressed body exceeds the configured budget. */
  | 'decompressed-too-large'
  /** Response body could not be parsed as JSON. */
  | 'parse-json'
  /** Schema validation failed for the parsed body. */
  | 'schema'
  /** Caller-supplied AbortSignal fired before completion. */
  | 'aborted'
  /** Underlying fetch threw without a recognisable category. */
  | 'transport'

/** Error thrown by `RestrictedHttpClient.fetchJson` on any non-success path. */
export class RestrictedHttpError extends Error {
  readonly reason: RestrictedHttpErrorReason
  readonly detail?: string

  constructor(reason: RestrictedHttpErrorReason, detail?: string) {
    super(
      detail === undefined
        ? `restricted-http: ${reason}`
        : `restricted-http: ${reason}: ${detail}`,
    )
    this.name = 'RestrictedHttpError'
    this.reason = reason
    this.detail = detail
  }
}

/** Convenience type guard. */
export function isRestrictedHttpError(value: unknown): value is RestrictedHttpError {
  return value instanceof RestrictedHttpError
}