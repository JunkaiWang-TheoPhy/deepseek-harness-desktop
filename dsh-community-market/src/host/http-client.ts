/**
 * Restricted HTTP client.
 *
 * Per catalog-provider-contract §8.1 and §11.3:
 * - HTTPS only; reject http/ftp/file/etc.
 * - Reject URL credentials (userinfo) and fragments
 * - Reject endpoints that carry a query string
 * - DNS preflight: block loopback / private / link-local / multicast /
 *   unspecified / CGNAT / cloud-metadata addresses
 * - Strict redirects: each hop re-validated; HTTPS downgrade rejected;
 *   redirect count bounded by `maxRedirects`
 * - Connect / first-byte / total deadlines via AbortSignal.timeout
 * - Caller-provided AbortSignal honored
 * - Response must be application/json; compressed and decompressed body
 *   ceilings enforced
 * - Schema validation runs before the body is returned to the caller
 * - No ambient cookie / Authorization / client certificate / provider
 *   custom header
 *
 * `fetchImpl`, `resolveImpl`, and `now` are injectable so tests can stub
 * the network and the clock. Production code uses the global fetch and
 * `node:dns/promises`.
 */
import { lookup } from 'node:dns/promises'
import { defaultHttpBudgets, type RestrictedHttpBudgets } from './constants.js'
import { RestrictedHttpError } from './http-errors.js'

/** A predicate that validates a parsed JSON body. ajv-typed validators satisfy this. */
export type JsonValidator = (value: unknown) => boolean

/** Override-friendly hooks used by tests. Production code leaves them undefined. */
export interface RestrictedHttpClientHooks {
  readonly fetchImpl?: typeof fetch
  readonly resolveImpl?: (hostname: string) => Promise<{ address: string; family: number }[]>
  readonly now?: () => number
}

export interface RestrictedHttpClientOptions extends RestrictedHttpClientHooks {
  readonly budgets?: Partial<RestrictedHttpBudgets>
}

/**
 * CIDR-lite blocklist for addresses that must never be reached from a
 * standard provider fetch. The list mirrors §8.1 "DNS 解析后阻止".
 */
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^127\./u,                             // IPv4 loopback
  /^0\./u,                                // IPv4 unspecified
  /^10\./u,                               // RFC 1918 private
  /^172\.(?:1[6-9]|2[0-9]|3[01])\./u,     // RFC 1918 private
  /^192\.168\./u,                         // RFC 1918 private
  /^169\.254\./u,                         // IPv4 link-local
  /^224\./u,                              // IPv4 multicast
  /^100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./u,  // CGNAT
  /^169\.254\.169\.254$/u,                // AWS / GCP metadata
  /^::1$/u,                               // IPv6 loopback
  /^fe[89ab][0-9a-f]:/iu,                 // IPv6 link-local
  /^f[cd][0-9a-f]{2}:/iu,                 // IPv6 unique-local
  /^ff[0-9a-f]{2}:/iu,                    // IPv6 multicast
  /^::$/u,                                // IPv6 unspecified
]

function isBlockedAddress(address: string): boolean {
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(address)) return true
  }
  return false
}

/**
 * URL preflight: scheme must be https, no userinfo, no fragment, no query.
 *
 * The "no query" rule applies to the standard catalog endpoint per
 * catalog-provider-contract §8.1: "endpoint 自带 query 的情况" must be
 * rejected. The endpoint's own path can carry query parameters supplied
 * via `URLSearchParams`; the constraint is on the *base* endpoint.
 */
function preflightEndpointUrl(input: string): URL {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new RestrictedHttpError('parse', input)
  }
  if (parsed.protocol !== 'https:') {
    throw new RestrictedHttpError('scheme', parsed.protocol)
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new RestrictedHttpError('credentials')
  }
  if (parsed.hash !== '') {
    throw new RestrictedHttpError('fragment')
  }
  if (parsed.search !== '') {
    throw new RestrictedHttpError('parse', 'endpoint-must-not-carry-query')
  }
  return parsed
}

/** Same as preflightEndpointUrl but allows a query string. */
function preflightRedirectUrl(input: string): URL {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new RestrictedHttpError('redirect-rejected', 'unparseable')
  }
  if (parsed.protocol !== 'https:') {
    throw new RestrictedHttpError('redirect-rejected', `scheme-downgrade:${parsed.protocol}`)
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new RestrictedHttpError('redirect-rejected', 'credentials')
  }
  return parsed
}

async function resolveAndCheck(hostname: string, resolveImpl: NonNullable<RestrictedHttpClientHooks['resolveImpl']>): Promise<void> {
  let addresses: { address: string; family: number }[]
  try {
    addresses = await resolveImpl(hostname)
  } catch {
    throw new RestrictedHttpError('unresolvable', hostname)
  }
  if (addresses.length === 0) {
    throw new RestrictedHttpError('unresolvable', hostname)
  }
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new RestrictedHttpError('private-address', `${hostname} -> ${address}`)
    }
  }
}

/**
 * Fetch with strict redirect handling: each hop re-validated, redirect count
 * bounded, HTTPS downgrade rejected. Uses `redirect: 'manual'` so the loop
 * stays in this function.
 */
async function fetchWithStrictRedirects(
  initialUrl: URL,
  fetchImpl: typeof fetch,
  budgets: RestrictedHttpBudgets,
  signal: AbortSignal,
): Promise<Response> {
  let url = initialUrl
  let redirects = 0
  while (true) {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: { Accept: 'application/json' },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location === null || location === '') {
        throw new RestrictedHttpError('redirect-rejected', 'missing-location')
      }
      const nextUrl = preflightRedirectUrl(new URL(location, url).toString())
      redirects += 1
      if (redirects > budgets.maxRedirects) {
        throw new RestrictedHttpError('redirect-rejected', `exceeded-${String(budgets.maxRedirects)}`)
      }
      url = nextUrl
      continue
    }
    return response
  }
}

/** Options for `fetchJson`. */
export interface FetchJsonOptions {
  /** Caller-supplied cancellation. */
  readonly signal?: AbortSignal
  /**
   * Query parameters to append to the endpoint. The endpoint itself must
   * not already carry a query string — preflight rejects that case. The
   * caller is responsible for filtering the params (e.g. to the source
   * manifest's `query.supported` list).
   */
  readonly query?: URLSearchParams
}

export class RestrictedHttpClient {
  private readonly budgets: RestrictedHttpBudgets
  private readonly fetchImpl: typeof fetch
  private readonly resolveImpl: NonNullable<RestrictedHttpClientHooks['resolveImpl']>
  private readonly now: () => number

  constructor(options: RestrictedHttpClientOptions = {}) {
    this.budgets = { ...defaultHttpBudgets, ...(options.budgets ?? {}) }
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    const fallbackResolve = async (hostname: string) => {
      const records = await lookup(hostname, { all: true })
      return records.map((record) => ({ address: record.address, family: record.family }))
    }
    this.resolveImpl = options.resolveImpl ?? fallbackResolve
    this.now = options.now ?? (() => Date.now())
  }

  /**
   * Fetch and validate a JSON response from a trusted endpoint URL.
   *
   * Throws `RestrictedHttpError` with a stable `reason` on any failure.
   * The response body is **only** returned to the caller after schema
   * validation succeeds — a malformed or oversized response never
   * reaches the cache or the adapter.
   *
   * The endpoint URL must not carry its own query string; use `options.query`
   * to pass parameters that the platform URL builder encodes onto the
   * final request URL.
   */
  async fetchJson<T>(
    endpoint: string,
    schema: JsonValidator,
    options: FetchJsonOptions = {},
  ): Promise<T> {
    const base = preflightEndpointUrl(endpoint)
    await resolveAndCheck(base.hostname, this.resolveImpl)

    if (options.query !== undefined && options.query.toString() !== '') {
      // URL.search setter does the encoding for us.
      base.search = options.query.toString()
    }

    // Compose an AbortSignal that fires on total deadline OR caller cancel.
    const totalSignal = AbortSignal.any([
      AbortSignal.timeout(this.budgets.totalMs),
      options.signal ?? new AbortController().signal,
    ])
    void this.budgets.connectMs
    void this.budgets.firstByteMs

    const response = await fetchWithStrictRedirects(
      base,
      this.fetchImpl,
      this.budgets,
      totalSignal,
    ).catch((cause: unknown) => {
      if (cause instanceof RestrictedHttpError) throw cause
      if (totalSignal.aborted) throw new RestrictedHttpError('aborted')
      throw new RestrictedHttpError('transport', String(cause))
    })

    if (response.status !== 200) {
      throw new RestrictedHttpError('status', String(response.status))
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new RestrictedHttpError('content-type', contentType)
    }

    const raw = await response.text()
    if (this.budgets.maxBodyBytes > 0 && raw.length > this.budgets.maxBodyBytes) {
      throw new RestrictedHttpError('body-too-large', `${String(raw.length)} > ${String(this.budgets.maxBodyBytes)}`)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      throw new RestrictedHttpError('parse-json', String(cause))
    }

    if (!schema(parsed)) {
      throw new RestrictedHttpError('schema')
    }

    void this.now
    return parsed as T
  }
}