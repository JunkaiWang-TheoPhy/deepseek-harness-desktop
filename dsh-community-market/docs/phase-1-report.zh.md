# Phase 1 — Contract Runtime 交付报告

> 模板：`dsh-community-market-handoff.md` §16。

## 结果

Phase 1 (Contract runtime) 完成。84 个 vitest cases 通过；`yarn workspace dsh-community-market check` 全绿（build + typecheck + test + verify:contract + verify:docs）。

## 阶段

Phase 1 — Contract runtime

## 分支

`codex/market-contract-runtime`

## Commit

在 `origin/master`（branch 时为 `725f494c6e`）之上的 9 个提交：

| ID | 标题 |
|---|---|
| `0e60eb8adb` | feat(market): M1.1 contract runtime package skeleton |
| `f618c79bf6` | feat(market): M1.2 ajv schema compilation with format assertion |
| `65c87eeca9` | feat(market): M1.3 TypeScript contract types |
| `657b745369` | feat(market): M1.4 semantic validation |
| `fac4ed4d55` | feat(market): M1.5 catalog query serialization |
| `78c8582bb4` | feat(market): M1.6 npm + repository identity normalization |
| `2ccadb8560` | feat(market): M1.7 CatalogAdapter interface |
| `8e43c11f61` | feat(market): M1.8 CatalogSourceStore interface |
| `b2cebcb48a` | feat(market): M1.9 verify:contract real check |

## Push 状态

未推送（按 §12 "每个阶段从最新 origin/master 创建独立分支"，feature branch 保留至 Anywhere Labs 评审通过后再 push）。

## 修改文件

（与英文版相同的 24 项；详见英文版表格。）

## 已验证

- `corepack yarn install --mode=skip-build` : ok
- `corepack yarn workspace dsh-community-market build` : ok
- `corepack yarn workspace dsh-community-market typecheck` : ok
- `corepack yarn workspace dsh-community-market test` : 84 passed (7 文件)
- `corepack yarn workspace dsh-community-market verify:contract` : 4 个验证器导出、4 份 fixture round-trip、vitest 84/84
- `corepack yarn workspace dsh-community-market verify:docs` : 8 个 Markdown 文件、4 对双语对、4 份 schema 一致
- `corepack yarn workspace dsh-community-market check` : 全绿

## 未验证

- 真实 HTTP 请求 : Phase 2 才接受限 HTTP client
- 真实 `ctx.settings` 持久化 : Phase 2 才接
- 真实 CatalogAdapter 实现 : Phase 2 范围
- Cursor 跨 sourceRecordId 复用检测 : Phase 2 才接 CursorStore
- 真实 npm pack 发布形态 : 私有包，发版与 tarball 审计在 Phase 6

## 安全检查

- 远程输入 : N/A — Phase 1 不接网络
- Renderer 边界 : N/A — Phase 1 不接 Client
- profile / mutation : N/A — Phase 1 不做安装
- 日志脱敏 : N/A — Phase 1 不打日志
- cancellation / teardown : `CatalogAdapterFetchContext.signal` 已传递；HTTP client 接入后补 timeout 与 abort 接线

## 包内容

- `npm pack --dry-run` : N/A — `private: true`，按 §17-9 发版治理属 Phase 6
- THIRD_PARTY_NOTICES.md : Phase 6 创建

## 已知限制

1. JSON 字面量在 fixture 类型断言时需 `as unknown as T`（JSON imports 丢失字面量）
2. `cursorBelongsTo` 当前只校验长度 1..-2048；Phase 2 接入 CursorStore 后才能按 sourceRecordId 校验归属
3. `normalizeRepositoryUrl` 拒绝 fragment（与 schema `httpsUri` pattern 一致）
4. verify-docs.mjs 删除了 docs-only 不变量（package 现声明 main/types/exports）；保留 schema/fixture 闭合、bilingual pairs、链接完整性校验
5. vitest 路径用 `node_modules/vitest/vitest.mjs` 绕过 bin shim；Node 22.23.2 下验证通过

## 需要 Anywhere Labs 决定

- §17-5 = B（预装 + 1024Store 默认启用）：与既有"无默认源"原则冲突，由任务 #8 跟踪；Phase 6 前需要协调合同文档
- §17 其余 8 项：Labs 在 §17 review 时已回复"全部按默认"；本阶段 PR 不涉及 §17-2 实施，对应改动落在 Phase 2 PR 描述中重申

## 下一阶段建议

Phase 2 (来源 registry + 网络 + adapter) 启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ schemas/examples 已落本地
3. ✅ AGENTS.md 第 8 行的"Until runtime is implemented"前提因 Phase 1 落地 runtime 而自然失效；按用户指示**不修改** AGENTS.md
4. 新建 `codex/market-source-registry` 分支
5. 实施 §14.3 prompt：CatalogSourceStore 持久化（ctx.settings namespace `dsh-community-market`）、Source Registry、受限 HTTP client、标准 https-json adapter、1024Store adapter、cache/pagination/aggregate、partial failure