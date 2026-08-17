# Phase 2 — 来源 registry + 网络 + adapter 交付报告

> 模板：`dsh-community-market-handoff.md` §16。

## 结果

Phase 2 完成。**128 个 vitest cases 通过**；`yarn workspace dsh-community-market check` 全绿。

## 阶段

Phase 2 — 来源 registry + 网络 + adapter

## 分支

`codex/market-source-registry`

## Commit

| ID | 标题 |
|---|---|
| `295d0d2265` | feat(market): M2.1 restricted HTTP client |
| `e7af67577c` | feat(market): M2.2-M2.7 source registry, networking, adapters, aggregation |

M2.2-M2.7 合并提交因为它们构成 registry + 持久化 + cache + 2 个 adapter + 聚合器的一整层，分开提交会让 layer 边界变得难读。

## Push 状态

未推送（按 §12 等评审）。

## 修改文件

（与英文版相同的 17 项；详见英文版表格。）

## 已验证

- `yarn workspace dsh-community-market build` : ok
- `yarn workspace dsh-community-market typecheck` : ok
- `yarn workspace dsh-community-market test` : 128 passed (14 文件)
- `yarn workspace dsh-community-market verify:contract` : ok
- `yarn workspace dsh-community-market verify:docs` : ok
- `yarn workspace dsh-community-market check` : 全绿

## 未验证

- 真实 `ctx.settings` 适配：Phase 3 把 `KvStorage` 接到 DSH settings service
- 真实 1024Store API：adapter 使用文档化的 partner response shape；真实 fixture 在集成时锁定
- 真实 DNS / redirect：测试用注入 fetch + resolveImpl，不触网
- Cache TTL 在墙钟下的行为：测试用注入时钟
- Aggregator 在并发 abort 下的行为：Phase 3 引入 Host-owned AbortController
- DSH 1024Store 在线 smoke：按 §14.3 "线上 provider 只能做显式可选 smoke"

## 安全检查

- 远程输入：`RestrictedHttpClient` URL 预检（scheme=https、no credentials、no fragment、no endpoint query）；DNS 预检拒绝 loopback / private / link-local / multicast / unspecified / CGNAT / cloud-metadata（IPv4 + IPv6）；严格 redirect（每跳重校验、max 5、拒绝 HTTPS downgrade）；content-type 强制 application/json；body 大小上限（默认 gzip 1 MiB + raw 2 MiB）；schema 校验在数据进入 cache 或 adapter 之前完成
- Renderer 边界 : N/A — Phase 2 仅 Host；Client 是 Phase 3
- profile / mutation : N/A — Phase 2 只读
- 日志脱敏：错误只携带 `reason` + 可选 `detail`；不含 raw body、路径、环境变量、token
- cancellation / teardown：聚合器按 source 传递 AbortSignal；`CatalogAdapterFetchContext.signal` 已使用；Phase 3 引入 Host-owned controller 替换每个 fetch 的 `AbortController`

## 包内容

- `npm pack --dry-run` : N/A — 私有包
- THIRD_PARTY_NOTICES : Phase 6

## 已知限制

1. `RestrictedHttpClient.fetchJson` 通过 `options.query` 接受 query 参数；endpoint URL 不能自带 query。M2.5 测试触发了参数冲突，已通过将 endpoint 与 query 拆开解决。
2. `CatalogAggregator.fetchOne` 在 outcome kind 上未区分 "ok stale" 与 "error" — Phase 2 在 fetch 抛错时一律返回 `kind: 'error'`，即使有 last-good 缓存。Phase 3 (Client) 通过失败后重读 cache 来呈现 stale 兜底，避免引入新的 outcome 形状。
3. `CatalogAggregator.fetchOne` 为每次 fetch 创建新 `AbortController`，而非接收 Host-owned 控制器。Phase 3 接入，行为不变直到接线完成。
4. `Dsh1024StoreAdapter` 使用假想的 partner response shape；真实 fixture 在 M2.6 follow-up 锁定。翻译规则稳定；只字段映射可能变。
5. `RestrictedHttpClient` connect / first-byte deadline 通过 `AbortSignal.timeout` 合并到 total deadline。first-byte 细粒度强制（通过流式 body 读取）留 Phase 3。
6. `CatalogSnapshotCache` 仅内存；Phase 3 不引入持久化——cache 按设计就不可久化（per-source fresh fetch 才是真相来源）。

## 需要 Anywhere Labs 决定

- §17-2（storage service）：默认 `ctx.settings` namespace `dsh-community-market`。Phase 3 PR 描述重申；如果 Labs 想要不同 namespace 或独立 storage service，在那个 PR 浮现。
- §17-3（cache / 并发预算）：TTL 5 min、last-good 24 h、全局 6 / 单源 2、body 1 MiB gzip / 2 MiB raw 已应用。Phase 2 PR 描述重申。
- §17-5 = B（预装 + 1024Store 默认启用）：DSH 1024Store adapter 已在 Phase 2 落地；`DefaultSourceRegistry.registerBuiltIn` 是唯一的内置注册。Phase 3 用 `LocalSourceRecord` 的 `enabled` 字段而非 registry 来表达"默认启用"，所以这个决定在 Phase 3 PR 浮现。"无默认源" 合同冲突（任务 #8）仍是 Phase 6 工作。

## 下一阶段建议

Phase 3 (只读 Host + Client MVP) 启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ schemas/examples 已落本地
3. ✅ AGENTS.md 第 8 行因 Phase 1 落地 runtime 而自然失效；按指示**不改**
4. 新建 `codex/market-readonly-host` 分支
5. 实施 §14.4 prompt：Host entry + route + ctx.settings 持久化 + Client entry + slot + 来源管理 UI + 搜索 + 详情 + 全部状态 + i18n + Loader smoke（Gate A 验收点）

§17-1/§17-6 在 Phase 3 PR 描述中再次确认。