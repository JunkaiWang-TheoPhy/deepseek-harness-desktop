/**
 * Phase 3 M3.1-M3.4 route dispatch + storage bridge tests.
 *
 * Routes use the Fetch API surface (Request / Response) so the dispatch
 * function can be tested headlessly. The Host entry adapts Node
 * IncomingMessage → Request in plugin.ts; that adapter is exercised via
 * an integration smoke once the DSH harness is available.
 */
import { describe, expect, it } from 'vitest'
import {
  buildMarketHandle,
  dispatchMarketRequest,
  MARKET_ROUTE_PREFIX,
} from '../../src/host/routes.js'
import { PersistedCatalogSourceStore } from '../../src/host/store-impl.js'
import { MemoryKvStorage } from '../../src/host/kv-storage.js'
import { DefaultSourceRegistry } from '../../src/host/registry.js'
import { CatalogSnapshotCache } from '../../src/host/cache.js'
import { CatalogAggregator } from '../../src/host/aggregate.js'

function makeHandle() {
  const storage = new MemoryKvStorage()
  const store = new PersistedCatalogSourceStore(storage)
  const registry = new DefaultSourceRegistry()
  const cache = new CatalogSnapshotCache()
  const aggregator = new CatalogAggregator(registry, cache)
  return buildMarketHandle({ store, registry, cache, aggregator })
}

describe('dispatchMarketRequest', () => {
  it('returns ok on GET to the root', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(handle, new Request(`http://localhost${MARKET_ROUTE_PREFIX}`))
    expect(response.status).toBe(200)
    const body = await response.json() as { status: string }
    expect(body.status).toBe('ok')
  })

  it('lists empty sources on GET', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(handle, new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources`))
    expect(response.status).toBe(200)
    const body = await response.json() as { sources: unknown[] }
    expect(body.sources).toEqual([])
  })

  it('rejects source POST with malformed body', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources`, {
        method: 'POST',
        body: 'not-json{',
      }),
    )
    expect(response.status).toBe(400)
    const body = await response.json() as { error: { reason: string } }
    expect(body.error.reason).toBe('invalid-json')
  })

  it('adds a source on valid POST and returns 201', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          registrationKind: 'user-added',
          adapterId: 'market.standard-v1',
          providerId: 'org.example',
          manifestUrl: 'https://example.org/catalog.json',
        }),
      }),
    )
    expect(response.status).toBe(201)
    const body = await response.json() as { sourceRecordId: string }
    expect(typeof body.sourceRecordId).toBe('string')
    expect(handle.store.list()).toHaveLength(1)
  })

  it('rejects a POST that violates add-input invariants', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          registrationKind: 'user-added',
          adapterId: 'market.standard-v1',
          providerId: 'org.example',
          enabled: true,
        }),
      }),
    )
    expect(response.status).toBe(400)
  })

  it('GET on an unknown source returns 404', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources/00000000-0000-0000-0000-000000000000`),
    )
    expect(response.status).toBe(404)
  })

  it('DELETE removes a source', async () => {
    const handle = makeHandle()
    const { sourceRecordId } = handle.store.add({
      registrationKind: 'user-added',
      adapterId: 'market.standard-v1',
      providerId: 'org.example',
      manifestUrl: 'https://example.org/catalog.json',
      enabled: false,
      order: 0,
    })
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources/${sourceRecordId}`, { method: 'DELETE' }),
    )
    expect(response.status).toBe(200)
    expect(handle.store.get(sourceRecordId)).toBeUndefined()
  })

  it('POST item action=enable toggles the flag', async () => {
    const handle = makeHandle()
    const { sourceRecordId } = handle.store.add({
      registrationKind: 'user-added',
      adapterId: 'market.standard-v1',
      providerId: 'org.example',
      manifestUrl: 'https://example.org/catalog.json',
      enabled: false,
      order: 0,
    })
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}sources/${sourceRecordId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(handle.store.get(sourceRecordId)?.enabled).toBe(true)
  })

  it('GET catalog returns hadActive=false when no enabled sources', async () => {
    const handle = makeHandle()
    handle.store.add({
      registrationKind: 'user-added',
      adapterId: 'market.standard-v1',
      providerId: 'org.example',
      manifestUrl: 'https://example.org/catalog.json',
      enabled: false,
      order: 0,
    })
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}catalog`),
    )
    const body = await response.json() as { hadActive: boolean; snapshots: unknown[] }
    expect(response.status).toBe(200)
    expect(body.hadActive).toBe(false)
    expect(body.snapshots).toEqual([])
  })

  it('returns 405 on unsupported method', async () => {
    const handle = makeHandle()
    const response = await dispatchMarketRequest(
      handle,
      new Request(`http://localhost${MARKET_ROUTE_PREFIX}catalog`, { method: 'POST' }),
    )
    expect(response.status).toBe(405)
  })
})