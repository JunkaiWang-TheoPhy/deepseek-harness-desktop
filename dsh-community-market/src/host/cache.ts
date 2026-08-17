/**
 * Per-source catalog snapshot cache.
 *
 * Two-tier lifetime:
 * - **fresh** (`freshTtlMs`): the entry is up-to-date; callers may use it
 *   without hitting the network.
 * - **last-good** (between `freshTtlMs` and `lastGoodRetentionMs`): the
 *   entry is older than the fresh window but kept around as a fallback.
 *   Callers receive it with `stale: true` so the UI can show "old data"
 *   without silently serving it as fresh.
 *
 * Beyond `lastGoodRetentionMs` the entry is dropped.
 *
 * Cache key is `(sourceRecordId, queryKey)` so each source can hold one
 * snapshot per query, and cursor reuse from a different source cannot
 * collide with the current one.
 */

import type { CatalogSnapshot } from '../contracts/types.js'
import { defaultCacheBudgets, type CacheBudgets } from './constants.js'

export interface CacheKey {
  readonly sourceRecordId: string
  readonly queryKey: string
}

export interface CacheLookup {
  readonly snapshot: CatalogSnapshot
  readonly fetchedAt: number
  /** True if the entry is past the fresh TTL but still within last-good retention. */
  readonly stale: boolean
}

interface CacheEntry {
  readonly snapshot: CatalogSnapshot
  readonly fetchedAt: number
}

export class CatalogSnapshotCache {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(
    private readonly budgets: CacheBudgets = defaultCacheBudgets,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private keyOf(key: CacheKey): string {
    return `${key.sourceRecordId}\0${key.queryKey}`
  }

  get(key: CacheKey): CacheLookup | undefined {
    const entry = this.entries.get(this.keyOf(key))
    if (entry === undefined) return undefined
    const age = this.now() - entry.fetchedAt
    if (age <= this.budgets.freshTtlMs) {
      return { snapshot: entry.snapshot, fetchedAt: entry.fetchedAt, stale: false }
    }
    if (age <= this.budgets.freshTtlMs + this.budgets.lastGoodRetentionMs) {
      return { snapshot: entry.snapshot, fetchedAt: entry.fetchedAt, stale: true }
    }
    this.entries.delete(this.keyOf(key))
    return undefined
  }

  put(key: CacheKey, snapshot: CatalogSnapshot): void {
    this.entries.set(this.keyOf(key), { snapshot, fetchedAt: this.now() })
  }

  /** Invalidate every cached entry for `sourceRecordId` (any query key). */
  invalidateSource(sourceRecordId: string): void {
    const prefix = `${sourceRecordId}\0`
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}