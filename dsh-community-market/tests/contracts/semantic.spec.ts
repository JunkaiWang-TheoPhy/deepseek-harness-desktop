/**
 * Phase 1 M1.4 semantic validation tests.
 *
 * Each checker has a positive and negative case. The negative cases
 * deliberately bypass JSON Schema by mutating validated data in ways the
 * schema cannot constrain (e.g. duplicate `id` values, mismatched
 * provenance, query that exceeds maxLimit).
 */
import { describe, expect, it } from 'vitest'
import {
  checkProviderPageItemIdUniqueness,
  checkQueryAgainstManifest,
  checkSnapshotProvenanceConsistency,
  declaresBothNpmAndRepository,
} from '../../src/contracts/semantic.js'
import type {
  CatalogProviderPage,
  CatalogQuery,
  CatalogSnapshot,
  CatalogSourceManifest,
} from '../../src/contracts/types.js'

import catalogSourceExample from '../../docs/examples/catalog-source.example.json'
import catalogQueryExample from '../../docs/examples/catalog-query.example.json'
import catalogProviderPageExample from '../../docs/examples/catalog-provider-page.example.json'
import catalogSnapshotExample from '../../docs/examples/catalog-snapshot.example.json'

const manifest: CatalogSourceManifest = catalogSourceExample as unknown as CatalogSourceManifest
const baseQuery: CatalogQuery = catalogQueryExample as unknown as CatalogQuery
const page: CatalogProviderPage = catalogProviderPageExample as unknown as CatalogProviderPage
const snapshot: CatalogSnapshot = catalogSnapshotExample as unknown as CatalogSnapshot

describe('checkProviderPageItemIdUniqueness', () => {
  it('accepts a page with unique item ids', () => {
    expect(checkProviderPageItemIdUniqueness(page)).toEqual({ ok: true })
  })

  it('rejects a page with duplicate item ids', () => {
    const tampered: CatalogProviderPage = {
      ...page,
      items: [page.items[0]!, { ...page.items[0]!, displayName: 'Duplicate identity' }],
    }
    const result = checkProviderPageItemIdUniqueness(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('duplicate-item-id')
  })
})

describe('checkSnapshotProvenanceConsistency', () => {
  it('accepts a snapshot whose items carry matching provenance', () => {
    expect(checkSnapshotProvenanceConsistency(snapshot)).toEqual({ ok: true })
  })

  it('rejects a snapshot whose item provenance.sourceRecordId differs from the host source', () => {
    const items = snapshot.items
    const first = items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    const tampered: CatalogSnapshot = {
      ...snapshot,
      items: [
        { ...first, provenance: { ...first.provenance, sourceRecordId: '11111111-1111-1111-1111-111111111111' } },
        ...items.slice(1),
      ],
    }
    const result = checkSnapshotProvenanceConsistency(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('provenance-mismatch')
  })

  it('rejects a snapshot whose item provenance.providerId differs from the host source', () => {
    const items = snapshot.items
    const first = items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    const tampered: CatalogSnapshot = {
      ...snapshot,
      items: [
        { ...first, provenance: { ...first.provenance, providerId: 'org.spoofed' } },
        ...items.slice(1),
      ],
    }
    const result = checkSnapshotProvenanceConsistency(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('provenance-mismatch')
  })

  it('rejects a snapshot whose item provenance.itemId differs from item.id', () => {
    const items = snapshot.items
    const first = items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    const tampered: CatalogSnapshot = {
      ...snapshot,
      items: [
        { ...first, provenance: { ...first.provenance, itemId: 'spoofed-item' } },
        ...items.slice(1),
      ],
    }
    const result = checkSnapshotProvenanceConsistency(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('provenance-mismatch')
  })
})

describe('checkQueryAgainstManifest', () => {
  it('accepts a query that respects the manifest limits and supported sorts', () => {
    expect(checkQueryAgainstManifest(baseQuery, manifest)).toEqual({ ok: true })
  })

  it('rejects a query limit that exceeds manifest maxLimit', () => {
    const result = checkQueryAgainstManifest({ ...baseQuery, limit: 200 }, manifest)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('query-limit-exceeds-max')
  })

  it('rejects a non-integer query limit', () => {
    const result = checkQueryAgainstManifest({ ...baseQuery, limit: 20.5 }, manifest)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('query-limit-invalid')
  })

  it('rejects a sort value the manifest does not advertise', () => {
    // narrow the manifest to a single sort so 'downloads' becomes unsupported
    const manifestOnlyRelevance: CatalogSourceManifest = {
      ...manifest,
      query: { ...manifest.query, sorts: ['relevance'] },
    }
    const result = checkQueryAgainstManifest({ ...baseQuery, sort: 'downloads' }, manifestOnlyRelevance)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('query-sort-unsupported')
  })

  it('rejects a manifest whose defaultLimit exceeds maxLimit', () => {
    const tamperedManifest: CatalogSourceManifest = {
      ...manifest,
      query: { ...manifest.query, defaultLimit: manifest.query.maxLimit + 1 },
    }
    const result = checkQueryAgainstManifest(baseQuery, tamperedManifest)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('manifest-limit-inconsistent')
  })
})

describe('declaresBothNpmAndRepository', () => {
  it('returns true when both package and repository are declared', () => {
    const first = snapshot.items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    expect(declaresBothNpmAndRepository(first)).toBe(true)
  })

  it('returns false when only repository is declared', () => {
    const items = snapshot.items
    const first = items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    const onlyRepo = { ...first, package: undefined }
    expect(declaresBothNpmAndRepository(onlyRepo)).toBe(false)
  })

  it('returns false when only package is declared', () => {
    const items = snapshot.items
    const first = items[0]
    if (first === undefined) throw new Error('snapshot must have items')
    const onlyPkg = { ...first, repository: undefined }
    expect(declaresBothNpmAndRepository(onlyPkg)).toBe(false)
  })
})