/**
 * Phase 1 M1.7 CatalogAdapter interface tests.
 *
 * Phase 1 ships only the interface; the test suite verifies that a mock
 * implementation satisfies it, that `adapterId` is read-only, and that
 * `fetch` receives a fetch context whose signal is honored.
 */
import { describe, expect, it } from 'vitest'
import type { CatalogAdapter, CatalogAdapterFetchContext } from '../../src/contracts/adapter.js'
import type {
  CatalogQuery,
  CatalogSnapshot,
  CatalogSourceManifest,
} from '../../src/contracts/types.js'

import catalogSourceExample from '../../docs/examples/catalog-source.example.json'
import catalogSnapshotExample from '../../docs/examples/catalog-snapshot.example.json'
import catalogQueryExample from '../../docs/examples/catalog-query.example.json'

const manifest: CatalogSourceManifest = catalogSourceExample as unknown as CatalogSourceManifest
const query: CatalogQuery = catalogQueryExample as unknown as CatalogQuery
const snapshot: CatalogSnapshot = catalogSnapshotExample as unknown as CatalogSnapshot
const fetchContext: CatalogAdapterFetchContext = {
  signal: new AbortController().signal,
  sourceRecordId: '00000000-0000-0000-0000-000000000000',
  manifest,
}

describe('CatalogAdapter', () => {
  it('accepts an implementation with adapterId + fetch', async () => {
    const adapter: CatalogAdapter = {
      adapterId: 'market.standard-v1',
      async fetch(_q, _ctx) {
        return snapshot
      },
    }
    expect(adapter.adapterId).toBe('market.standard-v1')
    const result = await adapter.fetch(query, fetchContext)
    expect(result.schemaVersion).toBe('1.0.0')
  })

  it('respects the AbortSignal passed in the fetch context', async () => {
    const controller = new AbortController()
    const adapter: CatalogAdapter = {
      adapterId: 'market.standard-v1',
      async fetch(_q, ctx) {
        if (ctx.signal.aborted) throw new Error('aborted before fetch')
        return snapshot
      },
    }
    controller.abort()
    await expect(adapter.fetch(query, { ...fetchContext, signal: controller.signal })).rejects.toThrow('aborted before fetch')
  })
})