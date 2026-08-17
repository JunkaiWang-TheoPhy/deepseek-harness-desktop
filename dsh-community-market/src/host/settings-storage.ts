/**
 * Settings-backed `KvStorage` adapter.
 *
 * Maps the generic `KvStorage` interface (used by `PersistedCatalogSourceStore`)
 * onto a single settings namespace, where every `LocalSourceRecord` is stored
 * under its deterministic key `dsh-community-market/source/<sourceRecordId>`.
 *
 * The actual settings service is consumed through a small interface so the
 * adapter is testable without the DSH harness.
 */

import type { LocalSourceRecord } from '../contracts/types.js'
import type { KvStorage } from './kv-storage.js'
import { DSH_COMMUNITY_MARKET_NAMESPACE } from './settings-schema.js'
import type { DshCommunityMarketSettingsValue } from './settings-schema.js'

const KEY_PREFIX = 'dsh-community-market/source/'

function keyOf(id: string): string {
  return `${KEY_PREFIX}${id}`
}

/**
 * Minimal contract the adapter needs from the DSH settings service.
 *
 * `get` / `update` operate on the namespace as a whole; the adapter is
 * responsible for splitting / merging the per-record entries.
 */
export interface SettingsLike {
  get<T>(namespace: string): T | undefined
  update<T>(namespace: string, value: T): void
}

interface StoredState {
  sources: LocalSourceRecord[]
}

/**
 * Adapter that stores each `LocalSourceRecord` under its deterministic key
 * inside a single settings namespace.
 *
 * On read, the adapter reconstructs the namespace value from the per-record
 * keys. On write, it merges into the namespace. The adapter intentionally
 * does not own the namespace lifecycle — the host plugin owns the
 * `register` call.
 */
export class SettingsKvStorage implements KvStorage {
  constructor(private readonly settings: SettingsLike) {}

  private readAll(): Record<string, LocalSourceRecord> {
    const value = this.settings.get<DshCommunityMarketSettingsValue | StoredState>(DSH_COMMUNITY_MARKET_NAMESPACE)
    if (value === undefined) return {}
    const sources = (value as DshCommunityMarketSettingsValue).sources ?? (value as StoredState).sources ?? []
    const out: Record<string, LocalSourceRecord> = {}
    for (const record of sources) {
      out[keyOf(record.sourceRecordId)] = record
    }
    return out
  }

  private writeAll(records: Record<string, LocalSourceRecord>): void {
    const sources = Object.values(records)
    const next: DshCommunityMarketSettingsValue = { sources }
    this.settings.update<DshCommunityMarketSettingsValue>(DSH_COMMUNITY_MARKET_NAMESPACE, next)
  }

  get<T>(key: string): T | undefined {
    const all = this.readAll()
    return all[key] as T | undefined
  }

  set<T>(key: string, value: T): void {
    const all = this.readAll()
    all[key] = value as LocalSourceRecord
    this.writeAll(all)
  }

  delete(key: string): void {
    const all = this.readAll()
    if (key in all) {
      delete all[key]
      this.writeAll(all)
    }
  }

  keys(): readonly string[] {
    return Object.keys(this.readAll())
  }
}