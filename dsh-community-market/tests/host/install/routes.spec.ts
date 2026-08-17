/**
 * Phase 4 / Phase 5 install route smoke tests.
 *
 * M5.5: pure-function route handlers are exercised against mock
 * `desktopProfiles` / `desktopPnpm` services. No DSH harness needed.
 */
import { describe, expect, it } from 'vitest'
import {
  handleInstallPreview,
  handleInstallConfirm,
  missingCapability,
  type DesktopPnpmLike,
  type InstallRouteDeps,
} from '../../../src/host/install/routes.js'
import { staticGeneration } from '../../../src/host/install/profile.js'
import {
  buildConfirmToken,
} from '../../../src/host/install/preview.js'
import {
  IdentityError,
  StaleConfirmationError,
} from '../../../src/host/install/errors.js'

const item = {
  id: 'better-sidebar',
  name: 'dsh-plugin-better-sidebar',
  displayName: 'Better Sidebar',
  summary: 'Sidebar plugin',
  package: { registry: 'npm' as const, name: 'dsh-plugin-better-sidebar', latestVersion: '1.2.0' },
  repository: {
    url: 'https://github.com/example/dsh-plugin-better-sidebar',
    commit: 'a'.repeat(40),
  },
}

/** npm-only fixture for tests that pre-decide the identity. */
const npmOnlyItem = {
  id: 'better-sidebar',
  name: 'dsh-plugin-better-sidebar',
  displayName: 'Better Sidebar',
  summary: 'Sidebar plugin',
  package: { registry: 'npm' as const, name: 'dsh-plugin-better-sidebar', latestVersion: '1.2.0' },
}

function makePnpm(overrides: Partial<DesktopPnpmLike> = {}): DesktopPnpmLike {
  return {
    run: () => ({ done: Promise.resolve({ exitCode: 0, signal: null }) }),
    runPlugin: () => ({ done: Promise.resolve({ exitCode: 0, signal: null }) }),
    ...overrides,
  }
}

function makeDeps(overrides: Partial<InstallRouteDeps> = {}): InstallRouteDeps {
  return {
    services: {
      profiles: { current: { name: 'default', dir: '/profiles/default' } },
      pnpm: makePnpm(),
      generation: staticGeneration('gen-1'),
    },
    invokingDir: '/profiles/default',
    ...overrides,
  }
}

const basePreviewBody = {
  sourceRecordId: 'src-1',
  itemId: 'better-sidebar',
  lifecycleWarning: 'package 安装可能执行 lifecycle script',
  snapshot: {
    fetchedAt: '2026-08-17T08:00:00Z',
    source: { providerId: 'org.example' },
    items: [item],
  },
}

describe('missingCapability (M5.4)', () => {
  it('returns null when all services present', () => {
    expect(missingCapability({ profiles: {} as never, pnpm: {} as never, generation: () => ({ id: 'g' }) })).toBe(null)
  })
  it('reports missing profiles', () => {
    expect(missingCapability({ pnpm: {} as never, generation: () => ({ id: 'g' }) })).toBe('desktopProfiles')
  })
  it('reports missing pnpm', () => {
    expect(missingCapability({ profiles: {} as never, generation: () => ({ id: 'g' }) })).toBe('desktopPnpm')
  })
})

describe('handleInstallPreview', () => {
  it('returns preview + token for npm-only item', async () => {
    const result = await handleInstallPreview(makeDeps(), {
      ...basePreviewBody,
      snapshot: { ...basePreviewBody.snapshot, items: [npmOnlyItem] },
    })
    expect(result.kind).toBe('ok-preview')
    if (result.kind === 'ok-preview') {
      expect(result.token.target.kind).toBe('npm')
      expect(result.token.target.spec).toBe('dsh-plugin-better-sidebar@1.2.0')
      expect(result.preview.lifecycleWarning).toContain('lifecycle')
    }
  })

  it('returns 404 when item is not in the snapshot', async () => {
    const result = await handleInstallPreview(makeDeps(), { ...basePreviewBody, itemId: 'phantom' })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(404)
      expect(result.reason).toBe('item-not-found')
    }
  })

  it('returns 409 conflict when both identities present and no choice given', async () => {
    const result = await handleInstallPreview(makeDeps(), basePreviewBody)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(409)
      expect(result.reason).toBe('identity-choice-required')
    }
  })

  it('returns 400 when npm identity fails strict SemVer', async () => {
    const badItem = {
      ...item,
      package: { registry: 'npm' as const, name: 'dsh-plugin-better-sidebar', latestVersion: 'latest' },
    }
    const result = await handleInstallPreview(makeDeps(), {
      ...basePreviewBody,
      identityChoice: 'npm',
      snapshot: {
        ...basePreviewBody.snapshot,
        items: [badItem],
      },
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.reason).toBe('npm-version-not-semver')
  })
})

describe('handleInstallConfirm', () => {
  it('runs desktopPnpm.runPlugin on a fresh token', async () => {
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(makeDeps(), { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' })
    expect(result.kind).toBe('ok-confirm')
    if (result.kind === 'ok-confirm') expect(result.exitCode).toBe(0)
  })

  it('returns 409 when profile changed', async () => {
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(
      makeDeps({
        services: {
          profiles: { current: { name: 'staging', dir: '/profiles/staging' } },
          pnpm: makePnpm(),
          generation: staticGeneration('gen-1'),
        },
      }),
      { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' },
    )
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(409)
      expect(result.reason).toBe('profile-changed')
    }
  })

  it('returns 409 when snapshot refreshed', async () => {
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(makeDeps(), { token, snapshotFetchedAt: '2026-08-17T09:00:00Z' })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.reason).toBe('snapshot-refreshed')
  })

  it('returns 409 when TTL expired', async () => {
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
    const result = await handleInstallConfirm(makeDeps({ invokingDir: '/profiles/default' }), { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.reason).toBe('ttl-expired')
  })

  it('reports a non-zero exit code from runPlugin', async () => {
    const token = buildConfirmToken({
      sourceRecordId: 'src-1',
      itemId: 'better-sidebar',
      choice: 'npm',
      target: { kind: 'npm', name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
      profile: { name: 'default', dir: '/profiles/default' },
      generation: { id: 'gen-1' },
      fetchedAt: '2026-08-17T08:00:00Z',
    })
    const result = await handleInstallConfirm(
      makeDeps({ services: {
        profiles: { current: { name: 'default', dir: '/profiles/default' } },
        pnpm: makePnpm({ runPlugin: () => ({ done: Promise.resolve({ exitCode: 1, signal: null }) }) }),
        generation: staticGeneration('gen-1'),
      } }),
      { token, snapshotFetchedAt: '2026-08-17T08:00:00Z' },
    )
    expect(result.kind).toBe('ok-confirm')
    if (result.kind === 'ok-confirm') expect(result.exitCode).toBe(1)
  })
})