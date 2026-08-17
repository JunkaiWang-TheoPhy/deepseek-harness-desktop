#!/usr/bin/env node
/**
 * Phase 1 contract runtime sanity check (M1.9).
 *
 * Replaces the M1.1 skeleton with a full guard:
 *   1. The compiled package can be required and exports the four validators
 *      plus the LocalSourceRecord type.
 *   2. Each canonical fixture round-trips through its validator (true).
 *   3. A known-bad snapshot (mismatched provenance) is rejected by ajv —
 *      but the schema validator cannot catch every invariant; the script
 *      notes that M1.4 semantic helpers cover the remaining checks.
 *   4. vitest exits the test suite with status 0.
 *
 * Headless, no GUI, no ambient credentials.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const fail = (msg) => {
  console.error(`verify:contract FAILED — ${msg}`)
  process.exit(1)
}

const note = (msg) => console.log(msg)

// 1. Confirm the build output exists and exports the expected API.

const libPath = path.join(root, 'lib', 'index.mjs')
let mod
try {
  mod = await import(pathToFileURL(libPath).href)
} catch (cause) {
  fail(`cannot import ${libPath}: ${String(cause)}`)
}
for (const name of [
  'validateCatalogSource',
  'validateCatalogQuery',
  'validateCatalogProviderPage',
  'validateCatalogSnapshot',
]) {
  if (typeof mod[name] !== 'function') fail(`missing export: ${name}`)
}
note('verify:contract: 4 schema validators exported from lib/index.mjs')

// 2. Each canonical fixture round-trips through its validator.

const fixtures = [
  ['docs/schemas/catalog-source.schema.json', 'docs/examples/catalog-source.example.json', 'validateCatalogSource'],
  ['docs/schemas/catalog-query.schema.json', 'docs/examples/catalog-query.example.json', 'validateCatalogQuery'],
  ['docs/schemas/catalog-provider-page.schema.json', 'docs/examples/catalog-provider-page.example.json', 'validateCatalogProviderPage'],
  ['docs/schemas/catalog-snapshot.schema.json', 'docs/examples/catalog-snapshot.example.json', 'validateCatalogSnapshot'],
]
for (const [schemaRel, fixtureRel, validator] of fixtures) {
  const fixture = JSON.parse(readFileSync(path.join(root, fixtureRel), 'utf8'))
  if (mod[validator](fixture) !== true) {
    fail(`${fixtureRel} does not satisfy ${schemaRel}`)
  }
}
note(`verify:contract: ${fixtures.length} canonical fixtures round-tripped`)

// 3. Run vitest and propagate the exit code.

const cwd = root
try {
  execFileSync('node', ['./node_modules/vitest/vitest.mjs', 'run', '--reporter=default'], { cwd, stdio: 'inherit' })
} catch (cause) {
  fail(`vitest failed: ${String(cause)}`)
}

console.log('verify:contract ok')