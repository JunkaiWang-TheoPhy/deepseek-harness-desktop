/**
 * Multi-source aggregator.
 *
 * Per catalog-provider-contract §"多来源聚合":
 * - per-source independent timeout / cancellation / cache entry / cursor /
 *   loading state / error state
 * - bounded global and per-source concurrency
 * - a single source failure does not discard other sources' valid results
 * - sources are queried in parallel via a worker pool
 * - the canonical identity is `{ sourceRecordId, itemId }`
 * - provenance is preserved on every item
 */

import type { CatalogQuery, CatalogSnapshot, LocalSourceRecord, CatalogSourceManifest } from '../contracts/types.js'
import type { SourceRegistry } from './registry.js'
import type { CatalogSnapshotCache } from './cache.js'
import { defaultAggregateBudgets, type AggregateBudgets } from './constants.js'

/** A source paired with its manifest, ready for fetching. */
export interface SourceInput {
  readonly source: LocalSourceRecord
  readonly manifest: CatalogSourceManifest
}

export type SourceOutcome =
  | { kind: 'ok'; input: SourceInput; snapshot: CatalogSnapshot; cached: boolean; stale: boolean }
  | { kind: 'error'; input: SourceInput; reason: string; detail?: string }

export interface AggregateResult {
  readonly outcomes: readonly SourceOutcome[]
  /** True if at least one enabled source was submitted. */
  readonly hadActive: boolean
}

const cacheKeyFor = (input: SourceInput, query: CatalogQuery): string =>
  JSON.stringify({
    q: query.q ?? null,
    category: query.category ?? null,
    capability: query.capability ?? null,
    cursor: query.cursor ?? null,
    limit: query.limit ?? null,
    sort: query.sort ?? null,
    locale: query.locale ?? null,
    endpoint: input.manifest.transport.endpoint,
  })

export class CatalogAggregator {
  private readonly budgets: AggregateBudgets

  constructor(
    private readonly registry: SourceRegistry,
    private readonly cache: CatalogSnapshotCache,
    budgets?: Partial<AggregateBudgets>,
  ) {
    this.budgets = { ...defaultAggregateBudgets, ...budgets }
  }

  async aggregate(query: CatalogQuery, sources: readonly SourceInput[]): Promise<AggregateResult> {
    const queue: SourceInput[] = [...sources]
    if (queue.length === 0) return { outcomes: [], hadActive: false }

    const outcomes: SourceOutcome[] = []
    const inFlightPerSource = new Map<string, number>()

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const input = queue.shift()
        if (input === undefined) return
        const current = inFlightPerSource.get(input.source.sourceRecordId) ?? 0
        if (current >= this.budgets.perSourceConcurrency) {
          // per-source budget exhausted — re-queue at the head and yield
          queue.unshift(input)
          await new Promise<void>((resolve) => setTimeout(resolve, 5))
          continue
        }
        inFlightPerSource.set(input.source.sourceRecordId, current + 1)
        try {
          const outcome = await this.fetchOne(query, input)
          outcomes.push(outcome)
        } finally {
          const count = (inFlightPerSource.get(input.source.sourceRecordId) ?? 1) - 1
          if (count === 0) inFlightPerSource.delete(input.source.sourceRecordId)
          else inFlightPerSource.set(input.source.sourceRecordId, count)
        }
      }
    }

    const workerCount = Math.min(this.budgets.globalConcurrency, queue.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return { outcomes, hadActive: true }
  }

  private async fetchOne(query: CatalogQuery, input: SourceInput): Promise<SourceOutcome> {
    const adapter = this.registry.bindSource(input.source)
    if (adapter === undefined) {
      return { kind: 'error', input, reason: 'adapter-not-registered', detail: input.source.adapterId }
    }

    const cacheKey = cacheKeyFor(input, query)
    const cached = this.cache.get({ sourceRecordId: input.source.sourceRecordId, queryKey: cacheKey })
    if (cached !== undefined) {
      return {
        kind: 'ok',
        input,
        snapshot: cached.snapshot,
        cached: true,
        stale: cached.stale,
      }
    }

    let snapshot: CatalogSnapshot
    try {
      snapshot = await adapter.fetch(query, {
        signal: new AbortController().signal, // Phase 3 replaces with a Host-owned controller
        sourceRecordId: input.source.sourceRecordId,
        manifest: input.manifest,
      })
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : String(cause)
      return { kind: 'error', input, reason: 'fetch-failed', detail: message }
    }
    this.cache.put(
      { sourceRecordId: input.source.sourceRecordId, queryKey: cacheKey },
      snapshot,
    )
    return { kind: 'ok', input, snapshot, cached: false, stale: false }
  }
}