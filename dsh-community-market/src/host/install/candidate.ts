/**
 * Install candidate resolver (T-03, T-11).
 *
 * Given a `CatalogSnapshotItem` (already validated by ajv) and an explicit
 * `identityChoice` from the user, derive the install target. The renderer
 * never supplies the target — the Host resolves it locally (T-11).
 *
 *   - `identityChoice: 'npm'` → `resolveNpmTarget(item.package)` is invoked.
 *   - `identityChoice: 'repository'` → `resolveGitTarget(item.repository)` is invoked.
 *   - When both identities are present and `identityChoice` is `'either'`,
 *     the resolver returns `Conflict` so the UI can force a choice.
 *   - When only one identity is present, the resolver picks it (no silent
 *     pick is possible because there is no choice to make).
 */

import { resolveNpmTarget, resolveGitTarget, type InstallTarget } from './identity.js'
import { IdentityError } from './errors.js'

/** What the user (or auto-detected single-identity case) chose. */
export type IdentityChoice = 'npm' | 'repository'

/** The item declares both `package` and `repository`; UI must force a choice. */
export interface CandidateConflict {
  readonly kind: 'conflict'
  readonly item: { readonly id: string; readonly displayName: string }
}

/** A single resolved candidate. */
export interface CandidateResolved {
  readonly kind: 'resolved'
  readonly item: { readonly id: string; readonly displayName: string }
  readonly choice: IdentityChoice
  readonly target: InstallTarget
}

export type Candidate = CandidateConflict | CandidateResolved

/** Subset of `CatalogSnapshotItem` the resolver consumes. */
export interface CandidateItem {
  readonly id: string
  readonly displayName: string
  readonly package?: { readonly registry: 'npm'; readonly name: string; readonly latestVersion?: string }
  readonly repository?: {
    readonly url: string
    readonly commit?: string
    readonly ref?: string
    readonly tag?: string
  }
}

/**
 * Resolve the install candidate. `identityChoice` is required when both
 * identities are present; when only one is, the resolver may be called
 * with `undefined` (it picks the available one).
 *
 * @throws IdentityError for any reason raised by the underlying resolvers
 */
export function resolveCandidate(
  item: CandidateItem,
  identityChoice: IdentityChoice | undefined,
): Candidate {
  const hasNpm = item.package !== undefined
  const hasRepo = item.repository !== undefined

  if (hasNpm && hasRepo) {
    if (identityChoice === undefined) {
      return {
        kind: 'conflict',
        item: { id: item.id, displayName: item.displayName },
      }
    }
    const target = identityChoice === 'npm'
      ? resolveNpmTarget(item.package!)
      : resolveGitTarget(item.repository!)
    return {
      kind: 'resolved',
      item: { id: item.id, displayName: item.displayName },
      choice: identityChoice,
      target,
    }
  }

  if (hasNpm) {
    if (identityChoice === 'repository') {
      throw new IdentityError('identity-choice-invalid', 'no-repository')
    }
    const target = resolveNpmTarget(item.package!)
    return {
      kind: 'resolved',
      item: { id: item.id, displayName: item.displayName },
      choice: 'npm',
      target,
    }
  }

  if (hasRepo) {
    if (identityChoice === 'npm') {
      throw new IdentityError('identity-choice-invalid', 'no-npm')
    }
    const target = resolveGitTarget(item.repository!)
    return {
      kind: 'resolved',
      item: { id: item.id, displayName: item.displayName },
      choice: 'repository',
      target,
    }
  }

  throw new IdentityError('identity-missing', item.id)
}