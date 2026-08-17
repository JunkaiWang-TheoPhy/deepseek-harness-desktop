/**
 * Phase 1 M1.3 contract type tests.
 *
 * Each canonical fixture is assigned to its type via a `unknown` cast —
 * JSON imports drop literal types, so `manifestVersion: '1.0.0'` becomes
 * `string` at the type level. The schema validator remains the runtime
 * authority for those literals.
 *
 * Typecheck still catches shape drift: e.g. removing `transport` from the
 * CatalogSourceManifest type would fail the assignment below.
 */
import { describe, expect, it } from 'vitest'
import type {
  CatalogProviderPage,
  CatalogQuery,
  CatalogSnapshot,
  CatalogSourceManifest,
  LocalSourceRecord,
} from '../../src/contracts/types.js'

import catalogSourceExample from '../../docs/examples/catalog-source.example.json'
import catalogQueryExample from '../../docs/examples/catalog-query.example.json'
import catalogProviderPageExample from '../../docs/examples/catalog-provider-page.example.json'
import catalogSnapshotExample from '../../docs/examples/catalog-snapshot.example.json'

describe('contract types', () => {
  it('catalog source example satisfies CatalogSourceManifest', () => {
    const manifest: CatalogSourceManifest = catalogSourceExample as unknown as CatalogSourceManifest
    expect(manifest.manifestVersion).toBe('1.0.0')
    expect(manifest.transport.kind).toBe('https-json')
    expect(manifest.transport.method).toBe('GET')
    expect(manifest.query.supported).toContain('q')
    expect(manifest.query.defaultLimit).toBeLessThanOrEqual(manifest.query.maxLimit)
  })

  it('catalog query example satisfies CatalogQuery', () => {
    const query: CatalogQuery = catalogQueryExample as unknown as CatalogQuery
    expect(query.limit).toBe(20)
    expect(query.sort).toBe('relevance')
  })

  it('provider page example satisfies CatalogProviderPage', () => {
    const page: CatalogProviderPage = catalogProviderPageExample as unknown as CatalogProviderPage
    expect(page.schemaVersion).toBe('1.0.0')
    expect(page.items.length).toBeGreaterThan(0)
    const first = page.items[0]
    if (first === undefined) throw new Error('provider page example must have items')
    // provider-page items must not carry Host provenance
    const asRecord = first as unknown as Record<string, unknown>
    expect(asRecord['provenance']).toBeUndefined()
  })

  it('snapshot example satisfies CatalogSnapshot and items have provenance', () => {
    const snapshot: CatalogSnapshot = catalogSnapshotExample as unknown as CatalogSnapshot
    expect(snapshot.schemaVersion).toBe('1.0.0')
    expect(snapshot.items.length).toBeGreaterThan(0)
    const first = snapshot.items[0]
    if (first === undefined) throw new Error('snapshot example must have items')
    expect(first.provenance.sourceRecordId).toBe(snapshot.source.sourceRecordId)
    expect(first.provenance.itemId).toBe(first.id)
  })

  it('local source record: user-added carries manifestUrl, not builtInProviderKey', () => {
    const record: LocalSourceRecord = {
      sourceRecordId: '00000000-0000-0000-0000-000000000000',
      registrationKind: 'user-added',
      adapterId: 'market.standard-v1',
      providerId: 'org.example.community-catalog',
      manifestUrl: 'https://example.org/catalog.json',
      enabled: false,
      order: 0,
    }
    expect(record.registrationKind).toBe('user-added')
    expect(record.manifestUrl).toBeDefined()
    expect(record.builtInProviderKey).toBeUndefined()
    expect(record.enabled).toBe(false)
  })

  it('local source record: built-in carries builtInProviderKey, not manifestUrl', () => {
    const record: LocalSourceRecord = {
      sourceRecordId: '00000000-0000-0000-0000-000000000000',
      registrationKind: 'built-in',
      adapterId: 'market.dsh-1024store-v1',
      providerId: 'org.dsh.1024store',
      builtInProviderKey: 'dsh-1024store',
      enabled: false,
      order: 0,
    }
    expect(record.registrationKind).toBe('built-in')
    expect(record.builtInProviderKey).toBe('dsh-1024store')
    expect(record.manifestUrl).toBeUndefined()
  })
})