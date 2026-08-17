# dsh-community-market — Team Testing Guide

> Branch: [`codex/market-install-preview`](https://github.com/anywhere-labs/deepseek-harness-desktop/tree/codex/market-install-preview)
> Latest commit: `aa69bfff4f` (M6.6 headless local smoke)
> This branch is for **review and integration testing**; it is **not** the release tag.

## TL;DR

```bash
# 1. Get the branch
git fetch origin
git checkout origin/codex/market-install-preview

# 2. Build + run the headless smoke (no GUI needed; works on any host)
cd dsh-community-market
corepack yarn install --mode=skip-build
corepack yarn workspace dsh-community-market build
corepack yarn workspace dsh-community-market local-smoke

# 3. Run the full test matrix
corepack yarn workspace dsh-community-market check
# → 237 tests across 22 files, 0 failures
```

`local-smoke` loads the compiled `lib/index.mjs` into a minimal Cordis runtime, registers 3 routes, drives preview → confirm, and asserts the lifecycle warning is rendered. Expected output ends with `=== OK ===`.

## What this branch contains

Phase 0–6 of the `dsh-community-market` package. Eight commits on top of `origin/master`:

| ID | Subject |
|---|---|
| `8b91382344` | feat(market): M3 Cordis contract verification script (later reset) |
| `e068ff9a6d` | docs(market): Phase 4 threat model + security test table |
| `0c4acbf3be` | feat(market): M4.3-M4.7 install identity + preview + recheck |
| `bc1090f488` | feat(market): M5.1-M5.6 install route handlers + Phase 5 report |
| `e2f86cb589` | feat(market): M6.0-M6.1 §17-5 contract reconciliation + Host install wiring |
| `dad184d808` | docs(market): Phase 6 partial delivery report + THIRD_PARTY_NOTICES |
| `19c3962494` | feat(market): M6.2-M6.3 install integration test + Client install UI |
| `aa69bfff4f` | feat(market): M6.6 headless local smoke + re-export install types |

Read [`docs/phase-6-report.md`](docs/phase-6-report.md) for the final state and open questions.

## Test scenarios

### A. Headless contract (no GUI, ~5 seconds)

This proves the package can be loaded into a Cordis runtime and exposes the right contract.

```bash
cd dsh-community-market
yarn local-smoke
```

The script verifies:
1. Plugin exports `name = 'dsh-community-market'`, `inject` includes `webServer`, `settings`, optional `desktopProfiles?`, `desktopPnpm?`
2. `apply(ctx, config)` runs without error
3. Three routes register: `/v1/market/install`, `/v1/market/install/*`, `/v1/market/*`
4. Preview → confirm round trip invokes `desktopPnpm.runPlugin(['add', spec], invokingDir)` exactly once
5. Profile-changed between preview and confirm surfaces 409 and **does not** call `runPlugin`
6. The lifecycle warning text appears verbatim in the preview payload

### B. Unit + integration tests (no GUI, ~30 seconds)

```bash
cd dsh-community-market
yarn check
```

Runs in order: `build`, `typecheck` (Host + Client tsconfigs), `test` (190 cases across 22 files), `verify:contract`, `verify:loader`, `verify:install-security` (47 install cases across 5 files), `verify:docs` (bilingual pairs).

The 47 install cases cover threat model T-01..T-13 — the same matrix Labs reviews in [`docs/security-test-table.md`](docs/security-test-table.md).

### C. Headless HTML preview (no GUI, ~3 seconds)

Useful when iterating on the Client UI without spinning up a browser.

```bash
cd dsh-community-market
yarn preview:client
# → opens preview/preview.html in your browser, or open the file directly
```

Renders 6 states of `MarketPage` / `SourcesPage` / `StateView` with sample snapshots.

### D. Real integration with dsh-plugin-desktop (requires GUI session)

This is the only path that exercises the sidebar item, the install button click, and the actual lifecycle warning in a real browser. The repo currently builds dsh-plugin-desktop against the deepseek-harness submodule; to load `dsh-community-market` into it:

```bash
# In dsh-community-market (this branch):
cd dsh-community-market
yarn build
yarn link

# In dsh-plugin-desktop:
cd ../dsh-plugin-desktop
yarn link dsh-community-market
# Add dsh-community-market to the cordis.patch.yml in dsh-plugin-desktop:
#   - insert:
#       - id: market-host
#         name: dsh-community-market
# (This is the file the deepseek-harness submodule reads at boot.)

# Verify Cordis Loader sees our plugin
yarn verify:loader
# Look for "market-host" in the registered plugin list.

# Or, full GUI launch (macOS / Linux with display):
yarn start
# Then open the URL dsh prints (usually http://127.0.0.1:<port>/)
# The "插件市场" sidebar item should appear; click into it to see
# the plugin catalog and the install flow.
```

## What to look for

- **Install button** on each plugin card
- **Two-step confirm dialog** with the lifecycle warning
- **Token binding**: switching profile or generation between preview and confirm MUST surface 409 and MUST NOT call `runPlugin`
- **Provider inputs that fail strict SemVer** (e.g. `latest`, `^1.2.0`) MUST disable install
- **Mutable Git refs** (e.g. `main` branch, `v1.0.0` tag) MUST disable install
- **Conflict identity** (item with both `package` and `repository`) MUST force explicit user choice
- **Provider-supplied `install` / `command` / `script` fields** MUST be silently ignored; install target is always derived locally

## Known limitations on this branch

| Item | Status | Notes |
|---|---|---|
| `desktopGeneration` Cordis service | static fallback | Phase 6 uses `gen-1`; Labs picks the real source |
| `desktopProfiles.select` restart wiring | UI placeholder | The "Restart Desktop" button is rendered; the actual `select` call awaits runtime |
| `npm pack` actual publish | gated by §17-9 | Anywhere Labs owns the npm token; this branch is `private: true` |
| Plugin name on npm | unscoped `dsh-community-market` | The handoff doc suggests `@deepseek-ai/dsh-community-market`; defer to Labs |
| Live upstream pnpm build | blocked on `@deepseek-ai/dsh-root` stub | Unrelated to our plugin; tracked in task #38 |

## Files to review

- [`docs/threat-model.md`](docs/threat-model.md) — T-01..T-13 with mitigation mapping
- [`docs/security-test-table.md`](docs/security-test-table.md) — denial paths and acceptance criteria
- [`docs/section-17-5-reconciliation.md`](docs/section-17-5-reconciliation.md) — §17-5 = B contract decision
- [`docs/phase-6-report.md`](docs/phase-6-report.md) — final state
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — license attribution
- `src/host/plugin.ts` — Cordis plugin entry; reads `desktopProfiles` + `desktopPnpm` when present
- `src/host/install/routes.ts` — preview / confirm route handlers

## Reporting issues

Open a PR or issue against this branch (`codex/market-install-preview`).

For security-sensitive findings, flag in the threat model or the test
table first; security review is gated before Phase 4 implementation
per the handoff doc §14.5.