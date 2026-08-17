import { defineConfig } from 'tsdown'

/**
 * Phase 1 build: bundle the contract runtime entry.
 *
 * M1.1 skeleton. M1.2+ adds src/contracts and src/catalog as additional entries.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
})