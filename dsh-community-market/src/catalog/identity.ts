/**
 * Identity normalization for install candidates.
 *
 * Per catalog-provider-contract §"安全要求" and the repository / package
 * patterns in docs/schemas:
 *
 * - npm package names are case-insensitive; the canonical form is lowercase
 * - Repository URLs must be HTTPS with no credentials; the URL parser
 *   already strips fragments and lowercases the host
 * - Repository subdirectory paths must be relative (no leading slash),
 *   contain no `..` segments, and contain no backslashes
 *
 * Each function returns a structured result so callers can surface the
 * reason to the user without losing the rejected input.
 */

export interface IdentityOk<T> {
  readonly ok: true
  readonly value: T
}

export interface IdentityFailure<T> {
  readonly ok: false
  readonly value: T
  readonly reason: string
}

export type IdentityResult<T> = IdentityOk<T> | IdentityFailure<T>

const ok = <T>(value: T): IdentityOk<T> => ({ ok: true, value })
const fail = <T>(value: T, reason: string): IdentityFailure<T> => ({ ok: false, value, reason })

/**
 * Canonicalize an npm package name. Lowercases the entire string and
 * validates against the npm identifier pattern from
 * catalog-provider-page.schema.json §package.
 *
 * Returns the lowercased form when valid; otherwise the lowercased input
 * with a `reason` so the caller can show the user what went wrong.
 */
export function normalizeNpmName(input: string): IdentityResult<string> {
  const lower = input.toLowerCase()
  // Mirror the schema pattern: optional `@scope/` prefix, lowercase alnum +
  // ._-; max length 214 per npm spec.
  const pattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
  if (lower.length === 0 || lower.length > 214) {
    return fail(lower, 'length')
  }
  if (!pattern.test(lower)) {
    return fail(lower, 'pattern')
  }
  return ok(lower)
}

/**
 * Canonicalize a repository URL.
 *
 * - rejects non-HTTPS schemes
 * - rejects credentials (userinfo) in the authority
 * - rejects fragments (the URL parser already strips them, but we assert)
 * - lowercases the host (URL parser does this natively)
 *
 * Returns the canonical form on success; otherwise the input untouched
 * with a `reason`.
 */
export function normalizeRepositoryUrl(input: string): IdentityResult<string> {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return fail(input, 'parse')
  }
  if (parsed.protocol !== 'https:') {
    return fail(input, 'scheme')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return fail(input, 'credentials')
  }
  if (parsed.hash !== '') {
    return fail(input, 'fragment')
  }
  // Strip a trailing slash on the path's root so 'https://host' and
  // 'https://host/' collapse to the same canonical form.
  let href = parsed.href
  if (parsed.pathname === '/' && parsed.href.endsWith('/')) {
    href = parsed.href.slice(0, -1)
  }
  return ok(href)
}

/**
 * Validate a repository subdirectory path.
 *
 * Per catalog-provider-page.schema.json §repository.subdirectory:
 * - must be relative (no leading slash)
 * - must contain no `..` segments
 * - must contain no backslashes
 */
export function normalizeRepositorySubdirectory(
  input: string,
): IdentityResult<string> {
  if (input.length === 0) return fail(input, 'empty')
  if (input.startsWith('/')) return fail(input, 'absolute')
  if (input.includes('\\')) return fail(input, 'backslash')
  for (const segment of input.split('/')) {
    if (segment === '..') return fail(input, 'parent-segment')
  }
  return ok(input)
}