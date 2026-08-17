/**
 * Install routes (M5.2).
 *
 * Two endpoints under `/v1/market/install/`:
 *   - POST /preview   → returns InstallPreview + ConfirmToken
 *   - POST /confirm   → re-checks the token and calls desktopPnpm.runPlugin
 *
 * Per threat-model.md:
 *   - T-04 / T-09: re-read profile + generation just before runPlugin
 *   - T-05        : re-read snapshot.fetchedAt and reject on change
 *   - T-08        : preview includes the lifecycle warning verbatim
 *   - T-11        : target is derived from the snapshot, never from the renderer
 *   - T-12        : errors return bounded JSON `{ error: { reason, detail? } }`
 *   - T-13        : desktopPnpm's per-generation gate handles concurrency
 */

import type { CatalogProviderPageItem } from '../../contracts/types.js'
import { resolveCandidate, type IdentityChoice } from './candidate.js'
import { buildConfirmToken, buildInstallPreview } from './preview.js'
import { recheckConfirm } from './confirm.js'
import { IdentityError, StaleConfirmationError, isIdentityError } from './errors.js'
import { readCurrentProfile, type DesktopProfilesLike, type GenerationReader } from './profile.js'
import type { ProfileSnapshot, GenerationSnapshot, ConfirmToken, InstallPreview } from './preview.js'

/** Minimal surface `desktopPnpm` exposes (per dsh-plugin-desktop docs). */
export interface DesktopPnpmLike {
  run(
    args: readonly string[],
    invokingDir: string,
    signal?: AbortSignal,
  ): { done: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> }
  runPlugin(
    args: readonly string[],
    invokingDir: string,
    signal?: AbortSignal,
  ): { done: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> }
}

/** Capability detection (M5.4). */
export interface DesktopServices {
  readonly profiles: DesktopProfilesLike
  readonly pnpm: DesktopPnpmLike
  readonly generation: GenerationReader
}

export type InstallRouteResult =
  | { kind: 'ok-preview'; preview: InstallPreview; token: ConfirmToken; fetchedAt: string }
  | { kind: 'ok-confirm'; exitCode: number | null; signal: NodeJS.Signals | null; spec: string }
  | { kind: 'error'; status: number; reason: string; detail?: string }

interface PreviewRequest {
  sourceRecordId: string
  itemId: string
  identityChoice?: IdentityChoice
  /** Current snapshot as the Host sees it; the renderer passes it via
   *  the loopback carrier. Items are the provider-page shape — Host
   *  injects provenance when normalizing, so the install path does not
   *  need it. */
  snapshot: {
    fetchedAt: string
    items: readonly CatalogProviderPageItem[]
    source: { providerId: string }
  }
  /** Localized lifecycle warning; locale bundles include this phrase verbatim (T-08). */
  lifecycleWarning: string
}

interface ConfirmRequest {
  token: ConfirmToken
  /** Re-fetched snapshot, must match the bound fetchedAt (T-05). */
  snapshotFetchedAt: string
}

/** Render a structured error result. */
function fail(status: number, reason: string, detail?: string): InstallRouteResult {
  return detail === undefined
    ? { kind: 'error', status, reason }
    : { kind: 'error', status, reason, detail }
}

export interface InstallRouteDeps {
  services: DesktopServices
  /** Absolute directory `desktopPnpm.runPlugin` will treat as cwd. */
  invokingDir: string
}

/**
 * Handle an install preview request. Pure function over the supplied
 * inputs — no I/O beyond reading the desktop services.
 */
export async function handleInstallPreview(
  deps: InstallRouteDeps,
  body: PreviewRequest,
): Promise<InstallRouteResult> {
  const item = body.snapshot.items.find((it) => it.id === body.itemId)
  if (item === undefined) return fail(404, 'item-not-found', body.itemId)

  let candidate
  try {
    candidate = resolveCandidate(item, body.identityChoice)
  } catch (cause) {
    if (isIdentityError(cause)) return fail(400, cause.reason, cause.detail)
    throw cause
  }
  if (candidate.kind === 'conflict') {
    return fail(409, 'identity-choice-required', candidate.item.id)
  }

  const profile = readCurrentProfile(deps.services.profiles)
  const generation = deps.services.generation()
  const token = buildConfirmToken({
    sourceRecordId: body.sourceRecordId,
    itemId: candidate.item.id,
    choice: candidate.choice,
    target: candidate.target,
    profile,
    generation,
    fetchedAt: body.snapshot.fetchedAt,
  })
  const preview = buildInstallPreview({
    item: candidate.item,
    source: { sourceRecordId: body.sourceRecordId, providerId: body.snapshot.source.providerId },
    target: candidate.target,
    profile,
    lifecycleWarning: body.lifecycleWarning,
  })
  return { kind: 'ok-preview', preview, token, fetchedAt: body.snapshot.fetchedAt }
}

/**
 * Handle an install confirm request. Re-checks every bound value,
 * then calls desktopPnpm.runPlugin.
 */
export async function handleInstallConfirm(
  deps: InstallRouteDeps,
  body: ConfirmRequest,
): Promise<InstallRouteResult> {
  try {
    recheckConfirm({
      token: body.token,
      currentProfile: readCurrentProfile(deps.services.profiles),
      currentGeneration: deps.services.generation(),
      currentFetchedAt: body.snapshotFetchedAt,
    })
  } catch (cause) {
    if (cause instanceof StaleConfirmationError) {
      return fail(409, cause.reason, cause.detail)
    }
    throw cause
  }

  const handle = deps.services.pnpm.runPlugin(
    ['add', body.token.target.spec],
    deps.invokingDir,
  )
  const outcome = await handle.done
  return {
    kind: 'ok-confirm',
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    spec: body.token.target.spec,
  }
}

/** Capability probe. Returns null when both services are present. */
export function missingCapability(
  services: Partial<DesktopServices>,
): 'desktopProfiles' | 'desktopPnpm' | 'generation' | null {
  if (services.profiles === undefined) return 'desktopProfiles'
  if (services.pnpm === undefined) return 'desktopPnpm'
  if (services.generation === undefined) return 'generation'
  return null
}

// Re-export IdentityError / StaleConfirmationError so callers can import
// them from a single module path.
export { IdentityError, StaleConfirmationError }