/**
 * Phase 1 M1.2 contract validation tests.
 *
 * Each positive fixture must validate against its schema. Each negative case
 * must be rejected. These mirror the schema invariants that
 * scripts/verify-docs.mjs already enforces for the docs surface; the JS
 * equivalents keep the contract under vitest so future refactors stay honest.
 */
import { describe, expect, it } from 'vitest'
import {
  validateCatalogSource,
  validateCatalogQuery,
  validateCatalogProviderPage,
  validateCatalogSnapshot,
} from '../../src/contracts/schemas.js'

import catalogSourceExample from '../../docs/examples/catalog-source.example.json'
import catalogQueryExample from '../../docs/examples/catalog-query.example.json'
import catalogProviderPageExample from '../../docs/examples/catalog-provider-page.example.json'
import catalogSnapshotExample from '../../docs/examples/catalog-snapshot.example.json'

describe('catalog source schema', () => {
  it('accepts the canonical example', () => {
    expect(validateCatalogSource(catalogSourceExample)).toBe(true)
  })

  it('rejects local enabled state', () => {
    expect(validateCatalogSource({ ...catalogSourceExample, enabled: true })).toBe(false)
  })

  it('rejects insecure HTTP endpoint', () => {
    expect(validateCatalogSource({
      ...catalogSourceExample,
      transport: { ...catalogSourceExample.transport, endpoint: 'http://catalog.example/v1/plugins' },
    })).toBe(false)
  })

  it('rejects a credential-bearing attribution URL', () => {
    expect(validateCatalogSource({
      ...catalogSourceExample,
      attribution: { ...catalogSourceExample.attribution, url: 'https://user@example.org/' },
    })).toBe(false)
  })

  it('rejects an unsupported major version', () => {
    expect(validateCatalogSource({ ...catalogSourceExample, manifestVersion: '2.0.0' })).toBe(false)
  })

  it('rejects an unknown field', () => {
    expect(validateCatalogSource({ ...catalogSourceExample, rogue: true })).toBe(false)
  })
})

describe('catalog query schema', () => {
  it('accepts the canonical example', () => {
    expect(validateCatalogQuery(catalogQueryExample)).toBe(true)
  })

  it('rejects a zero limit', () => {
    expect(validateCatalogQuery({ ...catalogQueryExample, limit: 0 })).toBe(false)
  })

  it('rejects an unknown query property', () => {
    expect(validateCatalogQuery({ ...catalogQueryExample, unknown: true })).toBe(false)
  })

  it('rejects an unstable category identifier', () => {
    expect(validateCatalogQuery({ ...catalogQueryExample, category: ['User Interface'] })).toBe(false)
  })

  it('rejects an invalid capability identifier', () => {
    expect(validateCatalogQuery({ ...catalogQueryExample, capability: ['UI:Panel'] })).toBe(false)
  })

  it('rejects a locale that does not look like BCP 47', () => {
    expect(validateCatalogQuery({ ...catalogQueryExample, locale: 'not_a_locale!!' })).toBe(false)
  })
})

describe('catalog provider page schema', () => {
  it('accepts the canonical example', () => {
    expect(validateCatalogProviderPage(catalogProviderPageExample)).toBe(true)
  })

  it('rejects a provider page that smuggles an install field', () => {
    expect(validateCatalogProviderPage({
      ...catalogProviderPageExample,
      items: catalogProviderPageExample.items.map((item) => ({ ...item, install: 'pnpm add unsafe' })),
    })).toBe(false)
  })

  it('rejects a provider page with bidirectional spoofing controls', () => {
    expect(validateCatalogProviderPage({
      ...catalogProviderPageExample,
      items: catalogProviderPageExample.items.map((item) => ({ ...item, displayName: 'Safe‮exe.txt' })),
    })).toBe(false)
  })

  it('rejects a provider page that supplies Host provenance on items', () => {
    expect(validateCatalogProviderPage({
      ...catalogProviderPageExample,
      items: catalogProviderPageExample.items.map((item) => ({
        ...item,
        provenance: { sourceRecordId: '00000000-0000-0000-0000-000000000000', providerId: 'org.example', itemId: item.id },
      })),
    })).toBe(false)
  })

  it('rejects an unsupported major schemaVersion', () => {
    expect(validateCatalogProviderPage({ ...catalogProviderPageExample, schemaVersion: '2.0.0' })).toBe(false)
  })
})

describe('catalog snapshot schema', () => {
  it('accepts the canonical example', () => {
    expect(validateCatalogSnapshot(catalogSnapshotExample)).toBe(true)
  })

  it('rejects a normalized snapshot without Host provenance', () => {
    expect(validateCatalogSnapshot({
      ...catalogSnapshotExample,
      items: catalogSnapshotExample.items.map(({ provenance, ...item }) => item),
    })).toBe(false)
  })

  it('rejects a normalized snapshot without a package or repository identity', () => {
    expect(validateCatalogSnapshot({
      ...catalogSnapshotExample,
      items: catalogSnapshotExample.items.map(({ repository, package: packageIdentity, ...item }) => item),
    })).toBe(false)
  })

  it('rejects an unsupported major schemaVersion', () => {
    expect(validateCatalogSnapshot({ ...catalogSnapshotExample, schemaVersion: '2.0.0' })).toBe(false)
  })
})