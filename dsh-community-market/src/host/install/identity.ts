/**
 * Identity resolver.
 *
 * Per threat-model.md T-01 (npm) and T-02 (repository). Pure functions;
 * no I/O, no clock, no side effects. The Caller passes in normalized
 * `CatalogSnapshotItem` data; the resolver never re-reads the snapshot.
 *
 * npm target format: `name@version` where `version` is strict SemVer.
 * git target format: `git+<url>#<commit>` where `commit` is 40 lowercase
 * hex characters.
 *
 * All rejections throw `IdentityError` with a stable `reason` from
 * `errors.ts` so the UI / tests can assert against the code without
 * parsing English messages.
 */
import {
  IdentityError,
  isIdentityError,
  type IdentityErrorReason,
} from './errors.js'

/** Official SemVer 2.0.0 regex. Matches `1.2.3`, `1.2.3-pre.1`, `1.2.3+build`. */
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

/** Mirrors `catalog-provider-page.schema.json §package.name`. */
const NPM_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

/** Lowercase 40-char SHA-1 hex commit. */
const COMMIT_PATTERN = /^[a-f0-9]{40}$/

export interface NpmTarget {
  readonly kind: 'npm'
  readonly name: string
  readonly version: string
  /** Rendered spec: `name@version`. */
  readonly spec: string
}

export interface GitTarget {
  readonly kind: 'git'
  readonly url: string
  readonly commit: string
  /** Rendered spec: `git+<url>#<commit>`. */
  readonly spec: string
}

export type InstallTarget = NpmTarget | GitTarget

/** Inputs the resolver accepts. Mirrors `CatalogSnapshotItem` (T-03 conflict handled separately). */
export interface IdentityInput {
  readonly package?: { readonly registry: 'npm'; readonly name: string; readonly latestVersion?: string }
  readonly repository?: {
    readonly url: string
    readonly commit?: string
    readonly ref?: string
    readonly tag?: string
  }
}

/** Validate strict SemVer. Returns the normalized version on success. */
export function assertStrictSemVer(value: string): string {
  if (!SEMVER_PATTERN.test(value)) {
    throw new IdentityError('npm-version-not-semver', value)
  }
  return value
}

/** Validate an npm package name. Returns the lowercased name on success. */
export function assertNpmName(name: string): string {
  if (name.length === 0 || name.length > 214 || !NPM_NAME_PATTERN.test(name)) {
    throw new IdentityError('npm-name-invalid', name)
  }
  return name
}

/** Validate a 40-character lowercase hex commit. */
export function assertImmutableCommit(commit: string): string {
  if (!COMMIT_PATTERN.test(commit)) {
    throw new IdentityError('commit-format-invalid', commit)
  }
  return commit
}

/**
 * Resolve the npm-side target from `{ name, latestVersion }`.
 *
 * @throws IdentityError `npm-name-invalid` when the name pattern fails
 * @throws IdentityError `npm-version-not-semver` when `latestVersion`
 *   is missing, malformed, or matches a non-exact specifier (T-01)
 */
export function resolveNpmTarget(input: NonNullable<IdentityInput['package']>): NpmTarget {
  const name = assertNpmName(input.name)
  if (input.latestVersion === undefined || input.latestVersion === '') {
    throw new IdentityError('npm-version-not-semver', 'missing')
  }
  const version = assertStrictSemVer(input.latestVersion)
  return { kind: 'npm', name, version, spec: `${name}@${version}` }
}

/**
 * Resolve the repository-side target. The repository must carry an
 * immutable commit reference; branch / tag / ref-only forms are
 * rejected (T-02).
 */
export function resolveGitTarget(input: NonNullable<IdentityInput['repository']>): GitTarget {
  if (input.commit !== undefined && input.commit !== '') {
    const commit = assertImmutableCommit(input.commit)
    return { kind: 'git', url: input.url, commit, spec: `git+${input.url}#${commit}` }
  }
  if (input.ref !== undefined && input.ref !== '') {
    throw new IdentityError('mutable-ref', `branch:${input.ref}`)
  }
  if (input.tag !== undefined && input.tag !== '') {
    throw new IdentityError('mutable-ref', `tag:${input.tag}`)
  }
  throw new IdentityError('no-immutable-ref', input.url)
}

/** Type guard. */
export function isInstallTarget(value: unknown): value is InstallTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    ((value as { kind: unknown }).kind === 'npm' || (value as { kind: unknown }).kind === 'git') &&
    'spec' in value &&
    typeof (value as { spec: unknown }).spec === 'string'
  )
}

export { IdentityError, isIdentityError, type IdentityErrorReason }