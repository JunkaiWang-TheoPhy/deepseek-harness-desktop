/**
 * Phase 2 M2.4 per-source cache tests.
 *
 * Tests use an injected clock so the two TTL windows can be exercised
 * deterministically without waiting in real time.
 */
import { describe, expect, it } from 'vitest'
import { CatalogSnapshotCache } from '../../src/host/cache.js'
import type { CacheBudgets } from '../../src/host/constants.js'
import type { CatalogSnapshot } from '../../src/contracts/types.js'
import catalogSnapshotExample from '../../docs/examples/catalog-snapshot.example.json'

const snapshot: CatalogSnapshot = catalogSnapshotExample as unknown as CatalogSnapshot

const budgets: CacheBudgets = {
  freshTtlMs: 1000,
  lastGoodRetentionMs: 5000,
}

const key = { sourceRecordId: 'src-1', queryKey: 'q=sidebar&limit=20' }

/** Build a cache whose `now()` is variable and can be advanced by reassignment. */
function makeCache(): { cache: CatalogSnapshotCache; setNow: (ms: number) => void } {
  let nowMs = 0
  const cache = new CatalogSnapshotCache(budgets, () => nowMs)
  return {
    cache,
    setNow: (ms) => {
      nowMs = ms
    },
  }
}

describe('CatalogSnapshotCache freshness window', () => {
  it('returns the snapshot as fresh within the fresh TTL', () => {
    const { cache, setNow } = makeCache()
    setNow(0)
    cache.put(key, snapshot)
    setNow(budgets.freshTtlMs)
    expect(cache.get(key)?.stale).toBe(false)
  })

  it('marks the snapshot as stale after the fresh TTL but within last-good retention', () => {
    const { cache, setNow } = makeCache()
    setNow(0)
    cache.put(key, snapshot)
    setNow(budgets.freshTtlMs + 100)
    const lookup = cache.get(key)
    expect(lookup?.stale).toBe(true)
    expect(lookup?.snapshot).toBe(snapshot)
  })

  it('drops the entry after the last-good retention window', () => {
    const { cache, setNow } = makeCache()
    setNow(0)
    cache.put(key, snapshot)
    setNow(budgets.freshTtlMs + budgets.lastGoodRetentionMs + 1)
    expect(cache.get(key)).toBeUndefined()
  })

  it('keeps separate entries for different query keys under the same source', () => {
    const { cache, setNow } = makeCache()
    setNow(0)
    cache.put(key, snapshot)
    const otherKey = { sourceRecordId: 'src-1', queryKey: 'q=other&limit=20' }
    const otherSnapshot: CatalogSnapshot = { ...snapshot, source: { ...snapshot.source, fetchedAt: '2030-01-01T00:00:00Z' } }
    cache.put(otherKey, otherSnapshot)
    expect(cache.get(key)?.snapshot).toBe(snapshot)
    expect(cache.get(otherKey)?.snapshot).toBe(otherSnapshot)
  })

  it('invalidateSource clears every entry for the source regardless of query key', () => {
    const { cache, setNow } = makeCache()
    setNow(0)
    cache.put(key, snapshot)
    cache.put({ sourceRecordId: 'src-1', queryKey: 'q=other' }, snapshot)
    cache.put({ sourceRecordId: 'src-2', queryKey: 'q=other' }, snapshot)
    cache.invalidateSource('src-1')
    expect(cache.get(key)).toBeUndefined()
    expect(cache.get({ sourceRecordId: 'src-2', queryKey: 'q=other' })).toBeDefined()
  })
})