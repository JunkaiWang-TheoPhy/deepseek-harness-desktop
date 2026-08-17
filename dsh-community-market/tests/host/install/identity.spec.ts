/**
 * Phase 4 M4.3 identity resolver tests — T-01 / T-02 / T-03.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveNpmTarget,
  resolveGitTarget,
  isInstallTarget,
} from '../../../src/host/install/identity.js'
import { IdentityError } from '../../../src/host/install/errors.js'

describe('resolveNpmTarget (T-01)', () => {
  it('accepts strict SemVer', () => {
    const target = resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: '1.2.0' })
    expect(target.spec).toBe('dsh-plugin-x@1.2.0')
    expect(target.kind).toBe('npm')
  })

  it('accepts SemVer pre-release', () => {
    const target = resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: '1.2.0-beta.1' })
    expect(target.spec).toBe('dsh-plugin-x@1.2.0-beta.1')
  })

  it('rejects dist-tag latest', () => {
    expect(() => resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: 'latest' }))
      .toThrow(IdentityError)
    try { resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: 'latest' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-version-not-semver') }
  })

  it('rejects caret range', () => {
    expect(() => resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: '^1.2.0' }))
      .toThrow(IdentityError)
  })

  it('rejects tilde range', () => {
    try { resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: '~1.2.0' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-version-not-semver') }
  })

  it('rejects wildcard', () => {
    try { resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: '*' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-version-not-semver') }
  })

  it('rejects dist-tag other than latest (e.g. next)', () => {
    try { resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x', latestVersion: 'next' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-version-not-semver') }
  })

  it('rejects missing latestVersion', () => {
    try { resolveNpmTarget({ registry: 'npm', name: 'dsh-plugin-x' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-version-not-semver') }
  })

  it('rejects invalid npm name', () => {
    try { resolveNpmTarget({ registry: 'npm', name: 'BAD NAME!', latestVersion: '1.2.0' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('npm-name-invalid') }
  })
})

describe('resolveGitTarget (T-02)', () => {
  it('accepts an immutable commit', () => {
    const commit = 'a'.repeat(40)
    const target = resolveGitTarget({ url: 'https://github.com/o/r.git', commit })
    expect(target.spec).toBe(`git+https://github.com/o/r.git#${commit}`)
    expect(target.kind).toBe('git')
  })

  it('rejects repository without commit', () => {
    try { resolveGitTarget({ url: 'https://github.com/o/r.git' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('no-immutable-ref') }
  })

  it('rejects branch reference', () => {
    try { resolveGitTarget({ url: 'https://github.com/o/r', ref: 'main' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('mutable-ref') }
  })

  it('rejects tag reference', () => {
    try { resolveGitTarget({ url: 'https://github.com/o/r', tag: 'v1.2.0' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('mutable-ref') }
  })

  it('rejects short SHA', () => {
    try { resolveGitTarget({ url: 'https://github.com/o/r', commit: 'abc123' }) }
    catch (e) { expect((e as IdentityError).reason).toBe('commit-format-invalid') }
  })

  it('rejects uppercase hex', () => {
    try { resolveGitTarget({ url: 'https://github.com/o/r', commit: 'A'.repeat(40) }) }
    catch (e) { expect((e as IdentityError).reason).toBe('commit-format-invalid') }
  })
})

describe('isInstallTarget', () => {
  it('recognizes npm and git targets', () => {
    expect(isInstallTarget({ kind: 'npm', spec: 'a@1.0.0', name: 'a', version: '1.0.0' })).toBe(true)
    expect(isInstallTarget({ kind: 'git', spec: 'git+https://x#a', url: 'https://x', commit: 'a' })).toBe(true)
  })

  it('rejects unknown shapes', () => {
    expect(isInstallTarget(null)).toBe(false)
    expect(isInstallTarget({ kind: 'evil', spec: 'rm -rf /' })).toBe(false)
    expect(isInstallTarget({ kind: 'npm' })).toBe(false)
  })
})