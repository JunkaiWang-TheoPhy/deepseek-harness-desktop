/**
 * Stale-confirmation check (T-04, T-05, T-09, T-10).
 *
 * Pure re-reads of profile / generation / snapshot against the values
 * bound in the confirm token. Throws `StaleConfirmationError` on any
 * mismatch; the caller (Host entry) catches and returns a 409 to the
 * renderer without invoking `desktopPnpm.runPlugin`.
 *
 * This module does NOT touch `desktopPnpm`. Calling `desktopPnpm.runPlugin`
 * with a stale token is the failure the runtime gate would catch anyway,
 * but we want the user-visible "snapshot was updated, please review
 * again" message rather than a confusing npm error.
 */
import type { ConfirmToken, GenerationSnapshot, ProfileSnapshot } from './preview.js'
import { StaleConfirmationError } from './errors.js'

export interface RecheckInput {
  token: ConfirmToken
  /** Current profile identity, freshly read from `desktopProfiles.current`. */
  currentProfile: ProfileSnapshot
  /** Current runtime generation. */
  currentGeneration: GenerationSnapshot
  /** Snapshot's `fetchedAt` after a re-fetch; equal means unchanged. */
  currentFetchedAt: string
  /** Optional override; defaults to `Date.now()`. */
  now?: () => number
}

/**
 * Re-check the token's binding against the live state.
 *
 * @throws StaleConfirmationError on profile / generation / snapshot / TTL mismatch
 */
export function recheckConfirm(input: RecheckInput): void {
  const { token, currentProfile, currentGeneration, currentFetchedAt } = input
  const now = (input.now ?? (() => Date.now()))()

  if (token.profile.name !== currentProfile.name || token.profile.dir !== currentProfile.dir) {
    throw new StaleConfirmationError(
      'profile-changed',
      `${token.profile.name}->${currentProfile.name}`,
    )
  }

  if (token.generation.id !== currentGeneration.id) {
    throw new StaleConfirmationError(
      'generation-changed',
      `${token.generation.id}->${currentGeneration.id}`,
    )
  }

  if (token.fetchedAt !== currentFetchedAt) {
    throw new StaleConfirmationError(
      'snapshot-refreshed',
      `${token.fetchedAt}->${currentFetchedAt}`,
    )
  }

  if (now > token.expiresAt) {
    throw new StaleConfirmationError('ttl-expired', String(token.expiresAt - now))
  }
}