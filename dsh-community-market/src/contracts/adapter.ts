/**
 * Catalog adapter contract.
 *
 * Per catalog-provider-contract §"Adapter":
 * - adapter is the typed boundary between Host and a specific provider
 * - it must return a normalized CatalogSnapshot (not a raw provider page)
 * - it must inject Host provenance (sourceRecordId, adapterId, etc.) before
 *   returning
 * - it must never expose the FetchContext's internals to the provider
 *
 * Phase 1 only defines the interface. Implementations live in Phase 2.
 */

import type {
  AdapterId,
  CatalogQuery,
  CatalogSnapshot,
  CatalogSourceManifest,
  SourceRecordId,
} from './types.js'

/**
 * Context passed to an adapter on every request.
 *
 * The Host owns the actual HTTP client, DNS resolution, redirect handling,
 * timeout, and abort signal. Adapters must not establish their own network
 * connections — they pass `query` to the Host's machinery via this context
 * (Phase 2 will add the HTTP client).
 */
export interface CatalogAdapterFetchContext {
  /** Caller-controlled cancellation. Phase 1 keeps it minimal; Phase 2 adds timeouts. */
  readonly signal: AbortSignal
  /** Host-generated UUID identifying the local source registration. */
  readonly sourceRecordId: SourceRecordId
  /** Already-validated source manifest. */
  readonly manifest: CatalogSourceManifest
}

/**
 * A typed adapter that turns a normalized query into a normalized snapshot.
 *
 * - `adapterId` is the stable local identifier (e.g. 'market.standard-v1',
 *   'market.dsh-1024store-v1'); remote `providerId` is unrelated
 * - `fetch` returns a snapshot whose `source.adapterId` equals this id and
 *   whose `source.sourceRecordId` equals `context.sourceRecordId`
 * - `fetch` must validate the upstream response with `validateCatalogProviderPage`
 *   before normalization, then with `validateCatalogSnapshot` after Host
 *   provenance injection; both are required, in that order
 */
export interface CatalogAdapter {
  readonly adapterId: AdapterId
  fetch(
    query: CatalogQuery,
    context: CatalogAdapterFetchContext,
  ): Promise<CatalogSnapshot>
}