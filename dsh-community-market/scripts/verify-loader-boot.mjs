#!/usr/bin/env node
/**
 * Phase 3 Loader boot smoke.
 *
 * Confirms that the published package can be `import`-ed and that the
 * runtime surface (validators, semantic checks, identity normalization,
 * query serialization, adapters, registry, cache, aggregator, restricted
 * HTTP client, route dispatch) is present.
 *
 * The full Loader tree integration (Host entry point, Client slot
 * registration) is verified by `dsh-plugin-desktop` once Phase 6 wires
 * Market into the packaged bundle. This script is the headless, source-
 * less counterpart.
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const fail = (msg) => {
  console.error(`verify:loader FAILED — ${msg}`)
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const libPath = path.join(here, '..', 'lib', 'index.mjs')

let mod
try {
  mod = await import(pathToFileURL(libPath).href)
} catch (cause) {
  fail(`cannot import ${libPath}: ${String(cause)}`)
}

const required = [
  'validateCatalogSource',
  'validateCatalogQuery',
  'validateCatalogProviderPage',
  'validateCatalogSnapshot',
  'serializeCatalogQuery',
  'applyQueryToUrl',
  'normalizeNpmName',
  'normalizeRepositoryUrl',
  'normalizeRepositorySubdirectory',
  'composeLocalSourceRecord',
  'validateAddInput',
  'validateRecordCoherence',
  'checkProviderPageItemIdUniqueness',
  'checkQueryAgainstManifest',
  'checkSnapshotProvenanceConsistency',
  'declaresBothNpmAndRepository',
  'PersistedCatalogSourceStore',
  'DefaultSourceRegistry',
  'CatalogSnapshotCache',
  'CatalogAggregator',
  'RestrictedHttpClient',
  'StandardHttpJsonAdapter',
  'Dsh1024StoreAdapter',
  'buildMarketHandle',
  'buildBuiltInAdapters',
  'dispatchMarketRequest',
]

for (const name of required) {
  const v = mod[name]
  if (v === undefined) fail(`missing export: ${name}`)
  if (typeof v !== 'function' && typeof v !== 'object') {
    fail(`${name} has unexpected type ${typeof v}`)
  }
}

console.log(`verify:loader: ${required.length} runtime exports present`)
console.log('verify:loader ok')