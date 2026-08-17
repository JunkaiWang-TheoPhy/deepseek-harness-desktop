/**
 * Phase 2 M2.5 standard https-json adapter tests.
 *
 * Uses injected fetch + DNS resolve from M2.1 so the suite never touches
 * the network. Verifies the adapter:
 * - calls the endpoint with the URL-built query
 * - validates provider-page
 * - rejects pages with duplicate item ids
 * - injects Host provenance
 * - rejects malformed snapshots
 */
import { describe, expect, it } from 'vitest'
import { StandardHttpJsonAdapter } from '../../../src/host/adapters/standard.js'
import { RestrictedHttpClient } from '../../../src/host/http-client.js'
import type { RestrictedHttpClientHooks } from '../../../src/host/http-client.js'
import type { CatalogProviderPage, CatalogSourceManifest } from '../../../src/contracts/types.js'

import catalogProviderPageExample from '../../../docs/examples/catalog-provider-page.example.json'
import catalogSourceExample from '../../../docs/examples/catalog-source.example.json'

const page: CatalogProviderPage = catalogProviderPageExample as unknown as CatalogProviderPage
const manifest: CatalogSourceManifest = catalogSourceExample as unknown as CatalogSourceManifest

const publicResolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [
  { address: '93.184.216.34', family: 4 },
]

function makeAdapter(fetchImpl: typeof fetch): StandardHttpJsonAdapter {
  const client = new RestrictedHttpClient({
    fetchImpl,
    resolveImpl: publicResolve,
    budgets: { totalMs: 5_000 },
  })
  return new StandardHttpJsonAdapter(client)
}

describe('StandardHttpJsonAdapter', () => {
  it('fetches, validates, and returns a snapshot with Host provenance', async () => {
    const fetchImpl: typeof fetch = (async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString()
      // sanity: endpoint + query are correctly composed
      expect(url).toContain('https://plugins.example.org/v1/plugins')
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    const snapshot = await adapter.fetch(
      { q: 'sidebar', limit: 20 },
      {
        signal: new AbortController().signal,
        sourceRecordId: '00000000-0000-0000-0000-000000000000',
        manifest,
      },
    )
    expect(snapshot.source.adapterId).toBe('market.standard-v1')
    expect(snapshot.source.providerId).toBe('org.example.community-catalog')
    expect(snapshot.source.sourceRecordId).toBe('00000000-0000-0000-0000-000000000000')
    expect(snapshot.items[0]?.provenance.itemId).toBe(snapshot.items[0]?.id)
    expect(snapshot.items[0]?.provenance.providerId).toBe('org.example.community-catalog')
  })

  it('rejects a provider page with duplicate item ids', async () => {
    const tampered: CatalogProviderPage = {
      ...page,
      items: [page.items[0]!, { ...page.items[0]!, displayName: 'Duplicate identity' }],
    }
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify(tampered), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    await expect(
      adapter.fetch(
        {},
        { signal: new AbortController().signal, sourceRecordId: '00000000-0000-0000-0000-000000000000', manifest },
      ),
    ).rejects.toThrow(/duplicate-item-id/)
  })

  it('rejects a provider page that fails schema validation', async () => {
    const broken = { schemaVersion: '2.0.0', items: [], page: {} }
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify(broken), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    await expect(
      adapter.fetch(
        {},
        { signal: new AbortController().signal, sourceRecordId: '00000000-0000-0000-0000-000000000000', manifest },
      ),
    ).rejects.toThrow()
  })
})