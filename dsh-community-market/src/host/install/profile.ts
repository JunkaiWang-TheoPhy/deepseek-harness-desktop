/**
 * Profile / generation snapshot adapters (M5.1).
 *
 * Bridges DSH's `desktopProfiles.current` and a runtime generation
 * signal into the local `ProfileSnapshot` / `GenerationSnapshot` types
 * used by the confirm token (M4.5). Both readers are injectable so
 * tests can swap in deterministic values without standing up the full
 * DSH harness.
 */
import type { ProfileSnapshot, GenerationSnapshot } from './preview.js'

/** Minimal shape the adapter needs from `desktopProfiles`. */
export interface DesktopProfilesLike {
  readonly current: ProfileSnapshot
}

/**
 * Read the current profile. Adapter only.
 */
export function readCurrentProfile(desktopProfiles: DesktopProfilesLike): ProfileSnapshot {
  return desktopProfiles.current
}

/**
 * Generate the runtime generation snapshot. The actual generation source
 * is decided by Phase 6 wiring; for Phase 5 we expose an injectable
 * factory so the Host entry can read it from a Cordis-provided service
 * or from a static default in tests.
 */
export type GenerationReader = () => GenerationSnapshot

export const staticGeneration: (id: string) => GenerationReader =
  (id) => () => ({ id })