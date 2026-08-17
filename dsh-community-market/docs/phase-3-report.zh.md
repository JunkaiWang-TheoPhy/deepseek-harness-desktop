# Phase 3 — 只读 Host + Client MVP 交付报告

> 模板：`dsh-community-market-handoff.md` §16。

## 结果

Phase 3 结构上完成。**143 个 vitest cases 通过**；`yarn workspace dsh-community-market check` 全绿（build + 双 tsconfig typecheck + test + verify:contract + verify:loader + verify:docs）。

## 阶段

Phase 3 — 只读 Host 与 Client MVP

## 分支

`codex/market-readonly-host`

## Commit

| ID | 标题 |
|---|---|
| `10dd7b02e2` | feat(market): M3.1-M3.4 Host plugin entry + settings + routes |

（M3.5-M3.10 合并提交：Client entry + i18n bundle + 3 个 React 组件 + Loader smoke 作为一个 client-side 整体交付。）

## Push 状态

未推送（按 §12 等评审）。

## 修改文件

（与英文版相同的 16 项；详见英文版表格。）

## 已验证

- `yarn workspace dsh-community-market build` : ok
- `yarn workspace dsh-community-market typecheck` : ok（Host + Client tsconfigs）
- `yarn workspace dsh-community-market test` : 143 passed (16 文件)
- `yarn workspace dsh-community-market verify:contract` : ok
- `yarn workspace dsh-community-market verify:loader` : 26 runtime exports present
- `yarn workspace dsh-community-market verify:docs` : ok
- `yarn workspace dsh-community-market check` : 全绿

## 未验证

- 真实 `ctx.webServer` / `ctx.settings` 注入：需要 DSH harness（依赖 deepseek-harness 子模块，当前未初始化）
- `dsh-plugin-desktop` Loader 烟测：standalone `verify:loader` 已确认 26 个 runtime export
- Theme 与 `@deepseek-ai/dsh-client-ui-theme` 集成：Phase 3 提交 slot 注册；theme tokens 由 `ctx.theme` 在生产环境消费
- Locale 与 `@deepseek-ai/dsh-client-locale` 集成：i18n bundle 已交付；运行时 t() 解析依赖 harness 注入
- 真实 1024Store 联调：Phase 2 adapter 用文档化的 shape；真实 fixture 在 M2.6 follow-up 锁定

## 安全检查

- 远程输入 : Phase 3 只消费已通过 Phase 2 adapter 校验的数据；route handler 通过 `coerceRecordInput` 处理请求体并用 `validateAddInput` 校验。错误只返回有界的 `{ error: { reason, detail? } }` JSON。
- Renderer 边界 : Client 组件在 `tsconfig.client.json` 之后；entry 只 type-only import `@deepseek-ai/dsh-client-runtime/client` 与 `@deepseek-ai/cordis-plugin-loader`。组件不接触 Node/Electron/fs/process/package-manager。
- profile / mutation : Phase 3 只交付 source-management routes；不引用 `desktopProfiles` / `desktopPnpm`；`enabled` 是 Host 端 flag，aggregator 用它跳过禁用源，永远不是 profile mutation。
- 日志脱敏 : Host/Client 无 console 日志；唯一错误出口是 JSON `reason` 字段。
- cancellation / teardown : Host 插件用 `ctx.effect(...)` 管理 `marketHost` 服务生命周期；effect disposer 关闭时注销 slot。

## 包内容

- `npm pack --dry-run` : N/A — 私有包
- THIRD_PARTY_NOTICES : Phase 6

## 已知限制

1. Host 插件的 `WebServerServiceLike` / `SettingsServiceLike` 是本地接口，对应 DSH contract；它们让插件可独立编译，但实际集成使用 `@deepseek-ai/dsh-host-webserver` / `@deepseek-ai/dsh-settings` 的真实 export（在 Phase 6 接线时落地）。
2. Client entry 用同样的本地接口；实际 DSH 类型在 harness 组合时拉入。
3. `MarketPage` 与 `SourcesPage` 仅用轻量内联样式；视觉打磨（CSS 主题、响应式布局）留 Phase 3 follow-up。
4. catalog route handler 从 `handle.manifests` 构建 `SourceInput[]`；manifests 由 bootstrap 从持久化的 manifest URL 拉取并缓存。Phase 3 测试保持 manifest map 为空；生产路径依赖 source-record bootstrap。

## 需要 Anywhere Labs 决定

- §17-1 (UI 入口)：sidebar item "插件市场"已应用。Client entry 注册 `id: 'market-shell'` 含两个 routes（`/market`, `/market/sources`）。若 Labs 偏好命令面板/设置子项，registration target 改；entry 形状不变。
- §17-2 (storage)：`ctx.settings` namespace `dsh-community-market` 已应用；Phase 3 交付 `SettingsKvStorage` 与 `dshCommunityMarketSchema`。Phase 6 接线 bootstrap。
- §17-6 (不显示远程图片)：确认；Phase 3 用首字母内联占位 icon，无 `<img>`。
- §17-5 = B (预装 + 1024Store 默认启用)：合同冲突（任务 #8）属 Phase 6；Phase 3 host 只注册 built-in adapter，不处理"默认启用"状态——那是 bootstrap 决定，按 LocalSourceRecord 生命周期走。

## 下一阶段建议

Phase 4（安装预览）启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ schemas/examples 已落本地
3. ✅ Phase 1-3 runtime + Host + Client MVP 已落地
4. ✅ AGENTS.md 不改
5. 新建 `codex/market-install-preview` 分支
6. **先交 threat model 与测试表，等 Anywhere Labs 安全评审通过后再编码**：
   - 不可变 pin 推导
   - 冲突 identity 处理
   - 不可变 commit 校验
   - profile/generation 变化的确认失效
   - 过期快照的禁用
7. Phase 4 实施 §14.5 prompt：Host 侧 install 候选解析、预览、确认 token；不调 package manager
8. Phase 5（Desktop 受管安装）才接 `desktopPnpm.runPlugin()`

§17-4 在 Phase 4 PR 描述中再次确认。

本 PR 进入 review 状态。