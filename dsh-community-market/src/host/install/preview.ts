/**
 * Install preview + confirm token (T-04, T-05, T-08, T-09).
 *
 * The preview is what the user sees in the second-step confirmation
 * dialog. The token is what the Host carries forward to the runtime
 * check (M4.6). Both are derived from the resolved candidate and the
 * Host's view of the current profile / generation.
 *
 * The renderer never sees or supplies any field that affects the
 * derivation — T-11.
 */
import type { InstallTarget } from './identity.js'

/** A profile identity, mirroring `desktopProfiles.current`. */
export interface ProfileSnapshot {
  readonly name: string
  readonly dir: string
}

/** The runtime's current generation. Phase 5 picks the source of this value. */
export interface GenerationSnapshot {
  readonly id: string
}

/** Bound confirmation; carries every value M4.6 re-reads. */
export interface ConfirmToken {
  readonly sourceRecordId: string
  readonly itemId: string
  readonly choice: 'npm' | 'repository'
  readonly target: InstallTarget
  readonly profile: ProfileSnapshot
  readonly generation: GenerationSnapshot
  readonly fetchedAt: string
  readonly expiresAt: number
  /** Number of milliseconds since epoch when the token was issued. */
  readonly issuedAt: number
}

/** What the user sees in the second-step dialog. */
export interface InstallPreview {
  readonly pluginName: string
  readonly displayName: string
  readonly summary: string
  readonly source: {
    readonly sourceRecordId: string
    readonly providerId: string
  }
  readonly target: InstallTarget
  readonly profile: ProfileSnapshot
  readonly lifecycleWarning: string
}

const DEFAULT_TTL_MS = 30_000

/**
 * Build a confirm token from the resolved target, profile, generation,
 * and snapshot timestamp. The token is the only handle the Host carries
 * forward to the runtime check; nothing else (especially not anything
 * from the renderer) participates.
 */
export function buildConfirmToken(input: {
  sourceRecordId: string
  itemId: string
  choice: 'npm' | 'repository'
  target: InstallTarget
  profile: ProfileSnapshot
  generation: GenerationSnapshot
  fetchedAt: string
  now?: () => number
  ttlMs?: number
}): ConfirmToken {
  const now = input.now ?? (() => Date.now())
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS
  const issuedAt = now()
  return {
    sourceRecordId: input.sourceRecordId,
    itemId: input.itemId,
    choice: input.choice,
    target: input.target,
    profile: input.profile,
    generation: input.generation,
    fetchedAt: input.fetchedAt,
    issuedAt,
    expiresAt: issuedAt + ttl,
  }
}

/**
 * Build the user-facing preview from the candidate + source metadata.
 * The lifecycle warning text is intentionally rendered as a stable,
 * translatable string so the security matrix's smoke test can assert
 * its presence in the rendered dialog.
 */
export function buildInstallPreview(input: {
  item: { readonly id: string; readonly name?: string; readonly displayName: string; readonly summary?: string }
  source: { readonly sourceRecordId: string; readonly providerId: string }
  target: InstallTarget
  profile: ProfileSnapshot
  /** Localized lifecycle warning; locale bundles must include this phrase verbatim. */
  lifecycleWarning: string
}): InstallPreview {
  return {
    pluginName: input.item.name ?? input.item.displayName,
    displayName: input.item.displayName,
    summary: input.item.summary ?? '',
    source: input.source,
    target: input.target,
    profile: input.profile,
    lifecycleWarning: input.lifecycleWarning,
  }
}

/** Default TTL exposed for tests and documentation. */
export const CONFIRM_TOKEN_DEFAULT_TTL_MS = DEFAULT_TTL_MS