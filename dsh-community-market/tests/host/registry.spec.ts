/**
 * Phase 2 M2.3 source registry tests.
 */
import { describe, expect, it } from 'vitest'
import { DefaultSourceRegistry } from '../../src/host/registry.js'
import type { CatalogAdapter } from '../../src/contracts/adapter.js'
import type {
  CatalogSnapshot,
  LocalSourceRecord,
} from '../../src/contracts/types.js'

function makeAdapter(id: string): CatalogAdapter {
  return {
    adapterId: id,
    async fetch(): Promise<CatalogSnapshot> {
      return {
        schemaVersion: '1.0.0',
        source: {
          sourceRecordId: '00000000-0000-0000-0000-000000000000',
          providerId: 'mock',
          adapterId: id,
          registrationKind: 'built-in',
          fetchedAt: '2026-08-17T00:00:00Z',
          finalUrl: 'https://mock/v1/plugins',
        },
        items: [],
        page: {},
      }
    },
  }
}

function makeRecord(adapterId: string): LocalSourceRecord {
  return {
    sourceRecordId: '00000000-0000-0000-0000-000000000000',
    registrationKind: 'built-in',
    adapterId,
    providerId: 'org.mock',
    builtInProviderKey: 'mock',
    enabled: true,
    order: 0,
  }
}

describe('DefaultSourceRegistry', () => {
  it('registers and resolves built-in adapters by ID', () => {
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(makeAdapter('market.standard-v1'))
    expect(registry.resolveAdapter('market.standard-v1')?.adapterId).toBe('market.standard-v1')
    expect(registry.resolveAdapter('market.unknown-v1')).toBeUndefined()
  })

  it('lists adapter IDs in insertion order', () => {
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(makeAdapter('market.a'))
    registry.registerBuiltIn(makeAdapter('market.b'))
    registry.registerBuiltIn(makeAdapter('market.c'))
    expect(registry.listBuiltInIds()).toEqual(['market.a', 'market.b', 'market.c'])
  })

  it('replacing an adapter keeps insertion order stable', () => {
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(makeAdapter('market.a'))
    registry.registerBuiltIn(makeAdapter('market.b'))
    registry.registerBuiltIn(makeAdapter('market.a')) // replace
    expect(registry.listBuiltInIds()).toEqual(['market.a', 'market.b'])
  })

  it('bindSource returns the adapter matching the record\'s adapterId', () => {
    const registry = new DefaultSourceRegistry()
    registry.registerBuiltIn(makeAdapter('market.standard-v1'))
    expect(registry.bindSource(makeRecord('market.standard-v1'))?.adapterId).toBe('market.standard-v1')
    expect(registry.bindSource(makeRecord('market.unknown'))).toBeUndefined()
  })
})