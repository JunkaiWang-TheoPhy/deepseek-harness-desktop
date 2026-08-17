/**
 * Phase 1 M1.6 identity normalization tests.
 *
 * Each rule from catalog-provider-contract §"安全要求" and the schema
 * patterns gets its own positive / negative case.
 */
import { describe, expect, it } from 'vitest'
import {
  normalizeNpmName,
  normalizeRepositorySubdirectory,
  normalizeRepositoryUrl,
} from '../../src/catalog/identity.js'

describe('normalizeNpmName', () => {
  it('accepts and lowercases an unscoped name', () => {
    const result = normalizeNpmName('Better-Sidebar')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('better-sidebar')
  })

  it('accepts and lowercases a scoped name', () => {
    const result = normalizeNpmName('@Some-Scope/Plugin')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('@some-scope/plugin')
  })

  it('rejects names containing upper-case characters that lower to invalid', () => {
    // npm spec forbids characters outside [a-z0-9._-] even when uppercased
    const result = normalizeNpmName('Bad Name')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('pattern')
  })

  it('rejects names exceeding the 214-character npm limit', () => {
    const tooLong = 'a'.repeat(215)
    const result = normalizeNpmName(tooLong)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('length')
  })

  it('rejects empty input', () => {
    const result = normalizeNpmName('')
    expect(result.ok).toBe(false)
  })
})

describe('normalizeRepositoryUrl', () => {
  it('accepts and lowercases an HTTPS URL', () => {
    const result = normalizeRepositoryUrl('https://GitHub.com/Owner/Repo')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('https://github.com/Owner/Repo')
  })

  it('rejects fragments', () => {
    const result = normalizeRepositoryUrl('https://github.com/owner/repo#readme')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('fragment')
  })

  it('rejects HTTP (non-HTTPS) URLs', () => {
    const result = normalizeRepositoryUrl('http://github.com/owner/repo')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('scheme')
  })

  it('rejects credentials in the authority', () => {
    const result = normalizeRepositoryUrl('https://user:pass@github.com/owner/repo')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('credentials')
  })

  it('rejects unparseable input', () => {
    const result = normalizeRepositoryUrl('not-a-url')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('parse')
  })

  it('collapses a bare host trailing slash', () => {
    const result = normalizeRepositoryUrl('https://example.com/')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('https://example.com')
  })
})

describe('normalizeRepositorySubdirectory', () => {
  it('accepts a normal relative subdirectory', () => {
    const result = normalizeRepositorySubdirectory('packages/plugin')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('packages/plugin')
  })

  it('rejects an absolute path', () => {
    const result = normalizeRepositorySubdirectory('/etc/pass')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('absolute')
  })

  it('rejects a parent-traversal segment', () => {
    const result = normalizeRepositorySubdirectory('../escape')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('parent-segment')
  })

  it('rejects a parent-traversal segment in the middle of the path', () => {
    const result = normalizeRepositorySubdirectory('packages/../escape')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('parent-segment')
  })

  it('rejects backslashes', () => {
    const result = normalizeRepositorySubdirectory('packages\\plugin')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('backslash')
  })

  it('rejects empty input', () => {
    const result = normalizeRepositorySubdirectory('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty')
  })
})