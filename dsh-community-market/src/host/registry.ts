/**
 * Source registry — maps adapter IDs to `CatalogAdapter` instances.
 *
 * Built-in adapters (standard https-json, 1024Store) are registered at
 * Host startup. User-added sources reference an `adapterId`; the registry
 * resolves the adapter by that ID.
 *
 * Per catalog-provider-contract: a user-added source is always typed
 * `user-added`; a built-in source is typed `built-in`. The registry
 * doesn't care about source records — it only owns the adapter → impl map.
 */

import type { CatalogAdapter } from '../contracts/adapter.js'
import type { AdapterId, LocalSourceRecord } from '../contracts/types.js'

export interface SourceRegistry {
  /** Register a built-in adapter. Replaces if `adapterId` already registered. */
  registerBuiltIn(adapter: CatalogAdapter): void
  /** Look up an adapter by ID. Returns undefined if no adapter is registered. */
  resolveAdapter(adapterId: AdapterId): CatalogAdapter | undefined
  /** List the registered adapter IDs in insertion order. */
  listBuiltInIds(): readonly AdapterId[]
  /** Resolve the adapter that should serve `source`. */
  bindSource(source: LocalSourceRecord): CatalogAdapter | undefined
}

export class DefaultSourceRegistry implements SourceRegistry {
  private readonly adapters = new Map<AdapterId, CatalogAdapter>()
  private readonly order: AdapterId[] = []

  registerBuiltIn(adapter: CatalogAdapter): void {
    if (!this.adapters.has(adapter.adapterId)) {
      this.order.push(adapter.adapterId)
    }
    this.adapters.set(adapter.adapterId, adapter)
  }

  resolveAdapter(adapterId: AdapterId): CatalogAdapter | undefined {
    return this.adapters.get(adapterId)
  }

  listBuiltInIds(): readonly AdapterId[] {
    return [...this.order]
  }

  bindSource(source: LocalSourceRecord): CatalogAdapter | undefined {
    return this.resolveAdapter(source.adapterId)
  }
}