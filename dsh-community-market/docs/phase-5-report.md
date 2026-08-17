# Phase 5 — Desktop Managed Install Delivery Report

> Format follows `dsh-community-market-handoff.md` §16.

## Result

Phase 5 (Desktop managed install) completed. **185 vitest cases pass**; `yarn workspace dsh-community-market check` is green (build + typecheck + test + verify:contract + verify:loader + verify:install-security + verify:docs).

## Stage

Phase 5 — Desktop 受管安装

## Branch

`codex/market-desktop-install`

## Commits

| ID | Subject |
|---|---|
| `0c4acbf3be` | feat(market): M4.3-M4.7 install identity + preview + recheck (Phase 4 implementation, gated) |
| `<pending>` | feat(market): M5.1-M5.5 install route handlers + lifecycle i18n |

## Push status

Not pushed (per §12 — feature branch held until Labs review).

## Modified files (Phase 5)

| Path | Purpose |
|---|---|
| `dsh-community-market/src/host/install/profile.ts` | `readCurrentProfile` adapter + `staticGeneration` factory (M5.1) |
| `dsh-community-market/src/host/install/routes.ts` | `handleInstallPreview`, `handleInstallConfirm`, `missingCapability` pure handlers (M5.2) |
| `dsh-community-market/src/client/i18n.ts` | zh-CN + en lifecycle warning + confirm dialog strings (M5.3) |
| `dsh-community-market/src/host/install/preview.ts` | `buildInstallPreview` accepts partial item shape (M5.2) |
| `dsh-community-market/tests/host/install/routes.spec.ts` | 12 install route cases (M5.5) |

## Verified (command : result)

- `corepack yarn workspace dsh-community-market check` : green
- `corepack yarn workspace dsh-community-market test` : 185 passed (20 files)
- `corepack yarn workspace dsh-community-market verify:install-security` : 42 install tests (4 files)

## Unverified (item : reason)

- Real `desktopProfiles.current` / `desktopPnpm.runPlugin` integration : Phase 5 ships pure handlers; the Host plugin's `apply` does not yet register the install routes. Phase 6 wires the bootstrap call that hands `desktopProfiles`, `desktopPnpm`, and a generation reader to the handlers.
- Restart entry UX : per `dsh-community-market-handoff.md` §17-7, default is "in-market Restart button using `desktopProfiles.select`". The button's behavior is part of Phase 6's renderer wiring; for Phase 5 the confirm route returns `ok-confirm` and lets the caller decide.

## Security checks

- 远程输入 : Phase 5 handlers consume only items already validated by Phase 2 ajv. `PreviewRequest` and `ConfirmRequest` are typed at the boundary.
- Renderer 边界 : the renderer's role is reduced to "submit { sourceRecordId, itemId, identityChoice, snapshot }". The renderer never sees or supplies `target`; the Host derives it locally (T-11). The renderer never sees the bound `token` until the Host returns it; re-submitting a stale token surfaces a 409 (T-04/T-05/T-09).
- profile / mutation : `handleInstallConfirm` calls `recheckConfirm` before `runPlugin`; a profile / generation / snapshot mismatch returns 409 without invoking the runtime. The only mutation is `desktopPnpm.runPlugin(['add', spec], invokingDir)`.
- 日志脱敏 : errors return bounded `{ error: { reason, detail? } }` JSON. The `detail` field is the prior value (e.g. `default -> staging`); it never includes raw body, env, token, or command.
- cancellation / teardown : `recheckConfirm` is pure; the `desktopPnpm` handle is awaited via `done`. Phase 6 adds AbortSignal threading.

## Threat-model coverage (T-01..T-13)

| Threat | Closed by |
|---|---|
| T-01 npm mutable ref | `assertStrictSemVer` rejects `latest`, `^1.2.0`, `~1.2.0`, `1.x`, `*`, dist-tags |
| T-02 git mutable ref | `resolveGitTarget` rejects branch / tag / no-commit |
| T-03 package + repo conflict | `resolveCandidate` returns `Conflict`; the route returns 409; UI forces user choice |
| T-04 stale profile / generation | `recheckConfirm` re-reads; 409 returned |
| T-05 stale snapshot | `recheckConfirm` re-reads `fetchedAt`; 409 returned |
| T-06 cursor reuse | Phase 2 `cursorBelongsTo` (out of Phase 5 scope) |
| T-07 provider install field | ajv snapshot validator rejects; Host never reads |
| T-08 lifecycle disclosure | `buildInstallPreview` includes warning text; i18n bundle has the phrase in both locales |
| T-09 generation lock | TTL = 30s; `recheckConfirm` checks expiration |
| T-10 render-time mutation | `recheckConfirm` re-fetches and compares |
| T-11 renderer-controlled target | `PreviewRequest` and `ConfirmRequest` types don't accept `target` from the renderer |
| T-12 error leak | `fail()` returns bounded JSON |
| T-13 concurrent installs | `desktopPnpm` per-generation gate (upstream contract) |

## Package contents

- `npm pack --dry-run` : N/A — `private: true`, Phase 6
- THIRD_PARTY_NOTICES : Phase 6
- No new runtime deps

## Known limitations

1. `buildInstallPreview` accepts a partial item shape (name, summary optional). The standard adapter contract requires `name` and `summary` to be present; the relaxation is purely for the `CandidateResolved` shape returned by `resolveCandidate` which only carries `id` + `displayName`. Phase 6 hardens the contract.
2. `staticGeneration` is a Phase 5 placeholder. Phase 6 wires a real runtime generation source (likely a `desktopGeneration` Cordis service or `desktopProfiles.current.generation`).
3. `handleInstallConfirm` does not thread an AbortSignal into `runPlugin`. The per-generation `desktopPnpm` gate handles concurrent calls; explicit cancellation is Phase 6.
4. The lifecycle warning text is hard-coded English / Chinese in the i18n bundle. Phase 6 may extend the bundle; the phrase is asserted verbatim by the smoke matrix and must not drift.

## Anywhere Labs decisions needed

- §17-5 = B (preinstall + 1024Store default-enabled) : the `Dsh1024StoreAdapter` from Phase 2 is registered as a built-in adapter; the actual `default-enabled` state is a bootstrap decision in Phase 6. The "no default source" contract conflict (task #8) remains Phase 6 work.
- §17-7 (Restart entry) : default is "in-market Restart button using `desktopProfiles.select`". Phase 6 wires the UI hook.

## Next-stage suggestion

Phase 6 (发布候选) 启动条件：

1. ✅ yarn.lock 已就绪
2. ✅ Phase 1-5 全绿
3. ✅ Host plugin entry 已具备 install handlers；Phase 6 接线 `ctx.desktopProfiles`、`ctx.desktopPnpm`、generation reader
4. ✅ AGENTS.md 不改
5. 新建 `codex/market-release` 分支
6. Phase 6 实施 §14.7 prompt：
   - Host entry bootstrap 把 `desktopProfiles`、`desktopPnpm`、generation reader 注入 install routes
   - Client renderer 加 install 按钮（点击 → preview → confirm 两步）
   - Client renderer 加 restart 按钮
   - npm pack --dry-run 验收 tarball 内容
   - THIRD_PARTY_NOTICES 整理
   - Phase 6 前**先解决 §17-5 = B 与"无默认源"合同的冲突**（任务 #8），否则 Phase 6 PR 评审会被打回

§17-1/§17-6 在 Phase 6 PR 描述中再次确认。§17-2/§17-3/§17-7 已经在 Phase 5 提交中默认值落地。