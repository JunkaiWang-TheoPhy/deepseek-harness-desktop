# Phase 2 — Source Registry + Networking + Adapters Delivery Report

> Format follows `dsh-community-market-handoff.md` §16.

## Result

Phase 2 (来源 registry + networking + adapter) completed. **128 vitest cases pass**; `yarn workspace dsh-community-market check` is green (build + typecheck + test + verify:contract + verify:docs).

## Stage

Phase 2 — 来源 registry + 网络 + adapter

## Branch

`codex/market-source-registry`

## Commits

| ID | Subject |
|---|---|
| `295d0d2265` | feat(market): M2.1 restricted HTTP client |
| `e7af67577c` | feat(market): M2.2-M2.7 source registry, networking, adapters, aggregation |

(M2.2-M2.7 landed as a single bundle because they form one cohesive layer — registry + persistence + cache + 2 adapters + aggregator — and the bundled commit makes the layering readable as a unit.)

## Push status

Not pushed (per §12 — feature branch held until Labs review).

## Modified files (Phase 2)

| Path | Purpose |
|---|---|
| `dsh-community-market/src/host/http-errors.ts` | `RestrictedHttpError` + reason union + type guard |
| `dsh-community-market/src/host/constants.ts` | default budgets: HTTP, cache, aggregator |
| `dsh-community-market/src/host/http-client.ts` | `RestrictedHttpClient` with URL/DNS/redirect/body validation |
| `dsh-community-market/src/host/kv-storage.ts` | `KvStorage` interface + `MemoryKvStorage` |
| `dsh-community-market/src/host/store-impl.ts` | `PersistedCatalogSourceStore` via `KvStorage` |
| `dsh-community-market/src/host/registry.ts` | `DefaultSourceRegistry` for built-in adapters |
| `dsh-community-market/src/host/cache.ts` | `CatalogSnapshotCache` (fresh + last-good TTL) |
| `dsh-community-market/src/host/aggregate.ts` | `CatalogAggregator` (worker pool, partial failure) |
| `dsh-community-market/src/host/adapters/standard.ts` | `StandardHttpJsonAdapter` for `https-json` source manifests |
| `dsh-community-market/src/host/adapters/dsh-1024store.ts` | `Dsh1024StoreAdapter` for the partner provider |
| `dsh-community-market/src/index.ts` | re-export the new runtime surface |
| `dsh-community-market/tests/host/http-client.spec.ts` | 18 cases for §11.3 network matrix |
| `dsh-community-market/tests/host/store-impl.spec.ts` | 6 cases (round-trip across storage instance) |
| `dsh-community-market/tests/host/registry.spec.ts` | 4 cases |
| `dsh-community-market/tests/host/cache.spec.ts` | 5 cases (TTL windows with injected clock) |
| `dsh-community-market/tests/host/adapters/standard.spec.ts` | 3 cases |
| `dsh-community-market/tests/host/adapters/dsh-1024store.spec.ts` | 4 cases |
| `dsh-community-market/tests/host/aggregate.spec.ts` | 4 cases |

## Verified (command : result)

- `corepack yarn workspace dsh-community-market build` : ok (4 files in `lib/`)
- `corepack yarn workspace dsh-community-market typecheck` : ok
- `corepack yarn workspace dsh-community-market test` : 128 passed (14 files)
- `corepack yarn workspace dsh-community-market verify:contract` : 4 validators exported, 4 fixtures round-trip, vitest 128/128
- `corepack yarn workspace dsh-community-market verify:docs` : 8 Markdown files, 4 bilingual pairs, 4 schemas consistent
- `corepack yarn workspace dsh-community-market check` : green

## Unverified (item : reason)

- Real `ctx.settings` adapter : Phase 3 wires the `KvStorage` interface to DSH settings service
- Real 1024Store API : adapter uses a documented partner response shape; real fixture pinned at integration time
- Real DNS / redirect handling : tests use injected fetch + resolveImpl, no live network
- Cache TTL in wall-clock time : tests use injected clock
- Aggregator behavior under concurrent abort : Phase 3 introduces the Host-owned AbortController
- DSH 1024Store partner smoke : per doc §14.3 "线上 provider 只能做显式可选 smoke，不能成为单元测试依赖"

## Security checks

- 远程输入 : `RestrictedHttpClient` URL preflight (scheme=https, no credentials, no fragment, no endpoint query); DNS preflight rejects loopback / private / link-local / multicast / unspecified / CGNAT / cloud-metadata (IPv4 + IPv6); strict redirects (each hop re-validated, max 5, HTTPS downgrade rejected); content-type must be `application/json`; body size capped (1 MiB gzip + 2 MiB decompressed defaults); schema validation runs before any data reaches the cache or adapter
- Renderer 边界 : N/A — Phase 2 ships Host-only; Client is Phase 3
- profile / mutation : N/A — Phase 2 ships read-only catalog aggregation
- 日志脱敏 : errors thrown by `RestrictedHttpClient` carry only `reason` + optional `detail`; never raw response bodies, paths, env, or tokens
- cancellation / teardown : `CatalogAggregator` propagates AbortSignal per source; `CatalogAdapterFetchContext.signal` honored; per-source worker tracks in-flight count and re-queues when per-source budget is full. Phase 3 introduces a Host-owned controller that replaces the per-fetch `AbortController`

## Package contents

- `npm pack --dry-run` : N/A — `private: true`, Phase 6 work
- THIRD_PARTY_NOTICES : Phase 6
- Direct new runtime deps (devDeps): `unrun` (added in M1.1 to satisfy tsdown's optional peer dep); `ajv`,` `ajv-formats`,` `tsdown`,` `typescript`,` `vitest`,` `@types/node` — all MIT
- Transitive: `fast-uri` (BSD-3-Clause, ajv), `fast-deep-equal` (MIT, ajv), `json-schema-traverse` (MIT, ajv)

## Known limitations

1. `RestrictedHttpClient.fetchJson` accepts query params via `options.query`; the endpoint URL must not carry its own query. The first revision had a parameter conflict that surfaced in the M2.5 test; resolved by splitting endpoint vs query into the options bag.
2. `CatalogAggregator.fetchOne` does not yet distinguish "ok stale" from "error" in the outcome kind — Phase 2 returns `kind: 'error'` whenever the fetch throws, even if a last-good cached entry exists. Phase 3 (Client) can surface stale fallbacks by re-reading the cache after a failure rather than introducing a new outcome shape.
3. `CatalogAggregator.fetchOne` creates a fresh `AbortController` per fetch instead of receiving a Host-owned one. Phase 3 plugs in the Host-owned controller; behavior is unchanged until that wiring lands.
4. `Dsh1024StoreAdapter` uses a fictional partner response shape; the real fixture is pinned when M2.6 follow-up lands. The translation rules are stable; only the field mapping may change.
5. `RestrictedHttpClient` connect/first-byte deadlines are folded into the total deadline via `AbortSignal.timeout`. Fine-grained first-byte enforcement (via streamed response body read) is a Phase 3 follow-up.
6. `CatalogSnapshotCache` is in-memory only; Phase 3 does not introduce persistence here because the cache is intentionally not durable (per-source fresh fetch is the source of truth).

## Anywhere Labs decisions needed

- §17-2 (storage service) : default is `ctx.settings` namespace `dsh-community-market`. Phase 3 PR description will restate this default; if Labs prefers a different namespace or a separate storage service, it surfaces at that PR.
- §17-3 (cache / concurrency budgets) : defaults applied (TTL 5 min, last-good 24 h, global 6 / per-source 2, body 1 MiB gzip / 2 MiB raw). Phase 2 PR description restates.
- §17-5 = B (preinstall + 1024Store default-enabled) : the DSH 1024Store adapter ships in Phase 2, but `DefaultSourceRegistry.registerBuiltIn` is the only built-in registration call so far. Phase 3 wires the default-enabled behavior from `LocalSourceRecord` rather than the registry, so this decision surfaces at that PR. The "no default source" contradiction tracked in task #8 remains Phase 6 work.

## Next-stage suggestion

Phase 3 (只读 Host + Client MVP) 启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ schemas/examples 已落本地
3. ✅ AGENTS.md 第 8 行的"Until runtime is implemented"前提因 Phase 1 落地 runtime 而自然失效；按用户指示**不修改** AGENTS.md
4. 新建 `codex/market-readonly-host` 分支
5. 实施 §14.4 prompt：
   - Host entry（普通 DSH Host plugin，`name = 'dsh-community-market'`，`inject = ['webServer', 'settings']`）
   - 把 `ctx.webServer` route `/v1/market/catalog` 暴露给 renderer
   - 写 `ctx.settings` namespace `dsh-community-market` 的 schemastery schema，把 `PersistedCatalogSourceStore` 通过 `KvStorage` 适配器接到 settings
   - Client entry（普通 DSH Web Client module），slot 注册走 `dsh-client-ui-slots`（§17-1 默认 sidebar item）
   - 来源管理 UI + 搜索 + 分类 + 详情 + 全部状态（loading / empty / offline / invalid / stale / retry）
   - 中英文 + 主题 + 键盘基础
   - Host/Client Loader smoke（§15 必填项）
   - 这是 Gate A 的验收点

§17-1/§17-6 在 Phase 3 PR 描述中再次确认默认值。

本 PR 进入 review 状态，等待 Anywhere Labs 评审 + §17 后续 phase 的默认值在 Phase 3+ PR 中再次确认。