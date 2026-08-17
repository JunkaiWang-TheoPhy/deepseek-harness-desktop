/**
 * Host routes exposing catalog browse + source management.
 *
 * Per catalog-provider-contract §3 / §11.2 / §11.4:
 * - Read paths: GET /v1/market/sources, GET /v1/market/catalog
 * - Source management: POST /v1/market/sources, DELETE /v1/market/sources/:id,
 *   POST /v1/market/sources/:id/enable, POST /v1/market/sources/:id/disable
 * - Errors return bounded reason codes; never raw body / path / token / env
 */

import type { Context } from '@deepseek-ai/cordis'
import { RestrictedHttpClient } from './http-client.js'
import type { CatalogSourceStore } from '../contracts/source-store.js'
import { validateAddInput } from '../contracts/source-store.js'
import type { SourceRegistry } from './registry.js'
import type { CatalogSnapshotCache } from './cache.js'
import type { CatalogAggregator } from './aggregate.js'
import type { CatalogSnapshot } from '../contracts/types.js'
import type { LocalSourceRecordInput } from '../contracts/source-store.js'
import type { SourceInput } from './aggregate.js'
import { serializeCatalogQuery } from '../catalog/query.js'
import type { CatalogQuery, LocalSourceRecord, CatalogSourceManifest } from '../contracts/types.js'
import { StandardHttpJsonAdapter } from './adapters/standard.js'
import { Dsh1024StoreAdapter } from './adapters/dsh-1024store.js'
import { RestrictedHttpError } from './http-errors.js'

/** A read-only handle on the host's market services. */
export interface MarketHostHandle {
  readonly store: CatalogSourceStore
  readonly registry: SourceRegistry
  readonly cache: CatalogSnapshotCache
  readonly aggregator: CatalogAggregator
  /** Manifests keyed by sourceRecordId; populated lazily by the bootstrap. */
  readonly manifests: Map<string, CatalogSourceManifest>
}

export const MARKET_ROUTE_PREFIX = '/v1/market/'

/** Build a `MarketHostHandle` from injected dependencies. */
export function buildMarketHandle(deps: {
  store: CatalogSourceStore
  registry: SourceRegistry
  cache: CatalogSnapshotCache
  aggregator: CatalogAggregator
  manifests?: Map<string, CatalogSourceManifest>
}): MarketHostHandle {
  return {
    store: deps.store,
    registry: deps.registry,
    cache: deps.cache,
    aggregator: deps.aggregator,
    manifests: deps.manifests ?? new Map(),
  }
}

/** Build the standard set of built-in adapters against the given HTTP client. */
export function buildBuiltInAdapters(httpClient: RestrictedHttpClient): {
  standard: StandardHttpJsonAdapter
  dsh1024Store: Dsh1024StoreAdapter
} {
  return {
    standard: new StandardHttpJsonAdapter(httpClient),
    dsh1024Store: new Dsh1024StoreAdapter(httpClient),
  }
}

/** JSON error response with a bounded reason code. */
function jsonError(status: number, reason: string, detail?: string): Response {
  return new Response(JSON.stringify(detail === undefined ? { error: { reason } } : { error: { reason, detail } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Read the JSON body of a request. Returns undefined on empty / wrong type. */
async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return Symbol.for('invalid-json')
  }
}

/** Best-effort normalization of an unknown body to a `LocalSourceRecordInput`. */
function coerceRecordInput(body: unknown): LocalSourceRecordInput | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'body-not-object' }
  const obj = body as Record<string, unknown>
  if (typeof obj.registrationKind !== 'string' || (obj.registrationKind !== 'user-added' && obj.registrationKind !== 'built-in')) {
    return { error: 'registrationKind-invalid' }
  }
  if (typeof obj.adapterId !== 'string') return { error: 'adapterId-required' }
  if (typeof obj.providerId !== 'string') return { error: 'providerId-required' }
  const result: LocalSourceRecordInput = {
    registrationKind: obj.registrationKind,
    adapterId: obj.adapterId,
    providerId: obj.providerId,
    enabled: false,
    order: typeof obj.order === 'number' ? obj.order : 0,
  }
  if (typeof obj.manifestUrl === 'string') Object.assign(result, { manifestUrl: obj.manifestUrl })
  if (typeof obj.builtInProviderKey === 'string') Object.assign(result, { builtInProviderKey: obj.builtInProviderKey })
  return result
}

/** Match `/v1/market/<rest>` and return the `rest` segments. */
function splitPath(pathname: string): string[] {
  if (!pathname.startsWith(MARKET_ROUTE_PREFIX)) return []
  return pathname.slice(MARKET_ROUTE_PREFIX.length).split('/').filter(Boolean)
}

/**
 * Dispatch a `Request` against the market handle. Pure function so it can
 * be unit-tested without the DSH harness.
 */
export async function dispatchMarketRequest(
  handle: MarketHostHandle,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const segments = splitPath(url.pathname)

  if (segments.length === 0) {
    if (request.method === 'GET') return jsonOk({ status: 'ok', version: '0.1.0-dev.0' })
    return jsonError(405, 'method-not-allowed')
  }

  const [first, second] = segments
  if (first === 'sources') {
    if (segments.length === 1) return sourcesCollection(handle, request)
    if (second !== undefined) return sourcesItem(handle, request, second)
  }
  if (first === 'catalog' && segments.length === 1) {
    if (request.method === 'GET') return catalogBrowse(handle, request, url)
    return jsonError(405, 'method-not-allowed')
  }

  return jsonError(404, 'not-found')
}

async function sourcesCollection(handle: MarketHostHandle, request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return jsonOk({ sources: handle.store.list() })
  }
  if (request.method === 'POST') {
    const body = await readJsonBody(request)
    if (body === Symbol.for('invalid-json')) return jsonError(400, 'invalid-json')
    const input = coerceRecordInput(body)
    if ('error' in input) return jsonError(400, input.error)
    const check = validateAddInput(input)
    if (!check.ok) return jsonError(400, check.reason ?? 'invalid-input')
    try {
      const { sourceRecordId, record } = handle.store.add(input)
      return jsonOk({ sourceRecordId, record }, 201)
    } catch (cause) {
      return jsonError(500, 'add-failed', String(cause))
    }
  }
  return jsonError(405, 'method-not-allowed')
}

async function sourcesItem(
  handle: MarketHostHandle,
  request: Request,
  id: string,
): Promise<Response> {
  if (request.method === 'GET') {
    const record = handle.store.get(id)
    if (record === undefined) return jsonError(404, 'source-not-found')
    return jsonOk({ record })
  }
  if (request.method === 'DELETE') {
    handle.store.remove(id)
    return jsonOk({ removed: id })
  }
  if (request.method === 'POST') {
    let body = await readJsonBody(request)
    if (body === undefined) body = {}
    const action = (body as Record<string, unknown>).action
    const record = handle.store.get(id)
    if (record === undefined) return jsonError(404, 'source-not-found')
    if (action === 'enable') {
      handle.store.update({ ...record, enabled: true })
      return jsonOk({ record: handle.store.get(id) })
    }
    if (action === 'disable') {
      handle.store.update({ ...record, enabled: false })
      return jsonOk({ record: handle.store.get(id) })
    }
    if (action === 'order') {
      const order = (body as Record<string, unknown>).order
      if (typeof order !== 'number') return jsonError(400, 'order-not-number')
      handle.store.update({ ...record, order })
      return jsonOk({ record: handle.store.get(id) })
    }
    return jsonError(400, 'unknown-action')
  }
  return jsonError(405, 'method-not-allowed')
}

async function catalogBrowse(
  handle: MarketHostHandle,
  request: Request,
  url: URL,
): Promise<Response> {
  if (request.method !== 'GET') return jsonError(405, 'method-not-allowed')
  const params = url.searchParams
  const query: CatalogQuery = {}
  if (params.has('q')) query.q = params.get('q') ?? undefined
  if (params.has('category')) query.category = params.getAll('category')
  if (params.has('capability')) query.capability = params.getAll('capability')
  if (params.has('cursor')) query.cursor = params.get('cursor') ?? undefined
  if (params.has('limit')) {
    const n = Number(params.get('limit'))
    if (Number.isInteger(n) && n >= 1 && n <= 100) query.limit = n
  }
  if (params.has('sort')) {
    const s = params.get('sort') as CatalogQuery['sort']
    if (s === 'relevance' || s === 'updated' || s === 'name' || s === 'downloads') query.sort = s
  }
  if (params.has('locale')) query.locale = params.get('locale') ?? undefined

  const inputs: SourceInput[] = []
  for (const source of handle.store.list()) {
    if (!source.enabled) continue
    const manifest = handle.manifests.get(source.sourceRecordId)
    if (manifest === undefined) continue
    inputs.push({ source, manifest })
  }
  const result = await handle.aggregator.aggregate(query, inputs)
  const snapshots: CatalogSnapshot[] = []
  const errors: Array<{ sourceRecordId: string; reason: string; detail?: string }> = []
  for (const outcome of result.outcomes) {
    if (outcome.kind === 'ok') snapshots.push(outcome.snapshot)
    else errors.push({ sourceRecordId: outcome.input.source.sourceRecordId, reason: outcome.reason, detail: outcome.detail })
  }
  return jsonOk({ hadActive: result.hadActive, snapshots, errors })
}

/** Convenience that re-exports the HttpClient builder for tests. */
export function makeHttpClient(): RestrictedHttpClient {
  return new RestrictedHttpClient()
}

export { serializeCatalogQuery }