/**
 * Minimal key-value storage interface used by the persisted source store.
 *
 * Phase 2 ships an in-memory implementation for tests. Phase 3 wires this
 * to `ctx.settings` (the DSH settings service), exposing the
 * `dsh-community-market` namespace as a list of `LocalSourceRecord` values.
 *
 * The interface deliberately avoids callbacks / observers; the settings
 * service handles change notification.
 */

export interface KvStorage {
  /** Read the value for a key, or undefined if the key is not set. */
  get<T = unknown>(key: string): T | undefined
  /** Write the value. Overwrites any existing entry. */
  set<T = unknown>(key: string, value: T): void
  /** Delete the key. No-op if the key is not set. */
  delete(key: string): void
  /** List all keys in arbitrary order. */
  keys(): readonly string[]
}

/** In-memory `KvStorage` for tests. Not persisted across reloads. */
export class MemoryKvStorage implements KvStorage {
  private readonly store = new Map<string, unknown>()

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  keys(): readonly string[] {
    return [...this.store.keys()]
  }
}