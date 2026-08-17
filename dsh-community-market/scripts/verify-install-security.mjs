#!/usr/bin/env node
/**
 * Phase 4 M4.7 verify:install-security.
 *
 * Runs the security matrix as a single command. Internally this shells
 * out to vitest with the install test files; if any denial path fails,
 * the script exits non-zero so CI / `yarn check` blocks the merge.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

try {
  execFileSync(
    'node',
    [
      path.join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      'tests/host/install/',
      '--reporter=default',
    ],
    { cwd: root, stdio: 'inherit' },
  )
} catch (cause) {
  console.error('verify:install-security FAILED — see vitest output above')
  process.exit(1)
}

console.log('verify:install-security ok')