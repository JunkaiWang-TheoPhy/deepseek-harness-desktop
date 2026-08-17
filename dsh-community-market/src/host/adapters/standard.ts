/**
 * Standard https-json adapter.
 *
 * Implements the standard GET /v1/plugins contract from
 * catalog-provider-contract §"标准 HTTP 来源":
 * - Constructs the URL via `applyQueryToUrl` (URL API + URLSearchParams)
 * - Calls the injected RestrictedHttpClient to fetch the response
 * - Validates the page with validateCatalogProviderPage (ajv)
 * - Checks item-id uniqueness (semantic check, JSON Schema cannot express)
 * - Injects Host provenance (sourceRecordId, adapterId, fetchedAt, finalUrl)
 * - Re-validates with validateCatalogSnapshot
 * - Re-checks provenance consistency
 *
 * The adapter never executes the response's install field, never reads
 * command strings, never trusts the provider's timestamp. Only the
 * `source.adapterId` (this constant) and the Host-observed fetch metadata
 * become part of the snapshot.
 */

import type {
  CatalogAdapter,
  CatalogAdapterFetchContext,
} from '../../contracts/adapter.js'
import type {
  CatalogProviderPage,
  CatalogProviderPageItem,
  CatalogQuery,
  CatalogSnapshot,
  CatalogSnapshotItem,
  CatalogSnapshotSource,
} from '../../contracts/types.js'
import {
  validateCatalogProviderPage,
  validateCatalogSnapshot,
} from '../../contracts/schemas.js'
import {
  checkProviderPageItemIdUniqueness,
  checkSnapshotProvenanceConsistency,
} from '../../contracts/semantic.js'
import { serializeCatalogQuery } from '../../catalog/query.js'
import type { RestrictedHttpClient } from '../http-client.js'

export class StandardHttpJsonAdapter implements CatalogAdapter {
  readonly adapterId = 'market.standard-v1'

  constructor(private readonly httpClient: RestrictedHttpClient) {}

  async fetch(
    query: CatalogQuery,
    context: CatalogAdapterFetchContext,
  ): Promise<CatalogSnapshot> {
    const params = serializeCatalogQuery(query, context.manifest.query.supported)
    const page = await this.httpClient.fetchJson<CatalogProviderPage>(
      context.manifest.transport.endpoint,
      validateCatalogProviderPage,
      { signal: context.signal, query: params },
    )

    const uniqueness = checkProviderPageItemIdUniqueness(page)
    if (!uniqueness.ok) {
      throw new Error(
        `standard adapter: provider page rejected (${uniqueness.reason}): ${uniqueness.detail ?? ''}`,
      )
    }

    const source: CatalogSnapshotSource = {
      sourceRecordId: context.sourceRecordId,
      providerId: context.manifest.providerId,
      adapterId: this.adapterId,
      // The standard adapter serves both user-added and built-in registrations.
      // The actual registrationKind lives on the LocalSourceRecord; the
      // snapshot reflects the adapter's registration kind, which the
      // aggregator fills in before returning the snapshot.
      registrationKind: 'user-added',
      fetchedAt: new Date().toISOString(),
      finalUrl: context.manifest.transport.endpoint,
    }

    const items: CatalogSnapshotItem[] = page.items.map((item: CatalogProviderPageItem) => ({
      ...item,
      provenance: {
        sourceRecordId: context.sourceRecordId,
        providerId: source.providerId,
        itemId: item.id,
      },
    }))

    const snapshot: CatalogSnapshot = {
      schemaVersion: '1.0.0',
      source,
      items,
      page: page.page,
    }

    if (!validateCatalogSnapshot(snapshot)) {
      throw new Error('standard adapter: normalized snapshot failed schema validation')
    }
    const consistency = checkSnapshotProvenanceConsistency(snapshot)
    if (!consistency.ok) {
      throw new Error(
        `standard adapter: provenance mismatch (${consistency.reason}): ${consistency.detail ?? ''}`,
      )
    }

    return snapshot
  }
}