/**
 * DSH Community Market — Phase 1 contract runtime entry.
 *
 * M1.2: schema validators (compiled once at module load, format-asserted).
 * Landed in subsequent milestones:
 *   M1.3  TypeScript contract types
 *   M1.4  semantic validation helpers
 *   M1.5  query serialization
 *   M1.6  identity normalization
 *   M1.7  CatalogAdapter interface
 *   M1.8  CatalogSourceStore interface
 */
export {
  validateCatalogSource,
  validateCatalogQuery,
  validateCatalogProviderPage,
  validateCatalogSnapshot,
} from './contracts/schemas.js'

export {
  applyQueryToUrl,
  cursorBelongsTo,
  serializeCatalogQuery,
} from './catalog/query.js'

export {
  normalizeNpmName,
  normalizeRepositorySubdirectory,
  normalizeRepositoryUrl,
} from './catalog/identity.js'

export {
  checkProviderPageItemIdUniqueness,
  checkQueryAgainstManifest,
  checkSnapshotProvenanceConsistency,
  declaresBothNpmAndRepository,
} from './contracts/semantic.js'

export type {
  AdapterId,
  CatalogProviderPage,
  CatalogProviderPageItem,
  CatalogQuery,
  CatalogQueryField,
  CatalogQuerySort,
  CatalogSnapshot,
  CatalogSnapshotItem,
  CatalogSnapshotSource,
  CatalogSourceManifest,
  LocalSourceRecord,
  NpmPackage,
  PluginCapabilityList,
  PluginCompatibility,
  PluginPublisher,
  ProviderId,
  Repository,
  SourceRecordId,
} from './contracts/types.js'