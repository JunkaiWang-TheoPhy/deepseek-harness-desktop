/**
 * Phase 4 M4.5 + M4.6 preview + confirm tests — T-04, T-05, T-08, T-09.
 */
import { describe, expect, it } from 'vitest'
import {
  buildConfirmToken,
  buildInstallPreview,
  CONFIRM_TOKEN_DEFAULT_TTL_MS,
} from '../../../src/host/install/preview.js'
import { recheckConfirm } from '../../../src/host/install/confirm.js'
import { StaleConfirmationError } from '../../../src/host/install/errors.js'

const base = {
  sourceRecordId: 'src-1',
  itemId: 'better-sidebar',
  choice: 'npm' as const,
  target: { kind: 'npm' as const, name: 'dsh-plugin-better-sidebar', version: '1.2.0', spec: 'dsh-plugin-better-sidebar@1.2.0' },
  profile: { name: 'default', dir: '/profiles/default' },
  generation: { id: 'gen-1' },
  fetchedAt: '2026-08-17T08:00:00Z',
}

const make = (now = 1000) => buildConfirmToken({ ...base, now: () => now })

describe('buildConfirmToken', () => {
  it('issues a token with default 30s TTL', () => {
    const token = make(1000)
    expect(token.expiresAt - token.issuedAt).toBe(CONFIRM_TOKEN_DEFAULT_TTL_MS)
  })

  it('respects custom TTL', () => {
    const token = buildConfirmToken({ ...base, ttlMs: 5_000, now: () => 1000 })
    expect(token.expiresAt - token.issuedAt).toBe(5_000)
  })
})

describe('buildInstallPreview', () => {
  it('includes the lifecycle warning verbatim', () => {
    const preview = buildInstallPreview({
      item: { id: 'a', name: 'pkg-a', displayName: 'Pkg A', summary: 'Test' },
      source: { sourceRecordId: 'src-1', providerId: 'org.example' },
      target: { kind: 'npm', name: 'pkg-a', version: '1.0.0', spec: 'pkg-a@1.0.0' },
      profile: { name: 'default', dir: '/p' },
      lifecycleWarning: 'package 安装可能执行 lifecycle script',
    })
    expect(preview.lifecycleWarning).toContain('lifecycle')
    expect(preview.target.spec).toBe('pkg-a@1.0.0')
  })
})

describe('recheckConfirm (T-04, T-05, T-09)', () => {
  it('accepts when nothing changed', () => {
    const token = make(1000)
    expect(() => recheckConfirm({
      token,
      currentProfile: base.profile,
      currentGeneration: base.generation,
      currentFetchedAt: base.fetchedAt,
      now: () => 2000,
    })).not.toThrow()
  })

  it('rejects profile change', () => {
    const token = make(1000)
    expect(() => recheckConfirm({
      token,
      currentProfile: { name: 'staging', dir: '/profiles/staging' },
      currentGeneration: base.generation,
      currentFetchedAt: base.fetchedAt,
      now: () => 2000,
    })).toThrow(StaleConfirmationError)
  })

  it('rejects generation change', () => {
    const token = make(1000)
    expect(() => recheckConfirm({
      token,
      currentProfile: base.profile,
      currentGeneration: { id: 'gen-2' },
      currentFetchedAt: base.fetchedAt,
      now: () => 2000,
    })).toThrow(StaleConfirmationError)
  })

  it('rejects snapshot refresh', () => {
    const token = make(1000)
    expect(() => recheckConfirm({
      token,
      currentProfile: base.profile,
      currentGeneration: base.generation,
      currentFetchedAt: '2026-08-17T09:00:00Z',
      now: () => 2000,
    })).toThrow(StaleConfirmationError)
  })

  it('rejects TTL expiry', () => {
    const token = make(1000)
    expect(() => recheckConfirm({
      token,
      currentProfile: base.profile,
      currentGeneration: base.generation,
      currentFetchedAt: base.fetchedAt,
      now: () => 1000 + CONFIRM_TOKEN_DEFAULT_TTL_MS + 1,
    })).toThrow(StaleConfirmationError)
  })
})