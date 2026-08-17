/**
 * Phase 6 M6.2 — End-to-end install flow (alternate integration test).
 *
 * Drives the full preview → confirm chain through the pure handler
 * functions (handleInstallPreview / handleInstallConfirm) with mock
 * desktop services. Proves:
 *   - the install preview produces a token bound to the current
 *     profile, generation, and snapshot.fetchedAt
 *   - the confirm step re-checks every bound value before invoking
 *     desktopPnpm.runPlugin
 *   - profile-changed → 409 (no runPlugin call)
 *   - snapshot-refreshed → 409 (no runPlugin call)
 *   - TTL expired → 409 (no runPlugin call)
 *
 * The plugin-entry wiring (apply() → webServer.register) is exercised
 * separately via dsh-plugin-desktop's `verify:loader`.
 */
import { describe, expect, it } from 'vitest'
import {
  handleInstallPreview,
  handleInstallConfirm,
  type DesktopPnpmLike,
  type InstallRouteDeps,
} from '../../../src/host/install/routes.js'
import { buildConfirmToken } from '../../../src/host/install/preview.js'
import { staticGeneration, type DesktopProfilesLike } from '../../../src/host/install/profile.js'

interface RecordedCall {
  args: readonly string[]
  cwd: string
  signal?: AbortSignal
}

function makePnpm(): DesktopPnpmLike & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  return {
    calls,
    run: () => ({ done: Promise.resolve({ exitCode: 0, signal: null }) }),
    runPlugin: (args, cwd, signal) => {
      calls.push({ args, cwd, signal })
      return { done: Promise.resolve({ exitCode: 0, signal: null }) }
    },
  }
}

function makeDeps(opts: {
  profile?: { name: string; dir: string }
  pnpm?: DesktopPnpmLike & { calls: RecordedCall[] }
}): { deps: InstallRouteDeps; pnpm: DesktopPnpmLike & { calls: RecordedCall[] }; profiles: { current: { name: string; dir: string } } } {
  const profiles: { current: { name: string; dir: string } } = {
    current: opts.profile ?? { name: 'default', dir: '/profiles/default' },
  }
  const pnpm = opts.pnpm ?? makePnpm()
  return {
    deps: {
      services: { profiles, pnpm, generation: staticGeneration('gen-1') },
      invokingDir: profiles.current.dir,
    },
    pnpm,
    profiles,
  }
}

const sampleItem = {
  id: 'better-sidebar',
  name: 'dsh-plugin-better-sidebar',
  displayName: 'Better Sidebar',
  summary: 'Sidebar plugin',
  package: { registry: 'npm' as const, name: 'dsh-plugin-better-sidebar', latestVersion: '1.2.0' },
}

describe('M6.2 end-to-end install flow (preview → confirm)', () => {
  it('preview produces a token bound to the live profile + generation + snapshot', async () => {
    const { deps } = makeDeps({})
    const result = await handleInstallPreview(deps, {
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      identityChoice: 'npm',
      lifecycleWarning: 'package 安装可能执行 lifecycle script',
      snapshot: {
        fetchedAt: '2026-08-17T08:00:00Z',
        source: { providerId: 'org.example' },
        items: [sampleItem],
      },
    })
    expect(result.kind).toBe('ok-preview')
    if (result.kind !== 'ok-preview') throw new Error('unreachable')
    expect(result.token.profile).toEqual({ name: 'default', dir: '/profiles/default' })
    expect(result.token.generation).toEqual({ id: 'gen-1' })
    expect(result.token.fetchedAt).toBe('2026-08-17T08:00:00Z')
    expect(result.token.target.spec).toBe('dsh-plugin-better-sidebar@1.2.0')
    expect(result.token.expiresAt).toBeGreaterThan(result.token.issuedAt)
  })

  it('confirm invokes desktopPnpm.runPlugin with the bound spec on a fresh token', async () => {
    const { deps, pnpm } = makeDeps({})
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(deps, {
      token,
      snapshotFetchedAt: '2026-08-17T08:00:00Z',
    })
    expect(result.kind).toBe('ok-confirm')
    if (result.kind !== 'ok-confirm') throw new Error('unreachable')
    expect(result.exitCode).toBe(0)
    expect(result.spec).toBe('dsh-plugin-better-sidebar@1.2.0')
    expect(pnpm.calls).toHaveLength(1)
    expect(pnpm.calls[0]?.args).toEqual(['add', 'dsh-plugin-better-sidebar@1.2.0'])
    expect(pnpm.calls[0]?.cwd).toBe('/profiles/default')
  })

  it('confirm returns 409 when profile changed between preview and confirm', async () => {
    const profile1 = { name: 'default', dir: '/profiles/default' }
    const { deps, pnpm, profiles } = makeDeps({ profile: profile1 })
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: profile1,
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    // Switch the live profile before confirm.
    profiles.current = { name: 'staging', dir: '/profiles/staging' }
    const result = await handleInstallConfirm(deps, { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' })
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') throw new Error('unreachable')
    expect(result.status).toBe(409)
    expect(result.reason).toBe('profile-changed')
    expect(pnpm.calls).toHaveLength(0)
  })

  it('confirm returns 409 when snapshot.fetchedAt drifted', async () => {
    const { deps, pnpm } = makeDeps({})
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(deps, {
      token,
      snapshotFetchedAt: '2026-08-17T09:00:00Z', // drifted
    })
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') throw new Error('unreachable')
    expect(result.status).toBe(409)
    expect(result.reason).toBe('snapshot-refreshed')
    expect(pnpm.calls).toHaveLength(0)
  })

  it('confirm returns 409 when TTL expired', async () => {
    const { deps, pnpm } = makeDeps({})
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
      now: () => 0,
    })
    const result = await handleInstallConfirm(deps, { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' })
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') throw new Error('unreachable')
    expect(result.status).toBe(409)
    expect(result.reason).toBe('ttl-expired')
    expect(pnpm.calls).toHaveLength(0)
  })
})