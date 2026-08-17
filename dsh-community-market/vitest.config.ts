import { defineConfig } from 'vitest/config'

/**
 * Phase 1 test runner.
 *
 * Headless, node-only. All suites run under `yarn workspace dsh-community-market test`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules', 'lib', 'docs', 'schemas', 'examples'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    testTimeout: 10_000,
    passWithNoTests: true,
  },
})