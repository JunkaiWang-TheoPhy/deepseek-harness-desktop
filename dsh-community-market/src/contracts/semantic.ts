/**
 * Semantic validation for catalog data.
 *
 * JSON Schema covers the structural rules in docs/schemas/. This module
 * covers checks the schemas cannot express — identity, provenance, and
 * relationships between independently-validated fields. See
 * catalog-provider-contract §"实现交接清单 / 语义校验".
 *
 * Conventions:
 * - Each checker returns a structured result, never throws on validation
 *   failures. Callers decide whether to surface the reason.
 * - Pure functions: no I/O, no clock, no environment. Easy to test.
 */

import type {
  CatalogProviderPage,
  CatalogProviderPageItem,
  CatalogQuery,
  CatalogSnapshot,
  CatalogSnapshotItem,
  CatalogSourceManifest,
} from './types.js'

/** Successful check. */
export interface SemanticOk {
  readonly ok: true
}

/** Failed check with a stable reason code and human-readable detail. */
export interface SemanticFailure {
  readonly ok: false
  readonly reason: string
  readonly detail?: string
}

export type SemanticResult = SemanticOk | SemanticFailure

const ok: SemanticOk = { ok: true }

const fail = (reason: string, detail?: string): SemanticFailure =>
  detail === undefined ? { ok: false, reason } : { ok: false, reason, detail }

/**
 * Provider page items must have unique `id` values within a single response.
 *
 * The wire schema does not enforce uniqueness — it only constrains shape.
 * Two items sharing an id would corrupt cache keys, cursor continuation,
 * and provenance. The Host must reject duplicates before caching.
 */
export function checkProviderPageItemIdUniqueness(
  page: CatalogProviderPage,
): SemanticResult {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const item of page.items) {
    if (seen.has(item.id)) {
      duplicates.push(item.id)
    } else {
      seen.add(item.id)
    }
  }
  if (duplicates.length === 0) return ok
  return fail(
    'duplicate-item-id',
    `provider page contains duplicate item id(s): ${duplicates.join(', ')}`,
  )
}

/**
 * Snapshot items must carry provenance whose `itemId` equals the item's `id`,
 * and whose `sourceRecordId` equals the Host-observed source's
 * `sourceRecordId`. Mismatches indicate either an adapter bug or a forgery
 * attempt; either way the snapshot must be rejected.
 */
export function checkSnapshotProvenanceConsistency(
  snapshot: CatalogSnapshot,
): SemanticResult {
  const hostSourceRecordId = snapshot.source.sourceRecordId
  const hostProviderId = snapshot.source.providerId
  const mismatches: string[] = []
  for (const item of snapshot.items) {
    if (item.provenance.sourceRecordId !== hostSourceRecordId) {
      mismatches.push(
        `${item.id}: provenance.sourceRecordId ${item.provenance.sourceRecordId} !== host ${hostSourceRecordId}`,
      )
    }
    if (item.provenance.providerId !== hostProviderId) {
      mismatches.push(
        `${item.id}: provenance.providerId ${item.provenance.providerId} !== host ${hostProviderId}`,
      )
    }
    if (item.provenance.itemId !== item.id) {
      mismatches.push(
        `${item.id}: provenance.itemId ${item.provenance.itemId} !== item.id`,
      )
    }
  }
  if (mismatches.length === 0) return ok
  return fail('provenance-mismatch', mismatches.join('; '))
}

/**
 * The query `limit` must be a positive integer not exceeding the source
 * manifest's `maxLimit`. Manifest invariants (`defaultLimit <= maxLimit`,
 * `maxLimit <= 100`) are also re-checked here so callers don't have to
 * trust the manifest as already-validated.
 */
export function checkQueryAgainstManifest(
  query: CatalogQuery,
  manifest: CatalogSourceManifest,
): SemanticResult {
  if (manifest.query.defaultLimit > manifest.query.maxLimit) {
    return fail(
      'manifest-limit-inconsistent',
      `manifest defaultLimit (${String(manifest.query.defaultLimit)}) exceeds maxLimit (${String(manifest.query.maxLimit)})`,
    )
  }
  if (manifest.query.maxLimit > 100) {
    return fail(
      'manifest-maxLimit-too-large',
      `manifest maxLimit (${String(manifest.query.maxLimit)}) exceeds 100`,
    )
  }
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < 1) {
      return fail(
        'query-limit-invalid',
        `query limit must be a positive integer; got ${String(query.limit)}`,
      )
    }
    if (query.limit > manifest.query.maxLimit) {
      return fail(
        'query-limit-exceeds-max',
        `query limit ${String(query.limit)} exceeds manifest maxLimit ${String(manifest.query.maxLimit)}`,
      )
    }
  }
  if (query.sort !== undefined && !manifest.query.sorts.includes(query.sort)) {
    return fail(
      'query-sort-unsupported',
      `query sort ${query.sort} is not in manifest-supported sorts ${JSON.stringify(manifest.query.sorts)}`,
    )
  }
  return ok
}

/**
 * The Host must reject installs that try to silently prefer npm over
 * repository when an item declares both. Returning `true` means "both
 * identities are present; the user must explicitly choose".
 *
 * Single-identity items return `false` (silent install proceeds after the
 * remaining Phase 4 derivation tests).
 */
export function declaresBothNpmAndRepository(
  item: CatalogProviderPageItem | CatalogSnapshotItem,
): boolean {
  return item.package !== undefined && item.repository !== undefined
}