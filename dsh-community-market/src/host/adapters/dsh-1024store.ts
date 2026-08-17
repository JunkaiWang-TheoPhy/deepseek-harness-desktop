/**
 * DSH 1024Store adapter.
 *
 * Per catalog-provider-contract §"DSH 1024Store adapter":
 * - adapter ships with Market and is reviewed alongside it
 * - may translate the partner provider's API fields, categories, pagination,
 *   search terms into the standard shape
 * - never treats a remote `install` field / command / prompt as executable
 *   input
 * - never invokes the provider's install events / accounts / telemetry
 * - does not relax network / schema / provenance / install rules because
 *   of the partnership
 * - badge comes from local adapter registration, not provider claim
 * - fails independently; never silently falls back to it
 *
 * Phase 2 ships a typed translation layer; the real wire shape is
 * discovered at integration time and pinned by a fixture. The adapter
 * here uses a documented partner response shape so tests can run offline.
 */

import type {
  CatalogAdapter,
  CatalogAdapterFetchContext,
} from '../../contracts/adapter.js'
import type {
  CatalogQuery,
  CatalogSnapshot,
  CatalogSnapshotItem,
  CatalogSnapshotSource,
} from '../../contracts/types.js'
import {
  validateCatalogSnapshot,
} from '../../contracts/schemas.js'
import { checkSnapshotProvenanceConsistency } from '../../contracts/semantic.js'
import type { RestrictedHttpClient } from '../http-client.js'

/** 1024Store partner response shape (translated locally, not raw). */
interface Dsh1024StoreResponse {
  readonly schemaVersion: '1.0.0'
  readonly generatedAt?: string
  readonly revision?: string
  readonly items: readonly Dsh1024StoreItem[]
  readonly page: {
    readonly nextCursor?: string
    readonly total?: number
  }
}

interface Dsh1024StoreItem {
  readonly id: string
  readonly name: string
  readonly displayName: string
  readonly summary: string
  readonly description?: string
  readonly homepage?: string
  readonly latestVersion?: string
  readonly license?: string
  readonly categories?: readonly string[]
  readonly keywords?: readonly string[]
  readonly repository?: { readonly url: string; readonly subdirectory?: string }
  readonly npm?: { readonly name: string }
  readonly publisher?: { readonly name: string; readonly url?: string }
}

/** Lightweight shape check; the runtime still calls validateCatalogSnapshot after injection. */
function isDsh1024StoreResponse(value: unknown): value is Dsh1024StoreResponse {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.items) && typeof obj.page === 'object' && obj.page !== null
}

/** Translate the partner response's `q/category/limit/locale` into the partner's own params. */
function build1024StoreQuery(query: CatalogQuery, supported: readonly ('q' | 'category' | 'limit' | 'locale')[]): URLSearchParams {
  const params = new URLSearchParams()
  const supportedSet = new Set(supported)
  if (supportedSet.has('q') && query.q !== undefined) params.set('search', query.q)
  if (supportedSet.has('category') && query.category !== undefined) {
    for (const c of query.category) params.append('category', c)
  }
  if (supportedSet.has('limit') && query.limit !== undefined) params.set('limit', String(query.limit))
  if (supportedSet.has('locale') && query.locale !== undefined) params.set('locale', query.locale)
  return params
}

const PROVIDER_ID = 'org.dsh.1024store'
const ENDPOINT = 'https://deepseek1024.com/api/v1/registry'

export class Dsh1024StoreAdapter implements CatalogAdapter {
  readonly adapterId = 'market.dsh-1024store-v1'

  constructor(
    private readonly httpClient: RestrictedHttpClient,
    private readonly endpoint = ENDPOINT,
    private readonly providerId = PROVIDER_ID,
  ) {}

  async fetch(
    query: CatalogQuery,
    context: CatalogAdapterFetchContext,
  ): Promise<CatalogSnapshot> {
    const params = build1024StoreQuery(query, ['q', 'category', 'limit', 'locale'])
    const response = await this.httpClient.fetchJson<Dsh1024StoreResponse>(
      this.endpoint,
      isDsh1024StoreResponse,
      { signal: context.signal, query: params },
    )

    const source: CatalogSnapshotSource = {
      sourceRecordId: context.sourceRecordId,
      providerId: this.providerId,
      adapterId: this.adapterId,
      registrationKind: 'built-in',
      fetchedAt: new Date().toISOString(),
      finalUrl: this.endpoint,
    }

    const items: CatalogSnapshotItem[] = response.items.map((item) => ({
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      summary: item.summary,
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.homepage !== undefined ? { homepage: item.homepage } : {}),
      ...(item.latestVersion !== undefined ? { latestVersion: item.latestVersion } : {}),
      ...(item.license !== undefined ? { license: item.license } : {}),
      ...(item.categories !== undefined ? { categories: item.categories } : {}),
      ...(item.keywords !== undefined ? { keywords: item.keywords } : {}),
      ...(item.repository !== undefined ? { repository: item.repository } : {}),
      ...(item.npm !== undefined ? { package: { registry: 'npm' as const, name: item.npm.name } } : {}),
      ...(item.publisher !== undefined ? { publisher: item.publisher } : {}),
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
      page: response.page,
    }

    if (!validateCatalogSnapshot(snapshot)) {
      throw new Error('1024Store adapter: normalized snapshot failed schema validation')
    }
    const consistency = checkSnapshotProvenanceConsistency(snapshot)
    if (!consistency.ok) {
      throw new Error(
        `1024Store adapter: provenance mismatch (${consistency.reason}): ${consistency.detail ?? ''}`,
      )
    }

    return snapshot
  }
}