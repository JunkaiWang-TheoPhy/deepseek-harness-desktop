/**
 * DSH Host plugin entry for the community market.
 *
 * Composition:
 * 1. Register the `dsh-community-market` settings namespace via schemastery
 * 2. Build a SettingsKvStorage adapter from the registered settings
 * 3. Wire the Phase 2 components: store, registry, cache, aggregator,
 *    two built-in adapters, restricted HTTP client
 * 4. Register Host routes under `/v1/market/`
 * 5. Detect Desktop services (`desktopProfiles`, `desktopPnpm`,
 *    generation) and register install routes when present (Phase 5)
 * 6. Expose the MarketHostHandle via `ctx.provide('marketHost', ...)`
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
import {
  handleInstallPreview,
  handleInstallConfirm,
  missingCapability,
  type DesktopPnpmLike,
} from './install/routes.js'
import { staticGeneration, type DesktopProfilesLike, type GenerationReader } from './install/profile.js'

/** Stable Cordis plugin name. */
export const name = 'dsh-community-market'

/**
 * Services required before the market Host entry can wire routes. The
 * Desktop services (`desktopProfiles`, `desktopPnpm`) are optional —
 * Phase 1-3 routes work without them, install routes only register
 * when both are present.
 */
export const inject = ['webServer', 'settings', 'desktopProfiles?', 'desktopPnpm?']

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

/**
 * Per-process generation id. Phase 6 uses a single static value; when
 * the runtime rotation signal becomes available (Phase 6 follow-up),
 * swap in a `desktopGeneration` Cordis reader.
 */
const phase6Generation = staticGeneration('gen-phase6')

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

  // 5. Optionally register install routes when Desktop services are present.
  // Cast through `unknown` because the optional inject list
  // (`desktopProfiles?`, `desktopPnpm?`) isn't part of the upstream
  // Cordis Context type declaration.
  const desktopCtx = ctx as unknown as {
    desktopProfiles?: DesktopProfilesLike
    desktopPnpm?: DesktopPnpmLike
  }
  registerInstallRoutes(ctx, webServer, {
    profiles: desktopCtx.desktopProfiles,
    pnpm: desktopCtx.desktopPnpm,
    generation: phase6Generation,
  }, prefix)
  registerMarketRoutes(ctx, handle, prefix)
}

/**
 * Wire install routes when both `desktopProfiles` and `desktopPnpm` are
 * available. If either is missing, the install endpoints still register
 * but return 503 with a bounded reason. This honours the contract: "the
 * install path is unavailable, do not fall back to ambient CLI".
 */
function registerInstallRoutes(
  ctx: Context,
  webServer: WebServerServiceLike,
  services: {
    profiles: DesktopProfilesLike | undefined
    pnpm: DesktopPnpmLike | undefined
    generation: GenerationReader
  },
  prefix: string,
): void {
  const installPath = `${prefix.endsWith('/') ? prefix : `${prefix}/`}install`
  const capability = missingCapability({
    profiles: services.profiles,
    pnpm: services.pnpm,
    generation: services.generation,
  })
  const servicesReady = capability === null

  // Real handler signature (per dsh-plugin-desktop's webserver contract):
  // (IncomingMessage, ServerResponse) => void. We delegate to a
  // Fetch-Request-based inner handler so tests can drive the same
  // logic directly with a `Request`.
  webServer.register({
    kind: 'exact',
    path: installPath,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const fetchRequest = await anyToFetchRequest(req, installPath)
      const response = await handleInstallFetchRequest(
        servicesReady,
        capability,
        services as { profiles: DesktopProfilesLike; pnpm: DesktopPnpmLike; generation: GenerationReader },
        fetchRequest,
        prefix,
      )
      await writeFetchResponseToNodeResponse(res, response)
    },
  })

  webServer.register({
    kind: 'exact',
    path: `${installPath}/*`,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const fetchRequest = await anyToFetchRequest(req, installPath)
      const response = await handleInstallFetchRequest(
        servicesReady,
        capability,
        services as { profiles: DesktopProfilesLike; pnpm: DesktopPnpmLike; generation: GenerationReader },
        fetchRequest,
        prefix,
      )
      await writeFetchResponseToNodeResponse(res, response)
    },
  })
}

async function handleInstallFetchRequest(
  servicesReady: boolean,
  capability: 'desktopProfiles' | 'desktopPnpm' | 'generation' | null,
  services: { profiles: DesktopProfilesLike; pnpm: DesktopPnpmLike; generation: GenerationReader },
  request: Request,
  prefix: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { reason: 'method-not-allowed' } }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (!servicesReady) {
    return installUnavailableResponse(capability ?? 'desktopProfiles')
  }
  let body: unknown
  try {
    const text = await readBodyGeneric(request)
    body = JSON.parse(text)
  } catch {
    return new Response(JSON.stringify({ error: { reason: 'invalid-json' } }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const url = new URL(request.url)
  const path = url.pathname
  const invokingDir = services.profiles.current.dir
  const lifecycleWarning = 'package 安装可能执行 lifecycle script'
  const requestBody = { ...(body as Record<string, unknown>), lifecycleWarning }

  if (path.endsWith('/preview')) {
    const result = await handleInstallPreview({ services, invokingDir }, requestBody as never)
    return installResultToResponse(result)
  }
  if (path.endsWith('/confirm')) {
    const result = await handleInstallConfirm({ services, invokingDir }, requestBody as never)
    return installResultToResponse(result)
  }
  return new Response(JSON.stringify({ error: { reason: 'not-found', detail: path } }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })
}

function installResultToResponse(
  result:
    | { kind: 'ok-preview'; preview: unknown; token: unknown; fetchedAt: string }
    | { kind: 'ok-confirm'; exitCode: number | null; signal: NodeJS.Signals | null; spec: string }
    | { kind: 'error'; status: number; reason: string; detail?: string },
): Response {
  if (result.kind === 'ok-preview') {
    return new Response(JSON.stringify({
      preview: result.preview,
      token: result.token,
      fetchedAt: result.fetchedAt,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (result.kind === 'ok-confirm') {
    return new Response(JSON.stringify({
      exitCode: result.exitCode,
      signal: result.signal,
      spec: result.spec,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response(JSON.stringify({
    error: result.detail === undefined ? { reason: result.reason } : { reason: result.reason, detail: result.detail },
  }), { status: result.status, headers: { 'content-type': 'application/json' } })
}

function installUnavailableResponse(missing: string): Response {
  return new Response(JSON.stringify({
    error: { reason: 'install-unavailable', detail: missing },
  }), { status: 503, headers: { 'content-type': 'application/json' } })
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
      const fetchRequest = await anyToFetchRequest(req, prefix)
      const response = await dispatchMarketRequest(handle, fetchRequest)
      await writeFetchResponseToNodeResponse(res, response)
    },
  })
}

/**
 * Copy status, headers, and body from a Fetch `Response` to a Node
 * `ServerResponse`. Centralized so all routes share the same write path.
 */
async function writeFetchResponseToNodeResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    try { res.setHeader(key, value) } catch { /* ignore read-only headers in tests */ }
  })
  res.end(await response.text())
}

function buildUrlFromIncoming(req: IncomingMessage, basePath: string): string {
  // webServer handlers receive only IncomingMessage; the URL host is
  // 127.0.0.1 with the listening port. We use the path as given.
  void basePath
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

/**
 * Read body for either an `IncomingMessage` (production) or a Fetch
 * `Request` (tests + adapters). Detects at runtime.
 */
async function readBodyGeneric(req: IncomingMessage | Request): Promise<string> {
  if (typeof (req as Request).text === 'function' && !('on' in req)) {
    return (req as Request).text()
  }
  return readBody(req as IncomingMessage)
}

/**
 * Convert a Node `IncomingMessage` to a Fetch `Request`. Used at the
 * webserver boundary so the rest of the dispatch pipeline can use Web
 * platform APIs uniformly.
 */
async function nodeToFetchRequest(
  req: IncomingMessage,
  basePath: string,
): Promise<Request> {
  void basePath
  const url = buildUrlFromIncoming(req, basePath)
  const method = (req.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method })
  }
  const body = await readBody(req)
  return new Request(url, { method, body })
}

/**
 * Accept either an `IncomingMessage` (production) or a Fetch
 * `Request` (test framework substitutes) and return a `Request`.
 */
async function anyToFetchRequest(
  req: IncomingMessage | Request,
  basePath: string,
): Promise<Request> {
  if (typeof (req as Request).text === 'function' && !('on' in req)) {
    return req as Request
  }
  return nodeToFetchRequest(req as IncomingMessage, basePath)
}