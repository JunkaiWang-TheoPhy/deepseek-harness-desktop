/**
 * Phase 3 M3.3 settings storage bridge tests.
 */
import { describe, expect, it } from 'vitest'
import { SettingsKvStorage } from '../../src/host/settings-storage.js'
import { DSH_COMMUNITY_MARKET_NAMESPACE } from '../../src/host/settings-schema.js'
import type { LocalSourceRecord } from '../../src/contracts/types.js'

function makeSettingsService(initial?: { sources: LocalSourceRecord[] }) {
  const store = new Map<string, unknown>()
  if (initial !== undefined) store.set(DSH_COMMUNITY_MARKET_NAMESPACE, initial)
  return {
    storage: store,
    get: <T>(ns: string): T | undefined => store.get(ns) as T | undefined,
    update: <T>(ns: string, value: T): void => { store.set(ns, value) },
  }
}

describe('SettingsKvStorage', () => {
  it('returns undefined for unknown keys when no value is set', () => {
    const { get, update } = makeSettingsService()
    const storage = new SettingsKvStorage({ get, update })
    expect(storage.get('dsh-community-market/source/abc')).toBeUndefined()
  })

  it('persists a value under the deterministic key', () => {
    const { get, update } = makeSettingsService()
    const storage = new SettingsKvStorage({ get, update })
    const record: LocalSourceRecord = {
      sourceRecordId: 'src-1',
      registrationKind: 'user-added',
      adapterId: 'market.standard-v1',
      providerId: 'org.example',
      manifestUrl: 'https://example.org/catalog.json',
      enabled: false,
      order: 0,
    }
    storage.set('dsh-community-market/source/src-1', record)
    expect(storage.get('dsh-community-market/source/src-1')).toEqual(record)
  })

  it('lists only keys that exist', () => {
    const { get, update } = makeSettingsService({
      sources: [{
        sourceRecordId: 'src-1',
        registrationKind: 'user-added',
        adapterId: 'market.standard-v1',
        providerId: 'org.example',
        manifestUrl: 'https://example.org/catalog.json',
        enabled: false,
        order: 0,
      }],
    })
    const storage = new SettingsKvStorage({ get, update })
    expect(storage.keys()).toEqual(['dsh-community-market/source/src-1'])
  })

  it('delete removes a key', () => {
    const { get, update } = makeSettingsService()
    const storage = new SettingsKvStorage({ get, update })
    storage.set('dsh-community-market/source/src-1', { sourceRecordId: 'src-1' })
    storage.delete('dsh-community-market/source/src-1')
    expect(storage.get('dsh-community-market/source/src-1')).toBeUndefined()
    expect(storage.keys()).toEqual([])
  })

  it('round-trips a record through a fresh storage instance', () => {
    const s1 = makeSettingsService()
    const storage1 = new SettingsKvStorage(s1)
    storage1.set('dsh-community-market/source/src-1', { sourceRecordId: 'src-1' })

    const snapshot = JSON.parse(JSON.stringify([...s1.storage.entries()]))
    const s2Map = new Map<string, unknown>(snapshot)
    const s2 = {
      storage: s2Map,
      get: <T>(ns: string): T | undefined => s2Map.get(ns) as T | undefined,
      update: <T>(ns: string, value: T): void => { s2Map.set(ns, value) },
    }
    const storage2 = new SettingsKvStorage(s2)
    expect(storage2.get('dsh-community-market/source/src-1')).toEqual({ sourceRecordId: 'src-1' })
  })
})