/**
 * Default budgets and constants for the restricted HTTP client and cache.
 *
 * Defaults mirror §17-3 (Labs-reviewed) unless an explicit override is
 * passed at construction time. Tests override individual fields.
 *
 * Budgets are intentional ceilings, not targets: a provider that exceeds
 * them is rejected, not truncated.
 */

export interface RestrictedHttpBudgets {
  /** Connect deadline in milliseconds. Default 5000. */
  readonly connectMs: number
  /** First-byte deadline in milliseconds (after connect). Default 10_000. */
  readonly firstByteMs: number
  /** Total deadline in milliseconds. Default 30_000. */
  readonly totalMs: number
  /** Compressed body ceiling. Default 1 MiB. */
  readonly maxBodyBytes: number
  /** Decompressed body ceiling. Default 2 MiB. */
  readonly maxDecompressedBytes: number
  /** Maximum redirect hops. Default 5. */
  readonly maxRedirects: number
}

export const defaultHttpBudgets: RestrictedHttpBudgets = {
  connectMs: 5_000,
  firstByteMs: 10_000,
  totalMs: 30_000,
  maxBodyBytes: 1 * 1024 * 1024,
  maxDecompressedBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
}

/**
 * Per-source cache settings.
 *
 * Defaults mirror §17-3: TTL 5 minutes, last-good retention 24 hours.
 */
export interface CacheBudgets {
  /** Fresh TTL in ms; entry is "fresh" for this long after `fetchedAt`. */
  readonly freshTtlMs: number
  /** Last-good retention in ms after staleness; entry dropped thereafter. */
  readonly lastGoodRetentionMs: number
}

export const defaultCacheBudgets: CacheBudgets = {
  freshTtlMs: 5 * 60 * 1000,
  lastGoodRetentionMs: 24 * 60 * 60 * 1000,
}

/**
 * Aggregator concurrency budgets.
 *
 * Default: 6 global, 2 per-source.
 */
export interface AggregateBudgets {
  readonly globalConcurrency: number
  readonly perSourceConcurrency: number
}

export const defaultAggregateBudgets: AggregateBudgets = {
  globalConcurrency: 6,
  perSourceConcurrency: 2,
}