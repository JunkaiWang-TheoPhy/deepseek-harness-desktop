/**
 * Identity-resolution errors.
 *
 * Stable `reason` codes that the UI and tests assert on. Mirrors the
 * T-01..T-13 codes in `docs/threat-model.md`.
 */
export type IdentityErrorReason =
  /** Item declares an npm package but `latestVersion` is not strict SemVer */
  | 'npm-version-not-semver'
  /** Item declares an npm package but the resolved name fails the npm pattern */
  | 'npm-name-invalid'
  /** Item declares a repository but provides no immutable commit reference */
  | 'no-immutable-ref'
  /** Item declares a repository with a mutable reference (branch / mutable tag) */
  | 'mutable-ref'
  /** The provided commit string is not a 40-character lowercase hex string */
  | 'commit-format-invalid'
  /** Item declares both npm package and repository; user must choose */
  | 'both-identities-declared'
  /** Caller did not supply an identityChoice when both identities are present */
  | 'identity-choice-required'
  /** Caller supplied an identityChoice that does not match the available identities */
  | 'identity-choice-invalid'
  /** The item is missing the identity implied by the chosen choice */
  | 'identity-missing'

export class IdentityError extends Error {
  readonly reason: IdentityErrorReason
  readonly detail?: string

  constructor(reason: IdentityErrorReason, detail?: string) {
    super(
      detail === undefined
        ? `install-identity: ${reason}`
        : `install-identity: ${reason}: ${detail}`,
    )
    this.name = 'IdentityError'
    this.reason = reason
    this.detail = detail
  }
}

export function isIdentityError(value: unknown): value is IdentityError {
  return value instanceof IdentityError
}

/** Stale confirmation errors — bound profile/generation/snapshot no longer match. */
export type StaleConfirmationErrorReason =
  | 'profile-changed'
  | 'generation-changed'
  | 'snapshot-refreshed'
  | 'ttl-expired'

export class StaleConfirmationError extends Error {
  readonly reason: StaleConfirmationErrorReason
  readonly detail?: string

  constructor(reason: StaleConfirmationErrorReason, detail?: string) {
    super(
      detail === undefined
        ? `install-confirm: ${reason}`
        : `install-confirm: ${reason}: ${detail}`,
    )
    this.name = 'StaleConfirmationError'
    this.reason = reason
    this.detail = detail
  }
}