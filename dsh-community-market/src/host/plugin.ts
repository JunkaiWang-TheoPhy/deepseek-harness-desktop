/**
 * DSH Host plugin entry for the community market.
 *
 * Composition:
 * 1. Register the `dsh-community-market` settings namespace via schemastery
 * 2. Build a SettingsKvStorage adapter from the registered settings
 * 3. Wire the Phase 2 components: store, registry, cache, aggregator,
 *    two built-in adapters, restricted HTTP client
 * 4. Register Host routes under `/v1/market/`
 * 5. Expose the MarketHostHandle via `ctx.provide('marketHost', ...)` so
 *    future plugins (and the client) can reach it without going through
 *    the wire
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { RestrictedHttpClient } from './http-client.js'
import { PersistedCatalogSourceStore } from './store-impl.js'
import { SettingsKvStorage, type SettingsLike } from './settings-storage.js'
import { DefaultSourceRegistry } from './registry.js'
import { CatalogSnapshotCache } from './cache.js'
import { CatalogAggregator } from './aggregate.js'
import { StandardHttpJsonAdapter } from './adapters/standard.js'
import { Dsh1024StoreAdapter } from './adapters/dsh-1024store.js'
import {
  dshCommunityMarketSchema,
  DSH_COMMUNITY_MARKET_NAMESPACE,
} from './settings-schema.js'
import {
  buildBuiltInAdapters,
  buildMarketHandle,
  dispatchMarketRequest,
  MARKET_ROUTE_PREFIX,
  type MarketHostHandle,
} from './routes.js'

/** Stable Cordis plugin name. */
export const name = 'dsh-community-market'

/** Services required before the market Host entry can wire routes. */
export const inject = ['webServer', 'settings']

/** Settings service shape used by the bridge (minimal subset). */
interface SettingsServiceLike {
  register(
    namespace: string,
    schema: unknown,
    options?: { applies?: 'restart' | 'reload' },
  ): {
    get(): unknown
    update(value: unknown): void
    watch(callback: (next: unknown) => void): () => void
  }
  get<T>(namespace: string): T | undefined
  update<T>(namespace: string, value: T): void
}

/** Web server service shape (subset). */
interface WebServerServiceLike {
  host: string
  port: number
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): void
}

export interface Config {
  /** Path prefix for the market routes. Defaults to `/v1/market/`. */
  readonly routePrefix?: string
}

export const Config = {
  routePrefix: MARKET_ROUTE_PREFIX,
}

export function apply(ctx: Context, config: Config): void {
  const webServer = ctx.webServer as unknown as WebServerServiceLike | undefined
  const settings = ctx.settings as unknown as SettingsServiceLike | undefined
  if (webServer === undefined || settings === undefined) {
    throw new Error('dsh-community-market: launcher did not provide ctx.webServer / ctx.settings')
  }

  // 1. Register the settings namespace.
  settings.register(
    DSH_COMMUNITY_MARKET_NAMESPACE,
    dshCommunityMarketSchema,
    { applies: 'restart' },
  )

  // 2. Build storage + store + cache + registry + aggregator.
  const settingsLike: SettingsLike = {
    get: (ns) => settings.get(ns),
    update: (ns, value) => settings.update(ns, value),
  }
  const storage = new SettingsKvStorage(settingsLike)
  const store = new PersistedCatalogSourceStore(storage)
  const registry = new DefaultSourceRegistry()
  const cache = new CatalogSnapshotCache()
  const httpClient = new RestrictedHttpClient()
  const adapters = buildBuiltInAdapters(httpClient)
  registry.registerBuiltIn(adapters.standard)
  registry.registerBuiltIn(adapters.dsh1024Store)
  const aggregator = new CatalogAggregator(registry, cache)
  const handle = buildMarketHandle({ store, registry, cache, aggregator })

  // 3. Expose the handle via Cordis so the Client entry can consume it.
  ctx.effect(
    () => {
      const dispose = ctx.reflect.provide('marketHost', handle as unknown as MarketHostHandle)
      return () => { void dispose() }
    },
    'dsh-community-market: market host lifetime',
  )

  // 4. Register the routes under the configured prefix.
  const prefix = config.routePrefix ?? MARKET_ROUTE_PREFIX
  if (!prefix.endsWith('/')) {
    throw new Error(`dsh-community-market: route prefix must end with '/': ${prefix}`)
  }
  registerMarketRoutes(ctx, handle, prefix)
}

function registerMarketRoutes(
  ctx: Context,
  handle: MarketHostHandle,
  prefix: string,
): void {
  const webServer = ctx.webServer as unknown as WebServerServiceLike
  webServer.register({
    kind: 'exact',
    path: prefix.endsWith('/') ? `${prefix}*` : `${prefix}/*`,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      // Adapt the Node IncomingMessage to a Fetch Request so the rest of
      // the dispatch pipeline can use Web platform APIs.
      const url = buildUrlFromIncoming(req)
      const method = (req.method ?? 'GET').toUpperCase()
      let body: string | undefined
      if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
        body = await readBody(req)
      }
      const fetchRequest = new Request(url, { method, ...(body === undefined ? {} : { body }) })
      const response = await dispatchMarketRequest(handle, fetchRequest)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(await response.text())
    },
  })
}

function buildUrlFromIncoming(req: IncomingMessage): string {
  // webServer handlers receive only IncomingMessage; the URL host is
  // 127.0.0.1 with the listening port (read from ctx.webServer via the
  // bootstrap; the wrapper records it). For the dispatch logic we just
  // need the pathname + query string.
  const host = req.headers.host ?? '127.0.0.1'
  return `http://${host}${req.url ?? '/'}`
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}