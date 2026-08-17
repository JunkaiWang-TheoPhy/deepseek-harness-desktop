/**
 * Phase 2 M2.2 CatalogSourceStore persistence tests.
 *
 * Uses `MemoryKvStorage` so the tests stay headless; Phase 3 wires the
 * real `ctx.settings` adapter.
 */
import { describe, expect, it } from 'vitest'
import { PersistedCatalogSourceStore } from '../../src/host/store-impl.js'
import { MemoryKvStorage } from '../../src/host/kv-storage.js'
import type { LocalSourceRecordInput } from '../../src/contracts/source-store.js'

function makeStore(): { storage: MemoryKvStorage; store: PersistedCatalogSourceStore } {
  const storage = new MemoryKvStorage()
  const store = new PersistedCatalogSourceStore(storage)
  return { storage, store }
}

const baseInput: LocalSourceRecordInput = {
  registrationKind: 'user-added',
  adapterId: 'market.standard-v1',
  providerId: 'org.example.community-catalog',
  manifestUrl: 'https://example.org/catalog.json',
  enabled: false,
  order: 0,
}

describe('PersistedCatalogSourceStore', () => {
  it('persists a record via the underlying storage', () => {
    const { storage, store } = makeStore()
    const { sourceRecordId } = store.add(baseInput)
    expect(storage.keys().some((k) => k.includes(sourceRecordId))).toBe(true)
    expect(store.get(sourceRecordId)?.providerId).toBe('org.example.community-catalog')
  })

  it('list returns records sorted by order ascending', () => {
    const { store } = makeStore()
    store.add({ ...baseInput, manifestUrl: 'https://a.example/catalog.json' })
    store.add({ ...baseInput, manifestUrl: 'https://b.example/catalog.json' })
    store.add({ ...baseInput, manifestUrl: 'https://c.example/catalog.json' })
    const list = store.list()
    expect(list.map((r) => r.manifestUrl)).toEqual([
      'https://a.example/catalog.json',
      'https://b.example/catalog.json',
      'https://c.example/catalog.json',
    ])
  })

  it('round-trips a record through a fresh storage instance', () => {
    // Simulates a process restart: serialize state from storage 1 into
    // storage 2 and confirm PersistedCatalogSourceStore reads it back.
    const { storage: s1, store: st1 } = makeStore()
    const { sourceRecordId, record } = st1.add(baseInput)
    st1.update({ ...record, enabled: true })

    const snapshot = JSON.parse(JSON.stringify([...s1.keys()].map((k) => [k, s1.get(k)])))
    const s2 = new MemoryKvStorage()
    for (const [k, v] of snapshot) s2.set(k, v)

    const st2 = new PersistedCatalogSourceStore(s2)
    const restored = st2.get(sourceRecordId)
    expect(restored?.enabled).toBe(true)
  })

  it('rejects an invalid input on add with a typed error', () => {
    const { store } = makeStore()
    expect(() =>
      store.add({ ...baseInput, enabled: true }),
    ).toThrow(/invalid source record input/)
  })

  it('removes a record from storage', () => {
    const { storage, store } = makeStore()
    const { sourceRecordId } = store.add(baseInput)
    store.remove(sourceRecordId)
    expect(store.get(sourceRecordId)).toBeUndefined()
    expect(storage.keys().some((k) => k.includes(sourceRecordId))).toBe(false)
  })

  it('update preserves sourceRecordId and rejects incoherent records', () => {
    const { store } = makeStore()
    const { sourceRecordId, record } = store.add(baseInput)
    store.update({ ...record, enabled: true, order: 5 })
    expect(store.get(sourceRecordId)?.order).toBe(5)
    expect(() =>
      store.update({ ...record, registrationKind: 'user-added', manifestUrl: undefined }),
    ).toThrow(/invalid record/)
  })
})