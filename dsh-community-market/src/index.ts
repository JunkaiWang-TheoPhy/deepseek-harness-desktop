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

export type { CatalogAdapter, CatalogAdapterFetchContext } from './contracts/adapter.js'

export {
  composeLocalSourceRecord,
  defaultSourceRecordIdFactory,
  validateAddInput,
  validateRecordCoherence,
} from './contracts/source-store.js'
export type {
  AddSourceResult,
  CatalogSourceStore,
  LocalSourceRecordInput,
  SourceRecordIdFactory,
} from './contracts/source-store.js'

export { RestrictedHttpClient } from './host/http-client.js'
export {
  buildBuiltInAdapters,
  buildMarketHandle,
  dispatchMarketRequest,
  MARKET_ROUTE_PREFIX,
} from './host/routes.js'
export type { MarketHostHandle } from './host/routes.js'
export {
  apply as applyMarketHost,
  name as marketHostName,
  inject as marketHostInject,
  Config as MarketHostConfigSchema,
} from './host/plugin.js'
export type { Config as MarketHostConfig } from './host/plugin.js'
export {
  IdentityError,
  StaleConfirmationError,
  isIdentityError,
} from './host/install/errors.js'
export type { IdentityErrorReason, StaleConfirmationErrorReason } from './host/install/errors.js'
export {
  resolveNpmTarget,
  resolveGitTarget,
  assertStrictSemVer,
  assertNpmName,
  assertImmutableCommit,
  isInstallTarget,
} from './host/install/identity.js'
export type { InstallTarget, NpmTarget, GitTarget, IdentityInput } from './host/install/identity.js'
export { resolveCandidate } from './host/install/candidate.js'
export type { Candidate, CandidateResolved, CandidateConflict, CandidateItem, IdentityChoice } from './host/install/candidate.js'
export { buildConfirmToken, buildInstallPreview, CONFIRM_TOKEN_DEFAULT_TTL_MS } from './host/install/preview.js'
export type { ConfirmToken, InstallPreview, ProfileSnapshot, GenerationSnapshot } from './host/install/preview.js'
export { recheckConfirm } from './host/install/confirm.js'
export type { RecheckInput } from './host/install/confirm.js'
export { PersistedCatalogSourceStore } from './host/store-impl.js'
export { SettingsKvStorage } from './host/settings-storage.js'
export { DefaultSourceRegistry } from './host/registry.js'
export { CatalogSnapshotCache } from './host/cache.js'
export { CatalogAggregator } from './host/aggregate.js'
export type { SourceInput, SourceOutcome, AggregateResult } from './host/aggregate.js'
export { StandardHttpJsonAdapter } from './host/adapters/standard.js'
export { Dsh1024StoreAdapter } from './host/adapters/dsh-1024store.js'
export {
  RestrictedHttpError,
  isRestrictedHttpError,
} from './host/http-errors.js'
export type {
  RestrictedHttpClientHooks,
  RestrictedHttpClientOptions,
} from './host/http-client.js'
export type { RestrictedHttpErrorReason } from './host/http-errors.js'
export {
  defaultAggregateBudgets,
  defaultCacheBudgets,
  defaultHttpBudgets,
} from './host/constants.js'
export type {
  AggregateBudgets,
  CacheBudgets,
  RestrictedHttpBudgets,
} from './host/constants.js'

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