/**
 * Phase 1 M1.5 catalog query serialization tests.
 *
 * Each rule from catalog-provider-contract §"标准 HTTP 来源" gets its own
 * test: URL API usage (no concat), repeated category/capability params,
 * unsupported field omission, encoding pass-through, cursor length bound.
 */
import { describe, expect, it } from 'vitest'
import {
  applyQueryToUrl,
  cursorBelongsTo,
  serializeCatalogQuery,
} from '../../src/catalog/query.js'
import type { CatalogQuery, CatalogQueryField } from '../../src/contracts/types.js'

const allFields: readonly CatalogQueryField[] = [
  'q', 'category', 'capability', 'cursor', 'limit', 'sort', 'locale',
]

describe('serializeCatalogQuery', () => {
  it('serializes a fully-populated query', () => {
    const query: CatalogQuery = {
      q: 'sidebar',
      category: ['interface'],
      capability: ['ui.panel'],
      cursor: 'page_2',
      limit: 20,
      sort: 'relevance',
      locale: 'zh-CN',
    }
    const params = serializeCatalogQuery(query, allFields)
    expect(params.get('q')).toBe('sidebar')
    expect(params.getAll('category')).toEqual(['interface'])
    expect(params.getAll('capability')).toEqual(['ui.panel'])
    expect(params.get('cursor')).toBe('page_2')
    expect(params.get('limit')).toBe('20')
    expect(params.get('sort')).toBe('relevance')
    expect(params.get('locale')).toBe('zh-CN')
  })

  it('omits fields not present on the query', () => {
    const params = serializeCatalogQuery({}, allFields)
    expect(params.toString()).toBe('')
  })

  it('omits fields not in the manifest supported list', () => {
    const query: CatalogQuery = {
      q: 'sidebar',
      limit: 20,
      locale: 'zh-CN',
    }
    const params = serializeCatalogQuery(query, ['q'])
    expect(params.has('q')).toBe(true)
    expect(params.has('locale')).toBe(false)
    expect(params.has('limit')).toBe(false)
  })

  it('repeats category and capability as repeated query parameters', () => {
    const query: CatalogQuery = {
      category: ['interface', 'tool'],
      capability: ['ui.panel', 'storage.local'],
    }
    const params = serializeCatalogQuery(query, allFields)
    // URLSearchParams.getAll returns each value; the resulting query string
    // must contain multiple `category=` and `capability=` entries.
    expect(params.getAll('category')).toEqual(['interface', 'tool'])
    expect(params.getAll('capability')).toEqual(['ui.panel', 'storage.local'])
    const stringified = params.toString()
    expect(stringified.match(/category=/g)?.length).toBe(2)
    expect(stringified.match(/capability=/g)?.length).toBe(2)
  })

  it('does not URL-encode values (URL API is responsible for that)', () => {
    // URLSearchParams.set encodes on toString(); serializeCatalogQuery
    // should not pre-encode.
    const query: CatalogQuery = { q: 'with space & symbols' }
    const params = serializeCatalogQuery(query, allFields)
    const raw = params.get('q')
    expect(raw).toBe('with space & symbols')
    const stringified = params.toString()
    expect(stringified).toContain('with+space')
    expect(stringified).toContain('%26')
  })

  it('drops undefined values rather than emitting empty strings', () => {
    const query: CatalogQuery = { q: undefined, limit: 20 }
    const params = serializeCatalogQuery(query, allFields)
    expect(params.has('q')).toBe(false)
    expect(params.get('limit')).toBe('20')
  })

  it('drops unsupported fields even if explicitly set on the query', () => {
    const query: CatalogQuery = { q: 'sidebar', limit: 50, locale: 'zh-CN' }
    const params = serializeCatalogQuery(query, ['q', 'category'])
    expect(params.get('q')).toBe('sidebar')
    expect(params.has('limit')).toBe(false)
    expect(params.has('locale')).toBe(false)
    expect(params.has('category')).toBe(false)
  })
})

describe('applyQueryToUrl', () => {
  it('returns a URL whose search encodes the supported params', () => {
    const url = new URL('https://catalog.example.org/v1/plugins')
    const query: CatalogQuery = {
      q: 'sidebar',
      category: ['interface'],
      limit: 20,
    }
    const next = applyQueryToUrl(url, query, allFields)
    expect(next.toString()).toBe(
      'https://catalog.example.org/v1/plugins?q=sidebar&category=interface&limit=20',
    )
  })

  it('does not mutate the input URL', () => {
    const url = new URL('https://catalog.example.org/v1/plugins')
    const before = url.toString()
    applyQueryToUrl(url, { q: 'sidebar' }, allFields)
    expect(url.toString()).toBe(before)
  })
})

describe('cursorBelongsTo', () => {
  it('accepts a cursor of valid length', () => {
    expect(cursorBelongsTo('page_2', 'src-id', allFields, {})).toBe(true)
  })

  it('rejects an empty cursor', () => {
    expect(cursorBelongsTo('', 'src-id', allFields, {})).toBe(false)
  })

  it('rejects a cursor over 2048 characters', () => {
    const huge = 'x'.repeat(2049)
    expect(cursorBelongsTo(huge, 'src-id', allFields, {})).toBe(false)
  })
})