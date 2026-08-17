# Phase 6 — Release Candidate Delivery Report

> Format follows `dsh-community-market-handoff.md` §16.

## Result

Phase 6 (发布候选) partially completed. **227 vitest cases pass** (185 main + 42 install-security). `yarn workspace dsh-community-market check` is green. `npm pack --dry-run` produces a 351 kB tarball with 38 files.

The package remains `private: true` per the §17-9 policy (Anywhere Labs owns the release gate). Tagging and publishing is out of scope for the external team.

## Stage

Phase 6 — 发布候选

## Branch

`codex/market-install-preview` (carried from Phase 4/5; Phase 6 commits
land here because the install path's threat model and route handlers
predate Phase 6).

A separate `codex/market-release` branch will be created from this
work when Labs approves the release.

## Commits

| ID | Subject |
|---|---|
| `e068ff9a6d` | docs(market): Phase 4 threat model + security test table |
| `0c4acbf3be` | feat(market): M4.3-M4.7 install identity + preview + recheck |
| `bc1090f488` | feat(market): M5.1-M5.6 install route handlers + Phase 5 report |
| `e2f86cb589` | feat(market): M6.0-M6.1 §17-5 contract reconciliation + Host install wiring |

## Push status

Not pushed (per §12 — feature branch held until Labs review).

## Modified files (Phase 6)

| Path | Purpose |
|---|---|
| `docs/section-17-5-reconciliation.md` | Authoritative document for §17-5 = B exception (new) |
| `docs/catalog-provider-contract.zh.md` | 决策摘要 adds §17-5 = B qualifier |
| `docs/market-shell.zh.md` | 本地状态边界 adds §17-5 = B exception |
| `docs/market-shell.i18n.yaml` | Updated hash for the .zh.md edit |
| `docs/phase-5-report.md` | (M5.6) Phase 5 delivery report |
| `src/contracts/adapter.ts` | `CatalogAdapter` gets optional `isBuiltInPartner` field |
| `src/host/adapters/dsh-1024store.ts` | `Dsh1024StoreAdapter.isBuiltInPartner = true` + `IS_BUILT_IN_PARTNER` export |
| `src/host/plugin.ts` | `apply()` detects `desktopProfiles` + `desktopPnpm`; registers `/v1/market/install/{preview,confirm}` when present; 503 on missing capability |
| `src/host/install/profile.ts` | (M5.1) profile/generation adapters |
| `src/host/install/routes.ts` | (M5.2) `handleInstallPreview` / `handleInstallConfirm` / `missingCapability` |
| `src/host/install/preview.ts` | (M5.5) `buildInstallPreview` accepts partial item shape |
| `src/host/install/confirm.ts` | (M5.6) `recheckConfirm` re-validates profile / generation / snapshot / TTL |
| `src/client/i18n.ts` | Adds `install.lifecycle.warning`, `install.confirm.title`, `install.error.identity-choice-required` (zh-CN + en) |
| `THIRD_PARTY_NOTICES.md` | (M6.4) full third-party attribution list |
| `package.json` | Adds `THIRD_PARTY_NOTICES.md` to `files` |
| `tests/host/install/identity.spec.ts` | (M4.3) 17 cases |
| `tests/host/install/candidate.spec.ts` | (M4.4) 5 cases |
| `tests/host/install/preview.spec.ts` | (M4.5 + M4.6) 8 cases |
| `tests/host/install/routes.spec.ts` | (M5.5) 12 cases |
| `scripts/verify-install-security.mjs` | (M4.7) bundles the install suite under `yarn verify:install-security` |

## Verified (command : result)

- `corepack yarn workspace dsh-community-market check` : green
- `corepack yarn workspace dsh-community-market test` : 185 passed
- `corepack yarn workspace dsh-community-market verify:install-security` : 42 passed
- `corepack yarn workspace dsh-community-market verify:loader` : 26 runtime exports
- `corepack yarn workspace dsh-community-market verify:docs` : bilingual pairs consistent
- `npm pack --dry-run --ignore-scripts` : 38 files, 351.5 kB tarball

## Unverified (item : reason)

- M6.2 (full plugin integration smoke) was deferred. The pure install
  route handlers in `tests/host/install/routes.spec.ts` cover the
  security-critical surface (preview, confirm, profile/generation
  re-check, capability detection, TTL). The plugin's `apply()` glue
  is a thin adapter between `IncomingMessage` and `Request`; the
  dsh-plugin-desktop webserver is required to drive it end-to-end.
  Phase 6 follow-up when the dsh-plugin-desktop Loader tree is
  available will provide this smoke.
- M6.3 (Client install + restart UI) was deferred. The Client entry
  registers the sidebar slot; the actual install button + two-step
  confirm dialog + restart UX is in the next iteration. The Headless
  HTML preview (`yarn preview:client`) shows the i18n + state
  structure; the install-specific UI needs a follow-up to add
  `InstallHostAdapter` and the dialog component.
- Live integration with `deepseek-harness` upstream pnpm build:
  verified the contract via `verify:cordis-contract` (Phase 3.5). The
  upstream build itself hits a pre-existing `@deepseek-ai/dsh-root`
  stub issue unrelated to our plugin; documented in task #38.
- The `desktopGeneration` Cordis service proposed in the threat model
  is a Phase 6 follow-up. Phase 6 uses a per-process static
  generation id.

## Security checks

- All Phase 4 threats (T-01..T-13) closed by M4.3-M4.7 implementation.
  Verified by the security test table (`docs/security-test-table.md`)
  and exercised by the install-security suite (42 cases).
- Profile / generation / snapshot / TTL re-check is the only path
  between user confirm and `desktopPnpm.runPlugin` (M4.6).
- Renderer-supplied `target` is never trusted (T-11). The Host derives
  the install target from the local snapshot via `resolveCandidate`.
- `isBuiltInPartner: true` is a static, local-only flag on the
  preinstalled 1024Store adapter (M6.0). It does not derive from
  any provider-claimed field.
- All errors return bounded `{ error: { reason, detail? } }` JSON;
  `detail` is the prior value (e.g. `default->staging`), never raw
  body / env / token / command (T-12).

## Package contents

- Tarball: 351.5 kB, 38 files
- Includes: `lib/index.mjs` (374 kB built bundle), `lib/index.d.mts`
  (123 kB types), all 4 schemas, 4 examples, bilingual docs, full
  threat model + security test table + §17-5 reconciliation
- Excludes: `src/`, `tests/`, `scripts/`, `node_modules/`, `preview/`,
  `tsconfig*.json`, `.gitignore`, `pnpm-lock.yaml`
- THIRD_PARTY_NOTICES.md included

## Known limitations

1. **M6.2 deferred.** Full plugin integration test is not in the test
   suite. Mitigation: the pure route handlers in M5.2/M5.5 cover the
   security-critical surface; the missing piece is a test framework
   that exercises the dsh-plugin-desktop webserver end-to-end. Phase 6
   follow-up when the dsh-plugin-desktop Loader tree is available.
2. **M6.3 deferred.** Client install button + confirm dialog +
   restart UX is not implemented. The i18n bundle, the
   `install.lifecycle.warning` key, and the StateView are in place.
   The runtime `InstallHostAdapter` interface and the dialog component
   are next-iteration.
3. **`desktopGeneration` static.** Phase 6 uses a per-process static
   generation id. The threat model notes this as an open question.
   When the runtime exposes a real generation source (Phase 6
   follow-up), `src/host/install/profile.ts` `staticGeneration` is
   the single replacement point.
4. **`private: true`.** Per §17-9, the package remains private. The
   removal of `private: true` and the actual npm publish are owned by
   Anywhere Labs; this PR does not touch `package.json#private`.

## Anywhere Labs decisions needed

- §17-9 (release governance) : Labs to remove `private: true` and
  publish the tarball from the upstream tarball listed above.
- §17-2 (storage) : confirmed `ctx.settings` namespace
  `dsh-community-market` is the storage target. Phase 6 uses this
  without modification.
- §17-3 (cache / concurrency budgets) : defaults applied. Phase 6
  report restates.
- §17-5 = B : the contract reconciliation document is the authoritative
  reference. Phase 6 is gated on Labs' final sign-off there.
- §17-7 (Restart entry) : default is "in-market Restart button using
  `desktopProfiles.select`". The renderer wiring is in M6.3 (deferred).
- §17-1 / §17-6 (UI entry, no remote images) : Phase 3 default
  applied (sidebar item, no `<img>`).

## Final state

| Phase | Status |
|---|---|
| 0 — research | done |
| 1 — contract runtime | done |
| 2 — source registry + networking + adapter | done |
| 3 — Host + Client MVP | done |
| 4 — install threat model + security test | done |
| 5 — install route handlers | done |
| 6 — release candidate | **partially done** (M6.0, M6.1, M6.4 done; M6.2, M6.3 deferred) |

The package is reviewable as-is for threat model, security test table,
contract reconciliation, install route handlers, and tarball shape.
Two deferred items (M6.2 full plugin integration smoke; M6.3 Client
install UI) are documented above with the exact follow-up actions.

## Next-stage suggestion (post Phase 6)

1. Labs reviews `threat-model.md`, `security-test-table.md`, and
   `section-17-5-reconciliation.md`. On approval, sign off in this
   report's table.
2. Labs chooses a real `desktopGeneration` source and an AbortSignal
   channel for `desktopPnpm.runPlugin`. Phase 6 follow-up PR wires
   both.
3. M6.2 follow-up: load the package via dsh-plugin-desktop's
   `verify:loader` and assert install routes register cleanly.
4. M6.3 follow-up: add `InstallHostAdapter` interface to the Client
   entry, the install button on `PluginCard`, the two-step confirm
   dialog component, the restart button on success.
5. §17-9: Labs removes `private: true`, runs `npm publish`, and tags
   the release. This external team does not hold the npm token.