/**
 * Schema compilation for the DSH Community Market contract.
 *
 * Compiles the four catalog schemas (source manifest, normalized query,
 * provider page wire response, normalized snapshot) with ajv Draft 2020-12
 * and ajv-formats. `format` is enforced as a hard assertion — see
 * catalog-provider-contract §"版本与 schema 权威性".
 *
 * Validators are exported for use by Host, adapters, snapshot builders,
 * verify:contract, and tests. They accept unknown input and return boolean.
 * Callers that need typed results should pair these with the hand-written
 * contract types in `src/contracts/types.ts` (M1.3).
 */
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import catalogSourceSchemaJson from '../../docs/schemas/catalog-source.schema.json'
import catalogQuerySchemaJson from '../../docs/schemas/catalog-query.schema.json'
import catalogProviderPageSchemaJson from '../../docs/schemas/catalog-provider-page.schema.json'
import catalogSnapshotSchemaJson from '../../docs/schemas/catalog-snapshot.schema.json'

/** ajv instance configured for the four catalog schemas. */
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
})
addFormats(ajv)

/** Compiled validator for the catalog source manifest schema. */
export const validateCatalogSource: ValidateFunction<unknown> =
  ajv.compile(catalogSourceSchemaJson)

/** Compiled validator for the normalized catalog query schema. */
export const validateCatalogQuery: ValidateFunction<unknown> =
  ajv.compile(catalogQuerySchemaJson)

/** Compiled validator for the standard HTTPS provider wire response schema. */
export const validateCatalogProviderPage: ValidateFunction<unknown> =
  ajv.compile(catalogProviderPageSchemaJson)

/** Compiled validator for the normalized snapshot schema (Host-injected provenance). */
export const validateCatalogSnapshot: ValidateFunction<unknown> =
  ajv.compile(catalogSnapshotSchemaJson)