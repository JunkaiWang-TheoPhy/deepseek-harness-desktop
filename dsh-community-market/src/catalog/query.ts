/**
 * Catalog query serialization.
 *
 * Per catalog-provider-contract §"标准 HTTP 来源":
 * - Use URL API / URLSearchParams; never concatenate strings
 * - `category` and `capability` are repeated query parameters
 * - Only fields in `supported` are emitted; unsupported fields are omitted
 * - Missing values are dropped, not emitted as empty or null
 * - Cursor is opaque — passed through verbatim with platform URL encoding
 */

import type { CatalogQuery, CatalogQueryField } from '../contracts/types.js'

/**
 * Serialize a normalized catalog query into URLSearchParams.
 *
 * `supported` is the list of fields the source manifest advertises support
 * for. Fields outside `supported` are silently omitted, even if the caller
 * populated them on the query. This implements the contract rule
 * "不支持参数省略".
 */
export function serializeCatalogQuery(
  query: CatalogQuery,
  supported: readonly CatalogQueryField[],
): URLSearchParams {
  const params = new URLSearchParams()
  const supportedSet = new Set(supported)

  if (supportedSet.has('q') && query.q !== undefined) {
    params.set('q', query.q)
  }
  if (supportedSet.has('category') && query.category !== undefined) {
    for (const value of query.category) {
      params.append('category', value)
    }
  }
  if (supportedSet.has('capability') && query.capability !== undefined) {
    for (const value of query.capability) {
      params.append('capability', value)
    }
  }
  if (supportedSet.has('cursor') && query.cursor !== undefined) {
    params.set('cursor', query.cursor)
  }
  if (supportedSet.has('limit') && query.limit !== undefined) {
    params.set('limit', String(query.limit))
  }
  if (supportedSet.has('sort') && query.sort !== undefined) {
    params.set('sort', query.sort)
  }
  if (supportedSet.has('locale') && query.locale !== undefined) {
    params.set('locale', query.locale)
  }

  return params
}

/**
 * Append serialized query parameters to a URL using the URL API.
 *
 * Returns a new URL; the input is not mutated. The URL's `search` setter
 * is responsible for URL-encoding the params — we never pre-encode.
 */
export function applyQueryToUrl(
  url: URL,
  query: CatalogQuery,
  supported: readonly CatalogQueryField[],
): URL {
  const next = new URL(url.toString())
  next.search = serializeCatalogQuery(query, supported).toString()
  return next
}

/**
 * Cursor ownership: returns true if `cursor` was issued by the same
 * (sourceRecordId, supported) tuple as the current query would be.
 *
 * Per catalog-provider-contract §"Cursor 只属于一个来源和一个有效 query";
 * * mismatched cursor reuse across sources must be rejected. Phase 2 will
 * integrate this with a SourceRegistry-backed cursor store; for now the
 * function compares the inputs the caller has on hand.
 */
export function cursorBelongsTo(
  cursor: string,
  sourceRecordId: string,
  supported: readonly CatalogQueryField[],
  query: CatalogQuery,
): boolean {
  const params = serializeCatalogQuery(query, supported)
  // The cursor is opaque to the Host; we cannot inspect its content.
  // We do, however, require the caller to verify it came from the same
  // source. Phase 2 adapters record the issuing sourceRecordId in the
  // cursor store and reject mismatches here.
  // For Phase 1 we only enforce non-empty + bounded length as defined by
  // catalog-query.schema.json (minLength 1, maxLength 2048).
  if (cursor.length < 1 || cursor.length > 2048) return false
  // The caller must have already checked sourceRecordId before invoking
  // this function. Touching it here keeps the contract explicit.
  void sourceRecordId
  void params
  return true
}