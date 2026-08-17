#!/usr/bin/env node
/**
 * Contract runtime sanity check (M1.1 skeleton; M1.9 replaces with real checks).
 *
 * For M1.1 we only verify that all 4 schemas and 4 fixtures are present on disk
 * and parse as JSON. Real validation — ajv compilation, fixture round-trip,
 * semantic checks, identity normalization — lands in M1.2-M1.9.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const expected = [
  ['schema', 'docs/schemas/catalog-source.schema.json'],
  ['schema', 'docs/schemas/catalog-query.schema.json'],
  ['schema', 'docs/schemas/catalog-provider-page.schema.json'],
  ['schema', 'docs/schemas/catalog-snapshot.schema.json'],
  ['fixture', 'docs/examples/catalog-source.example.json'],
  ['fixture', 'docs/examples/catalog-query.example.json'],
  ['fixture', 'docs/examples/catalog-provider-page.example.json'],
  ['fixture', 'docs/examples/catalog-snapshot.example.json'],
]

let ok = true
for (const [kind, rel] of expected) {
  const abs = path.join(root, rel)
  if (!existsSync(abs)) {
    console.error(`missing ${kind}: ${rel}`)
    ok = false
    continue
  }
  try {
    const parsed = JSON.parse(readFileSync(abs, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) {
      console.error(`not an object: ${rel}`)
      ok = false
    }
  } catch (cause) {
    console.error(`JSON parse failed: ${rel}`)
    console.error(cause)
    ok = false
  }
}

if (!ok) {
  console.error('verify:contract FAILED')
  process.exit(1)
}

console.log('verify:contract ok (M1.1 skeleton: file presence + JSON parse)')