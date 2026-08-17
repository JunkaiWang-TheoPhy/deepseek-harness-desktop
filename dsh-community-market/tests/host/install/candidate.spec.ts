/**
 * Phase 4 M4.4 install candidate resolver tests — T-03, T-11.
 */
import { describe, expect, it } from 'vitest'
import { resolveCandidate } from '../../../src/host/install/candidate.js'
import { IdentityError } from '../../../src/host/install/errors.js'

const item = {
  id: 'better-sidebar',
  displayName: 'Better Sidebar',
  package: { registry: 'npm' as const, name: 'dsh-plugin-better-sidebar', latestVersion: '1.2.0' },
  repository: {
    url: 'https://github.com/example/dsh-plugin-better-sidebar',
    commit: 'a'.repeat(40),
  },
}

describe('resolveCandidate (T-03, T-11)', () => {
  it('returns a conflict when both identities are present and no choice is given', () => {
    const result = resolveCandidate(item, undefined)
    expect(result.kind).toBe('conflict')
  })

  it('resolves to npm when both identities are present and choice is npm', () => {
    const result = resolveCandidate(item, 'npm')
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.choice).toBe('npm')
      expect(result.target.spec).toBe('dsh-plugin-better-sidebar@1.2.0')
    }
  })

  it('resolves to repository when both identities are present and choice is repository', () => {
    const result = resolveCandidate(item, 'repository')
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.choice).toBe('repository')
      expect(result.target.spec.startsWith('git+https://github.com/')).toBe(true)
    }
  })

  it('rejects an invalid choice for the available identities', () => {
    expect(() => resolveCandidate({
      ...item,
      repository: undefined,
    }, 'repository')).toThrow(IdentityError)
  })

  it('rejects item with neither identity', () => {
    expect(() => resolveCandidate({
      id: 'a', displayName: 'A',
    }, undefined)).toThrow(/identity-missing/)
  })
})