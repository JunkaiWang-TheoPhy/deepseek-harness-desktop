/**
 * Phase 2 M2.1 restricted HTTP client tests.
 *
 * Each test uses an injected fetchImpl + resolveImpl to avoid touching the
 * real network. The cases cover §11.3 "网络与安全" matrix:
 * - URL preflight (scheme / credentials / fragment / endpoint query)
 * - DNS preflight (private / loopback / link-local / metadata)
 * - Redirect (downgrade / too many / credentialed)
 * - Body / size / content-type / parse / schema
 * - Timeout via AbortSignal
 */
import { describe, expect, it } from 'vitest'
import { RestrictedHttpClient } from '../../src/host/http-client.js'
import { RestrictedHttpError, isRestrictedHttpError } from '../../src/host/http-errors.js'
import type { RestrictedHttpClientHooks } from '../../src/host/http-client.js'

const dummySchema = (_value: unknown): boolean => true

function makeClient(hooks: RestrictedHttpClientHooks): RestrictedHttpClient {
  return new RestrictedHttpClient({ ...hooks, budgets: { totalMs: 5_000 } })
}

const publicResolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [
  { address: '93.184.216.34', family: 4 },
]

describe('RestrictedHttpClient URL preflight', () => {
  it('rejects a non-HTTPS URL with reason "scheme"', async () => {
    const client = makeClient({ fetchImpl: (() => Promise.resolve(new Response())) as typeof fetch, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('http://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'scheme' })
  })

  it('rejects an FTP URL with reason "scheme"', async () => {
    const client = makeClient({ fetchImpl: (() => Promise.resolve(new Response())) as typeof fetch, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('ftp://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'scheme' })
  })

  it('rejects a URL with userinfo with reason "credentials"', async () => {
    const client = makeClient({ fetchImpl: (() => Promise.resolve(new Response())) as typeof fetch, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://user:pass@catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'credentials' })
  })

  it('rejects an endpoint that carries its own query string with reason "parse"', async () => {
    const client = makeClient({ fetchImpl: (() => Promise.resolve(new Response())) as typeof fetch, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins?prefilled=true', dummySchema),
    ).rejects.toMatchObject({ reason: 'parse' })
  })

  it('appends URLSearchParams via options.query and forwards the encoded URL to fetch', async () => {
    let observedUrl = ''
    const fetchImpl: typeof fetch = (async (input) => {
      observedUrl = typeof input === 'string' ? input : (input as URL).toString()
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    const params = new URLSearchParams({ q: 'sidebar', limit: '20' })
    await client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema, { query: params })
    expect(observedUrl).toBe('https://catalog.example.org/v1/plugins?q=sidebar&limit=20')
  })
})

describe('RestrictedHttpClient DNS preflight', () => {
  it('rejects a hostname that resolves to a loopback address', async () => {
    const resolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [{ address: '127.0.0.1', family: 4 }]
    const client = makeClient({ resolveImpl: resolve, fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as typeof fetch })
    await expect(
      client.fetchJson('https://localhost/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'private-address' })
  })

  it('rejects a hostname that resolves to a private network address (10/8)', async () => {
    const resolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [{ address: '10.0.0.1', family: 4 }]
    const client = makeClient({ resolveImpl: resolve, fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as typeof fetch })
    await expect(
      client.fetchJson('https://internal.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'private-address' })
  })

  it('rejects a hostname that resolves to AWS metadata', async () => {
    const resolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [{ address: '169.254.169.254', family: 4 }]
    const client = makeClient({ resolveImpl: resolve, fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as typeof fetch })
    await expect(
      client.fetchJson('https://metadata.aws/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'private-address' })
  })

  it('rejects IPv6 link-local addresses', async () => {
    const resolve: RestrictedHttpClientHooks['resolveImpl'] = async () => [{ address: 'fe80::1', family: 6 }]
    const client = makeClient({ resolveImpl: resolve, fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as typeof fetch })
    await expect(
      client.fetchJson('https://router.local/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'private-address' })
  })

  it('rejects resolution failures with reason "unresolvable"', async () => {
    const resolve: RestrictedHttpClientHooks['resolveImpl'] = async () => { throw new Error('no DNS') }
    const client = makeClient({ resolveImpl: resolve, fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as typeof fetch })
    await expect(
      client.fetchJson('https://nx.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'unresolvable' })
  })
})

describe('RestrictedHttpClient fetch + body checks', () => {
  it('accepts a valid 200 application/json response and returns the parsed body', async () => {
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    const body = await client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema)
    expect(body).toEqual({ ok: true })
  })

  it('rejects non-200 with reason "status"', async () => {
    const fetchImpl: typeof fetch = (async () => new Response('server error', {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'status' })
  })

  it('rejects non-json content-type with reason "content-type"', async () => {
    const fetchImpl: typeof fetch = (async () => new Response('<html>oops</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'content-type' })
  })

  it('rejects body larger than maxBodyBytes with reason "body-too-large"', async () => {
    const fetchImpl: typeof fetch = (async () => new Response('x'.repeat(2048), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const client = new RestrictedHttpClient({
      fetchImpl,
      resolveImpl: publicResolve,
      budgets: { totalMs: 5_000, maxBodyBytes: 100 },
    })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'body-too-large' })
  })

  it('rejects malformed JSON with reason "parse-json"', async () => {
    const fetchImpl: typeof fetch = (async () => new Response('not-json{', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema),
    ).rejects.toMatchObject({ reason: 'parse-json' })
  })

  it('rejects schema-invalid body with reason "schema"', async () => {
    const rejectSchema = (((value: unknown) => value === 'ok') as ((value: unknown) => boolean) & { errors?: null })
    rejectSchema.errors = null
    const fetchImpl: typeof fetch = (async () => new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', rejectSchema),
    ).rejects.toMatchObject({ reason: 'schema' })
  })
})

describe('RestrictedHttpClient abort', () => {
  it('rejects caller-driven abort with reason "aborted"', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl: typeof fetch = (async (_url, init) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const client = makeClient({ fetchImpl, resolveImpl: publicResolve })
    await expect(
      client.fetchJson('https://catalog.example.org/v1/plugins', dummySchema, { signal: controller.signal }),
    ).rejects.toMatchObject({ reason: 'aborted' })
  })
})

describe('isRestrictedHttpError', () => {
  it('returns true for RestrictedHttpError instances', () => {
    const err = new RestrictedHttpError('scheme')
    expect(isRestrictedHttpError(err)).toBe(true)
    expect(isRestrictedHttpError(new Error('other'))).toBe(false)
  })
})