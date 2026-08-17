# Phase 3 — Read-only Host + Client MVP Delivery Report

> Format follows `dsh-community-market-handoff.md` §16.

## Result

Phase 3 (只读 Host + Client MVP) structurally completed. **143 vitest cases pass**; `yarn workspace dsh-community-market check` is green (build + typecheck on both `tsconfig.json` and `tsconfig.client.json` + tests + verify:contract + verify:loader + verify:docs).

## Stage

Phase 3 — 只读 Host 与 Client MVP

## Branch

`codex/market-readonly-host`

## Commits

| ID | Subject |
|---|---|
| `10dd7b02e2` | feat(market): M3.1-M3.4 Host plugin entry + settings + routes |

(Phase 3 M3.5-M3.10 land as a single bundle because the Client entry, i18n bundle, three React components, and Loader smoke form one cohesive client-side deliverable.)

## Push status

Not pushed (per §12 — feature branch held until Labs review).

## Modified files (Phase 3)

| Path | Purpose |
|---|---|
| `dsh-community-market/package.json` | add Client deps (cordis, dsh-settings, dsh-host-webserver, dsh-client-runtime, dsh-client-ui-slots, dsh-client-ui-theme, dsh-client-locale, dsh-brand, dsh-invariants, dsh-typert-protocol, dsh-typert-registry, schemastery, react, @types/react); add `verify:loader` script; expand `typecheck` to cover both `tsconfig.json` and `tsconfig.client.json` |
| `dsh-community-market/tsconfig.client.json` | JSX-enabled client tsconfig; React types |
| `dsh-community-market/src/host/settings-schema.ts` | schemastery schema + namespace constant |
| `dsh-community-market/src/host/settings-storage.ts` | `SettingsKvStorage` adapter from `KvStorage` interface to the DSH settings service |
| `dsh-community-market/src/host/routes.ts` | `dispatchMarketRequest`, `buildMarketHandle`, `buildBuiltInAdapters`, route collection |
| `dsh-community-market/src/host/plugin.ts` | DSH Host plugin entry (`name/inject/apply`), Node `IncomingMessage` → Fetch adapter for routes |
| `dsh-community-market/src/client/entry.ts` | DSH Web Client entry: sidebar slot + 2 routes (catalog / sources) |
| `dsh-community-market/src/client/i18n.ts` | zh-CN + en bundle for sidebar, sources, catalog, state messages |
| `dsh-community-market/src/client/components/MarketPage.tsx` | browse UI: search, cards, status rail |
| `dsh-community-market/src/client/components/SourcesPage.tsx` | source management UI: add / enable / disable / remove |
| `dsh-community-market/src/client/components/StateView.tsx` | loading / empty / offline / invalid / partial / stale status component with per-source error list |
| `dsh-community-market/src/index.ts` | re-export the new Host + adapter classes |
| `dsh-community-market/scripts/verify-loader-boot.mjs` | verify:loader script — imports `lib/index.mjs` and asserts 26 runtime exports are present |
| `dsh-community-market/tests/host/routes.spec.ts` | 10 dispatch tests covering collection / item / catalog routes |
| `dsh-community-market/tests/host/settings-storage.spec.ts` | 5 storage bridge tests including round-trip across storage instance |

## Verified (command : result)

- `corepack yarn workspace dsh-community-market build` : ok (4 files in `lib/`)
- `corepack yarn workspace dsh-community-market typecheck` : ok (Host + Client tsconfigs)
- `corepack yarn workspace dsh-community-market test` : 143 passed (16 files)
- `corepack yarn workspace dsh-community-market verify:contract` : 4 validators exported, 4 fixtures round-trip, vitest 143/143
- `corepack yarn workspace dsh-community-market verify:loader` : 26 runtime exports present
- `corepack yarn workspace dsh-community-market verify:docs` : 8 Markdown files, 4 bilingual pairs, 4 schemas consistent
- `corepack yarn workspace dsh-community-market check` : green

## Unverified (item : reason)

- Real `ctx.webServer` / `ctx.settings` injection : Phase 3 wires the plugin shape and the IncomingMessage → Fetch adapter, but a real Loader tree run requires the DSH harness which depends on the deepseek-harness upstream submodule (`-` in `git submodule status`)
- Loader smoke against `dsh-plugin-desktop` : requires the dsh harness to compose the market plugin; the standalone `verify:loader` confirms 26 runtime exports
- Theme integration with `@deepseek-ai/dsh-client-ui-theme` : Phase 3 ships the client entry's slot registration; theme tokens consumed via the `ctx.theme` service in production
- Locale runtime with `@deepseek-ai/dsh-client-locale` : i18n bundle is shipped; the runtime t() resolution depends on the harness-injected i18n service
- Real network smoke against 1024Store partner API : Phase 2's adapter uses a documented shape; real fixture pinned in M2.6 follow-up

## Security checks

- 远程输入 : Phase 3 only consumes data already validated by Phase 2 adapters; route handlers coerce request bodies via `coerceRecordInput` and validate via `validateAddInput`. Errors return bounded `{ error: { reason, detail? } }` JSON, never raw body / path / token.
- Renderer 边界 : Client components live behind `tsconfig.client.json`; the entry imports `@deepseek-ai/dsh-client-runtime/client` and `@deepseek-ai/cordis-plugin-loader` only as type-only references. Components do not touch Node / Electron / fs / process / package-manager.
- profile / mutation : Phase 3 ships only source-management routes; no `desktopProfiles` / `desktopPnpm` references; `enabled` toggle is a Host-side flag that the aggregator uses to skip disabled sources, never a profile mutation.
- 日志脱敏 : no console logging added in Host or Client; the only error surfaces are JSON `reason` fields.
- cancellation / teardown : Host plugin uses `ctx.effect(...)` for the lifetime of the `marketHost` service registration; the effect disposer unregisters the slot on shutdown.

## Package contents

- `npm pack --dry-run` : N/A — `private: true`, Phase 6
- THIRD_PARTY_NOTICES : Phase 6
- New runtime/peer deps documented in `package.json` (all `@deepseek-ai/*` 0.1.0-rc.6 + `react 18.3.1`)

## Known limitations

1. The Host plugin's `WebServerServiceLike` / `SettingsServiceLike` are local interfaces that mirror DSH's contract; they let the plugin compile in isolation but the actual integration uses `@deepseek-ai/dsh-host-webserver` and `@deepseek-ai/dsh-settings` exports when composed. Phase 6 wiring lands in `dsh-plugin-desktop`.
2. The Client entry uses local `SlotRegistryLike` / `SessionRegistryLike` / `I18nLike` interfaces for the same reason. Real DSH types are pulled in via `@deepseek-ai/dsh-client-runtime/client` and `@deepseek-ai/dsh-client-ui-slots` once the harness composes the entry.
3. `MarketPage` and `SourcesPage` use lightweight inline styling only — visual polish (CSS classes, theme tokens, responsive layout) lands in a Phase 3 follow-up.
4. The catalog route handler builds `SourceInput[]` from `handle.manifests`; manifests are populated by the bootstrap from the source's persisted manifest URL. Phase 3 keeps the manifest map empty in tests; the production path requires the source-record bootstrap to fetch and cache manifests.

## Anywhere Labs decisions needed

- §17-1 (UI entry) : default `dsh-client-ui-slots` sidebar item "插件市场" applied. Phase 3 client entry registers `id: 'market-shell'` with two routes (`/market`, `/market/sources`). If Labs prefers command-palette entry or settings-page sub-item, the registration target changes; the entry itself stays the same shape.
- §17-2 (storage) : `ctx.settings` namespace `dsh-community-market` applied; Phase 3 ships `SettingsKvStorage` and `dshCommunityMarketSchema`. Phase 6 wires the bootstrap call.
- §17-6 (no remote images) : confirmed; Phase 3 uses inline first-letter icon placeholders, no `<img>` tags.
- §17-5 = B (preinstall + 1024Store default-enabled) : §17-5 conflict (task #8) is Phase 6 work; the Phase 3 host only registers built-in adapters, not their default-enabled state. The "default-enabled" behavior is a bootstrap decision driven by the LocalSourceRecord lifecycle, planned for Phase 6.

## Next-stage suggestion

Phase 4 (安装预览) 启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ schemas/examples 已落本地
3. ✅ Phase 1-3 runtime + Host + Client MVP 已落地
4. ✅ AGENTS.md 第 8 行的"Until runtime is implemented"前提因 Phase 1 落地 runtime 而自然失效；按指示**不修改**
5. 新建 `codex/market-install-preview` 分支
6. **先交 threat model 与测试表，等 Anywhere Labs 安全评审通过后再编码**：
   - 不可变 pin 推导（npm exact SemVer + GitHub immutable commit）
   - 冲突 identity 处理（npm + repository 同时声明时用户显式选）
   - 不可变 commit 校验（拒绝默认分支、tag、mutable ref）
   - profile/generation 变化的确认失效
   - 过期快照的禁用
7. Phase 4 实施 §14.5 prompt：Host 侧 install 候选解析、预览生成、确认 token；不调用 package manager
8. Phase 5（Desktop 受管安装）才接 `desktopPnpm.runPlugin()`

§17-4 在 Phase 4 PR 描述中再次确认默认值。

本 PR 进入 review 状态，等待 Anywhere Labs 评审。