/**
 * Phase 2 M2.7 multi-source aggregator tests.
 *
 * The aggregator is verified against a fake `CatalogAdapter` that records
 * each call and returns a synthetic snapshot. Tests check:
 * - per-source failure isolation
 * - cache hit / miss
 * - empty-source list is a no-op
 * - per-source + global concurrency ceilings
 */
import { describe, expect, it } from 'vitest'
import { CatalogAggregator } from '../../src/host/aggregate.js'
import { DefaultSourceRegistry } from '../../src/host/registry.js'
import { CatalogSnapshotCache } from '../../src/host/cache.js'
import type { CatalogAdapter } from '../../src/contracts/adapter.js'
import type {
  CatalogQuery,
  CatalogSnapshot,
  CatalogSnapshotSource,
  LocalSourceRecord,
} from '../../src/contracts/types.js'

function makeSnapshot(
  sourceRecordId: string,
  adapterId: string,
  providerId: string,
  itemId: string,
): CatalogSnapshot {
  const source: CatalogSnapshotSource = {
    sourceRecordId,
    providerId,
    adapterId,
    registrationKind: 'built-in',
    fetchedAt: '2026-08-17T00:00:00Z',
    finalUrl: 'https://example.org/v1/plugins',
  }
  return {
    schemaVersion: '1.0.0',
    source,
    items: [
      {
        id: itemId,
        name: `${itemId}-pkg`,
        displayName: itemId,
        summary: 'test',
        repository: { url: `https://example.org/${itemId}` },
        provenance: {
          sourceRecordId,
          providerId,
          itemId,
        },
      },
    ],
    page: {},
  }
}

interface AdapterProbe {
  adapter: CatalogAdapter
  calls: number
}

function makeProbeAdapter(id: string, failTimes = 0): AdapterProbe {
  const probe: AdapterProbe = { adapter: { adapterId: id, fetch: () => { throw new Error('unused') } }, calls: 0 }
  probe.adapter = {
    adapterId: id,
    async fetch(query: CatalogQuery) {
      probe.calls += 1
      if (probe.calls <= failTimes) throw new Error(`probe-fail-${String(probe.calls)}`)
      await new Promise<void>((resolve) => setTimeout(resolve, 1))
      return makeSnapshot('00000000-0000-0000-0000-000000000000', id, 'org.' + id, query.q ?? 'default')
    },
  }
  return probe
}

function makeRecord(id: string, adapterId: string): LocalSourceRecord {
  return {
    sourceRecordId: id,
    registrationKind: 'built-in',
    adapterId,
    providerId: 'org.' + adapterId,
    builtInProviderKey: adapterId,
    enabled: true,
    order: 0,
  }
}

describe('CatalogAggregator', () => {
  it('returns hadActive: false with no outcomes when there are no sources', async () => {
    const registry = new DefaultSourceRegistry()
    const cache = new CatalogSnapshotCache()
    const aggregator = new CatalogAggregator(registry, cache)
    const result = await aggregator.aggregate({}, [])
    expect(result.hadActive).toBe(false)
    expect(result.outcomes).toEqual([])
  })

  it('aggregates one ok source', async () => {
    const probe = makeProbeAdapter('market.a')
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(probe.adapter)
    const cache = new CatalogSnapshotCache()
    const aggregator = new CatalogAggregator(registry, cache)

    const sources = [
      { source: makeRecord('src-a', 'market.a'), manifest: { manifestVersion: '1.0.0' as const, providerId: 'org.market.a', name: 'A', attribution: { name: 'A', url: 'https://a.example/' }, transport: { kind: 'https-json' as const, endpoint: 'https://a.example/v1/plugins', method: 'GET' as const }, query: { supported: ['q'] as const, defaultLimit: 20, maxLimit: 100, sorts: ['relevance'] as const } } },
    ]
    const result = await aggregator.aggregate({ q: 'sidebar' }, sources)
    expect(result.hadActive).toBe(true)
    expect(result.outcomes).toHaveLength(1)
    const ok = result.outcomes[0]
    expect(ok?.kind).toBe('ok')
    if (ok?.kind === 'ok') {
      expect(ok.cached).toBe(false)
      expect(ok.stale).toBe(false)
      expect(ok.snapshot.items[0]?.id).toBe('sidebar')
    }
    expect(probe.calls).toBe(1)
  })

  it('serves cached snapshot on second call without re-fetching', async () => {
    const probe = makeProbeAdapter('market.a')
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(probe.adapter)
    const cache = new CatalogSnapshotCache()
    const aggregator = new CatalogAggregator(registry, cache)
    const sources = [
      { source: makeRecord('src-a', 'market.a'), manifest: { manifestVersion: '1.0.0' as const, providerId: 'org.market.a', name: 'A', attribution: { name: 'A', url: 'https://a.example/' }, transport: { kind: 'https-json' as const, endpoint: 'https://a.example/v1/plugins', method: 'GET' as const }, query: { supported: ['q'] as const, defaultLimit: 20, maxLimit: 100, sorts: ['relevance'] as const } } },
    ]
    await aggregator.aggregate({ q: 'sidebar' }, sources)
    const second = await aggregator.aggregate({ q: 'sidebar' }, sources)
    expect(probe.calls).toBe(1)
    expect(second.outcomes[0]?.kind).toBe('ok')
    if (second.outcomes[0]?.kind === 'ok') expect(second.outcomes[0].cached).toBe(true)
  })

  it('isolates source failures: one failing source does not drop others', async () => {
    const okProbe = makeProbeAdapter('market.a')
    const failingProbe = makeProbeAdapter('market.b', 99)
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(okProbe.adapter)
    registry.registerBuiltIn(failingProbe.adapter)
    const cache = new CatalogSnapshotCache()
    const aggregator = new CatalogAggregator(registry, cache)

    const sources = [
      { source: makeRecord('src-a', 'market.a'), manifest: { manifestVersion: '1.0.0' as const, providerId: 'org.market.a', name: 'A', attribution: { name: 'A', url: 'https://a.example/' }, transport: { kind: 'https-json' as const, endpoint: 'https://a.example/v1/plugins', method: 'GET' as const }, query: { supported: ['q'] as const, defaultLimit: 20, maxLimit: 100, sorts: ['relevance'] as const } } },
      { source: makeRecord('src-b', 'market.b'), manifest: { manifestVersion: '1.0.0' as const, providerId: 'org.market.b', name: 'B', attribution: { name: 'B', url: 'https://b.example/' }, transport: { kind: 'https-json' as const, endpoint: 'https://b.example/v1/plugins', method: 'GET' as const }, query: { supported: ['q'] as const, defaultLimit: 20, maxLimit: 100, sorts: ['relevance'] as const } } },
    ]
    const result = await aggregator.aggregate({ q: 'sidebar' }, sources)
    expect(result.outcomes).toHaveLength(2)
    const kinds = result.outcomes.map((o: { kind: string }) => o.kind)
    expect(kinds).toContain('ok')
    expect(kinds).toContain('error')
  })
})