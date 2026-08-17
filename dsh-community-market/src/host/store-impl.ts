/**
 * Persistent implementation of the `CatalogSourceStore` interface.
 *
 * Uses an injected `KvStorage` for storage. The Host generates a
 * `sourceRecordId` per record on `add`; records never come from a remote
 * manifest. The `enabled` and `order` fields live here only — they are
 * not part of any provider response.
 */

import type {
  AddSourceResult,
  CatalogSourceStore,
  LocalSourceRecordInput,
} from '../contracts/source-store.js'
import {
  composeLocalSourceRecord,
  defaultSourceRecordIdFactory,
  validateAddInput,
  validateRecordCoherence,
} from '../contracts/source-store.js'
import type {
  LocalSourceRecord,
  SourceRecordId,
} from '../contracts/types.js'
import type { KvStorage } from './kv-storage.js'

const KEY_PREFIX = 'dsh-community-market/source/'

function keyOf(id: SourceRecordId): string {
  return `${KEY_PREFIX}${id}`
}

export class PersistedCatalogSourceStore implements CatalogSourceStore {
  private readonly idFactory: () => SourceRecordId

  constructor(
    private readonly storage: KvStorage,
    idFactory?: () => SourceRecordId,
  ) {
    this.idFactory = idFactory ?? defaultSourceRecordIdFactory
  }

  get(id: SourceRecordId): LocalSourceRecord | undefined {
    return this.storage.get<LocalSourceRecord>(keyOf(id))
  }

  list(): readonly LocalSourceRecord[] {
    const records: LocalSourceRecord[] = []
    for (const key of this.storage.keys()) {
      if (!key.startsWith(KEY_PREFIX)) continue
      const record = this.storage.get<LocalSourceRecord>(key)
      if (record !== undefined) records.push(record)
    }
    return records.sort((a, b) => a.order - b.order)
  }

  add(input: LocalSourceRecordInput): AddSourceResult {
    const check = validateAddInput(input)
    if (!check.ok) {
      throw new Error(`invalid source record input: ${check.reason ?? 'unknown'}`)
    }
    const sourceRecordId = this.idFactory()
    const record = composeLocalSourceRecord(input, sourceRecordId)
    this.storage.set(keyOf(sourceRecordId), record)
    return { sourceRecordId, record }
  }

  update(record: LocalSourceRecord): void {
    const check = validateRecordCoherence(record)
    if (!check.ok) {
      throw new Error(`invalid record: ${check.reason ?? 'unknown'}`)
    }
    this.storage.set(keyOf(record.sourceRecordId), record)
  }

  remove(id: SourceRecordId): void {
    this.storage.delete(keyOf(id))
  }
}