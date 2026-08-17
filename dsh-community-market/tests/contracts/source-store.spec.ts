/**
 * Phase 1 M1.8 CatalogSourceStore interface + add-input validation tests.
 *
 * The test uses an in-memory mock implementation to verify the contract;
 * the persistence-backed implementation lands in M2.
 */
import { describe, expect, it } from 'vitest'
import {
  composeLocalSourceRecord,
  defaultSourceRecordIdFactory,
  validateAddInput,
  validateRecordCoherence,
} from '../../src/contracts/source-store.js'
import type {
  CatalogSourceStore,
  LocalSourceRecord,
  LocalSourceRecordInput,
} from '../../src/contracts/source-store.js'
import type { SourceRecordId } from '../../src/contracts/types.js'

function createMockStore(): CatalogSourceStore {
  const records = new Map<SourceRecordId, LocalSourceRecord>()
  let nextOrder = 0
  return {
    get(id) {
      return records.get(id)
    },
    list() {
      return [...records.values()].sort((a, b) => a.order - b.order)
    },
    add(input) {
      const sourceRecordId = defaultSourceRecordIdFactory()
      const record = composeLocalSourceRecord({ ...input, order: nextOrder++ }, sourceRecordId)
      records.set(sourceRecordId, record)
      return { sourceRecordId, record }
    },
    update(record) {
      records.set(record.sourceRecordId, record)
    },
    remove(id) {
      records.delete(id)
    },
  }
}

const baseInput: LocalSourceRecordInput = {
  registrationKind: 'user-added',
  adapterId: 'market.standard-v1',
  providerId: 'org.example.community-catalog',
  manifestUrl: 'https://example.org/catalog.json',
  enabled: false,
  order: 0,
}

describe('validateAddInput', () => {
  it('accepts a clean user-added input', () => {
    expect(validateAddInput(baseInput)).toEqual({ ok: true })
  })

  it('rejects an input that already carries a sourceRecordId', () => {
    // LocalSourceRecordInput is Omit<LocalSourceRecord, 'sourceRecordId'>,
    // so the type system rejects this assignment. The runtime check
    // validatesAddInput exists for non-TypeScript callers; cast through
    // `unknown` to exercise it.
    const smuggled = { ...baseInput, sourceRecordId: 'fixed-id' } as unknown as LocalSourceRecordInput
    const result = validateAddInput(smuggled)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('sourceRecordId-forbidden')
  })

  it('rejects enabled=true (new records must default to disabled)', () => {
    const result = validateAddInput({ ...baseInput, enabled: true })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('enabled-must-be-false')
  })

  it('rejects a record missing both manifestUrl and builtInProviderKey', () => {
    const result = validateAddInput({
      ...baseInput,
      manifestUrl: undefined,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('manifest-or-built-in-required')
  })

  it('rejects a record carrying both manifestUrl and builtInProviderKey', () => {
    const result = validateAddInput({
      ...baseInput,
      builtInProviderKey: 'standard',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('manifest-or-built-in-required')
  })
})

describe('validateRecordCoherence', () => {
  it('accepts a coherent user-added record', () => {
    const record = composeLocalSourceRecord(baseInput, '11111111-1111-1111-1111-111111111111')
    expect(validateRecordCoherence(record)).toEqual({ ok: true })
  })

  it('rejects a built-in record without builtInProviderKey', () => {
    const record = composeLocalSourceRecord(
      {
        ...baseInput,
        registrationKind: 'built-in',
        manifestUrl: undefined,
        builtInProviderKey: undefined,
      },
      '11111111-1111-1111-1111-111111111111',
    )
    expect(validateRecordCoherence(record).ok).toBe(false)
  })

  it('rejects a user-added record without manifestUrl', () => {
    const record = composeLocalSourceRecord(
      { ...baseInput, manifestUrl: undefined },
      '11111111-1111-1111-1111-111111111111',
    )
    expect(validateRecordCoherence(record).ok).toBe(false)
  })
})

describe('CatalogSourceStore mock', () => {
  it('add generates a unique UUID and forces enabled=false', () => {
    const store = createMockStore()
    const { sourceRecordId, record } = store.add(baseInput)
    expect(sourceRecordId).toMatch(/^[0-9a-f-]{36}$/u)
    expect(record.enabled).toBe(false)
    expect(record.sourceRecordId).toBe(sourceRecordId)
  })

  it('list returns records in ascending order assigned by the store', () => {
    const store = createMockStore()
    store.add({ ...baseInput, manifestUrl: 'https://a.example/catalog.json' })
    store.add({ ...baseInput, manifestUrl: 'https://b.example/catalog.json' })
    store.add({ ...baseInput, manifestUrl: 'https://c.example/catalog.json' })
    const list = store.list()
    // Store assigns sequential orders on add; the contract requires list()
    // to return them in ascending order, which the mock honours via .sort().
    expect(list.map((r) => r.order)).toEqual([0, 1, 2])
    expect(list.map((r) => r.manifestUrl)).toEqual([
      'https://a.example/catalog.json',
      'https://b.example/catalog.json',
      'https://c.example/catalog.json',
    ])
  })

  it('update preserves sourceRecordId', () => {
    const store = createMockStore()
    const { sourceRecordId, record } = store.add(baseInput)
    const updated: LocalSourceRecord = { ...record, enabled: true, order: 7 }
    store.update(updated)
    expect(store.get(sourceRecordId)?.enabled).toBe(true)
    expect(store.get(sourceRecordId)?.order).toBe(7)
  })

  it('remove is a no-op for unknown ids and removes known ones', () => {
    const store = createMockStore()
    const { sourceRecordId } = store.add(baseInput)
    store.remove('00000000-0000-0000-0000-000000000000')
    expect(store.list().length).toBe(1)
    store.remove(sourceRecordId)
    expect(store.list().length).toBe(0)
  })
})