/**
 * Schemastery schema for the `dsh-community-market` settings namespace.
 *
 * Stored as a single object `{ sources: LocalSourceRecord[] }`. Per
 * catalog-provider-contract §"本地状态边界": the namespace is the only
 * place where `enabled`, `order`, and `sourceRecordId` live; remote
 * manifests never write here.
 *
 * Schemastery accepts any subset of declared fields; the optional ones
 * (`manifestUrl`, `builtInProviderKey`) and the runtime invariant
 * "exactly one of them is set" are enforced by `validateRecordCoherence`
 * at write time, not at schema level.
 */
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const DSH_COMMUNITY_MARKET_NAMESPACE = settingsNamespace('dsh-community-market')

export interface DshCommunityMarketSettingsValue {
  readonly sources: readonly {
    readonly sourceRecordId: string
    readonly registrationKind: 'user-added' | 'built-in'
    readonly adapterId: string
    readonly providerId: string
    readonly manifestUrl?: string
    readonly builtInProviderKey?: string
    readonly enabled: boolean
    readonly order: number
  }[]
}

const sourceRecordSchema = z.object({
  sourceRecordId: z.string(),
  registrationKind: z.union(['user-added', 'built-in'] as const),
  adapterId: z.string(),
  providerId: z.string(),
  manifestUrl: z.string(),
  builtInProviderKey: z.string(),
  enabled: z.boolean(),
  order: z.number(),
})

export const dshCommunityMarketSchema = z.object({
  sources: z.array(sourceRecordSchema),
})