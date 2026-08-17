# Phase 1 — Contract Runtime Delivery Report

> Format follows `dsh-community-market-handoff.md` §16.

## 结果

Phase 1 (Contract runtime) 完成。84 vitest cases 通过；`yarn workspace dsh-community-market check` 全绿（build + typecheck + test + verify:contract + verify:docs）。

## 阶段

Phase 1 — Contract runtime

## 分支

`codex/market-contract-runtime`

## Commit

9 commits on top of `origin/master` (was `725f494c6e` at branch time):

| ID | Subject |
|---|---|
| `0e60eb8adb` | feat(market): M1.1 contract runtime package skeleton |
| `f618c79bf6` | feat(market): M1.2 ajv schema compilation with format assertion |
| `65c87eeca9` | feat(market): M1.3 TypeScript contract types |
| `657b745369` | feat(market): M1.4 semantic validation (item uniqueness, manifest limits, provenance match) |
| `fac4ed4d55` | feat(market): M1.5 catalog query serialization |
| `78c8582bb4` | feat(market): M1.6 npm + repository identity normalization |
| `2ccadb8560` | feat(market): M1.7 CatalogAdapter interface |
| `8e43c11f61` | feat(market): M1.8 CatalogSourceStore interface |
| `b2cebcb48a` | feat(market): M1.9 verify:contract real check |

## Push 状态

未推送（按 §12 "每个阶段从最新 origin/master 创建独立分支"，feature branch 保留至 Anywhere Labs 评审通过后再 push；与外部团队协作的 PR 流程按 T4 安排走）。

## 修改文件

| Path | Purpose |
|---|---|
| `.gitignore` | ignore dsh-community-market/dist and lib build output |
| `dsh-community-market/package.json` | main/types/exports + scripts (build/typecheck/test/verify:contract/verify:docs/check) + devDependencies (ajv, ajv-formats, tsdown, typescript, vitest, @types/node, unrun) |
| `dsh-community-market/tsconfig.json` | strict TS, ESM, no rootDir so tests/ lives outside src/ |
| `dsh-community-market/tsdown.config.ts` | ESM build, dts generation, target=node22, deps.neverBundle for ajv family |
| `dsh-community-market/vitest.config.ts` | headless node test runner with passWithNoTests |
| `dsh-community-market/scripts/verify-contract.mjs` | M1.1 skeleton → M1.9 full check (validators exported + fixture round-trip + vitest) |
| `dsh-community-market/scripts/verify-docs.mjs` | relaxed docs-only invariant; keeps contract invariants (bilingual pairs, schema/fixture/semantic validation, link integrity) |
| `dsh-community-market/src/index.ts` | entry: re-exports validators + types + semantic helpers + identity/query helpers + adapter/store types |
| `dsh-community-market/src/contracts/schemas.ts` | 4 ajv-compiled validators with format assertion |
| `dsh-community-market/src/contracts/types.ts` | hand-written TS contract types |
| `dsh-community-market/src/contracts/semantic.ts` | SemanticResult + 4 semantic checkers |
| `dsh-community-market/src/contracts/adapter.ts` | CatalogAdapter + CatalogAdapterFetchContext interfaces |
| `dsh-community-market/src/contracts/source-store.ts` | CatalogSourceStore interface + AddInputCheck + composeLocalSourceRecord + defaultSourceRecordIdFactory |
| `dsh-community-market/src/catalog/query.ts` | serializeCatalogQuery, applyQueryToUrl, cursorBelongsTo |
| `dsh-community-market/src/catalog/identity.ts` | normalizeNpmName, normalizeRepositoryUrl, normalizeRepositorySubdirectory |
| `dsh-community-market/tests/contracts/schemas.spec.ts` | 21 cases |
| `dsh-community-market/tests/contracts/types.spec.ts` | 6 cases |
| `dsh-community-market/tests/contracts/semantic.spec.ts` | 14 cases |
| `dsh-community-market/tests/contracts/adapter.spec.ts` | 2 cases |
| `dsh-community-market/tests/contracts/source-store.spec.ts` | 12 cases |
| `dsh-community-market/tests/catalog/query.spec.ts` | 12 cases |
| `dsh-community-market/tests/catalog/identity.spec.ts` | 17 cases |
| `yarn.lock` | ajv, ajv-formats, tsdown, typescript, vitest, @types/node, unrun and their deps |

## 已验证（command : result）

- `corepack yarn install --mode=skip-build` : ok, 895 + 1 packages added
- `corepack yarn workspace dsh-community-market build` : ok, 4 files (lib/index.mjs, lib/index.mjs.map, lib/index.d.mts, lib/index.d.mts.map)
- `corepack yarn workspace dsh-community-market typecheck` : ok
- `corepack yarn workspace dsh-community-market test` : 84 passed (7 files)
- `corepack yarn workspace dsh-community-market verify:contract` : 4 validators exported, 4 fixtures round-trip, vitest 84/84
- `corepack yarn workspace dsh-community-market verify:docs` : 8 Markdown files, 4 bilingual pairs, 4 schemas consistent
- `corepack yarn workspace dsh-community-market check` : green

## 未验证（项目 : 原因）

- 真实 HTTP 请求 : Phase 2 才接受限 HTTP client
- 真实 `ctx.settings` 持久化 : Phase 2 才接
- 真实 CatalogAdapter 实现（standard / 1024Store）: Phase 2 范围
- Cursor 跨 sourceRecordId 复用检测 : Phase 2 才接 CursorStore，目前只校验长度 1..-2048
- 真实 npm pack 发布形态 : 私有包，发版与 tarball 内容审计在 Phase 6

## 安全检查

- 远程输入 : N/A — Phase 1 不接网络；schemas 来自仓库本地 docs/schemas/，fixtures 来自 docs/examples/
- Renderer 边界 : N/A — Phase 1 不接 Client；本阶段无 renderer 入口
- profile / mutation : N/A — Phase 1 不做安装；无 `desktopProfiles` 或 `desktopPnpm` 引用
- 日志脱敏 : N/A — Phase 1 不打日志；无 stdout/stderr 流暴露
- cancellation / teardown : `CatalogAdapterFetchContext.signal` 已传递；HTTP client 接入后补 timeout 与 abort 接线（Phase 2）

## 包内容

- `npm pack --dry-run` : N/A — `private: true`，按 §17-9 发版治理属 Phase 6
- 已知依赖 : ajv (MIT), ajv-formats (MIT), fast-uri (BSD-3-Clause, ajv 间接依赖), unrun (MIT), tsdown (MIT), typescript (Apache-2.0), vitest (MIT), @types/node (MIT)
- THIRD_PARTY_NOTICES.md : Phase 6 创建，Phase 1 暂无；本报告记录各依赖许可证以备 §17-9 时填写

## 已知限制

1. JSON 字面量（manifestVersion、schemaVersion、sort、registrationKind 等）在 fixture 类型断言时需要 `as unknown as T`（JSON imports 丢失字面量，ajv 在运行时仍是单一权威）。
2. `cursorBelongsTo` 当前只校验长度 1..-2048；Phase 2 接入 CursorStore 后才能按 sourceRecordId 校验归属。
3. `normalizeRepositoryUrl` 拒绝 fragment（与 httpsUri pattern `^https://(?![^/?#]*@)[^#]+$` 一致）；manifest endpoint 同样拒绝，但 manifest endpoint 还拒绝 query 字符串（`endpoint.search === ''` 强制）。
4. verify-docs.mjs 删除了 docs-only 不变量（package 现在声明 main/types/exports）；保留 schema/fixture 闭合、bilingual pairs、链接完整性校验。如果 Phase 6 发版时需要恢复 docs-only 基线，需重新加回。
5. vitest 路径用 `node_modules/vitest/vitest.mjs`（绕过 bin shim）以保证 vitest 自身运行；测试在 Node 22.23.2 下验证通过。

## 需要 Anywhere Labs 决定

- §17-5 = B（预装 + 1024Store 默认启用）：与既有"无默认源"原则冲突，由任务 #8 跟踪；Phase 6 前需要协调 catalog-provider-contract.zh.md 与 market-shell.zh.md 对应条款；外部团队不在 Phase 1 PR 内改动。
- §17 其余 8 项：Labs 在 §17 review 时已回复"全部按默认"（§17-5 例外）。本阶段 PR 不涉及 §17-2（storage namespace）实施，对应改动落在 Phase 2 PR 描述中重申。

## 下一阶段建议

Phase 2 (来源 registry + 网络 + adapter) 启动条件：

1. ✅ yarn.lock 已就绪（含 ajv、ajv-formats、tsdown 等）
2. ✅ schemas/examples 已落本地（`725f494c6e` 起本地已是 origin/master）
3. ✅ AGENTS.md 第 8 行的"Until runtime is implemented"前提，因 Phase 1 落地 runtime 而自然失效；按用户指示**不修改** AGENTS.md
4. 新建 `codex/market-source-registry` 分支
5. 实施 §14.3 prompt 内容：CatalogSourceStore 持久化（ctx.settings namespace `dsh-community-market`）、Source Registry、受限 HTTP client（DNS/redirect/timeout/body/schema 全套防护）、标准 https-json adapter、1024Store adapter、cache/pagination/aggregate、partial failure。零启用源时网络请求为零；新增来源默认禁用；线上 provider 只能做显式可选 smoke。

Phase 2 启动前，本 PR 进入 review 状态，等待 Anywhere Labs 评审 + §17-2/§17-3 默认值在 Phase 2 PR 描述中再次确认。