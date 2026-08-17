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
  // Node.js library: keep runtime deps as `require()`/`import` at the call site.
  // Bundling ajv (with fast-uri re-export of the DOM `URIComponent` type) trips
  // rolldown-plugin-dts, and Node apps have the deps installed anyway.
  deps: {
    neverBundle: ['ajv', 'ajv-formats', 'fast-uri'],
  },
})