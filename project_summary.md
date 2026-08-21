# Project Summary

## Scope

DSH Desktop wraps an unmodified, pinned DeepSeek Harness checkout. Desktop-owned Host, Client, Electron, packaging, and release behavior lives in `dsh-plugin-desktop/`; community interoperability and Market packages live in their respective top-level workspaces.

## Current Task

Add a pointer-positioned right-click menu to nonblank session rows. The implementation belongs in the existing Desktop Yarn patch for `@deepseek-ai/dsh-client-ui-workspace`; the `deepseek-harness/` submodule remains unchanged.

## Key Paths

- `patches/dsh-client-ui-workspace@0.1.0-rc.7.patch`: Desktop overlay on the published workspace UI.
- `dsh-plugin-desktop/src/client/session-context-menu.ts`: Desktop bridge that suppresses the native menu and resolves the exact point anchor.
- `dsh-plugin-desktop/tests/client-session-context-menu.spec.ts`: unit coverage for point compensation, blank rows, and bridge lifecycle.
- `dsh-plugin-desktop/tests/package.spec.ts`: verifies patch resolution and installed runtime markers.
- `dsh-plugin-desktop/`: Desktop Client, Host, Electron runtime, packaging, and tests.
- `deepseek-harness/`: read-only pinned upstream source reference.

## Commands

- Install: `corepack yarn install --immutable`
- Focused test: `corepack yarn workspace dsh-plugin-desktop vitest run tests/package.spec.ts`
- Full gate: `corepack yarn check`
- Development app: `corepack yarn dev`

## Baseline

On 2026-08-21, `corepack yarn check` passed on `upstream/master` at `8eaefb3149`: Market 274 tests; Desktop 651 passed and 3 skipped; runtime closure and license checks passed.

## Current Verification

- The focused package test first failed because the context-menu markers were absent, then passed after the patch was applied.
- The bridge unit test first failed because the module was absent, then passed all three native-event and lifecycle cases.
- The installed package bundle contains the row marker, `contextmenu` handler, pointer coordinates, and `getAnchorRect` menu placement.
- Browser interaction against the development Host at `127.0.0.1:50588` verified Rename, Fork, and Archive at the pointer position.
- Review follow-up moved event policy into the Desktop bridge: native menus are always suppressed, blank rows return no point, and the bridge subtracts the Menu primitive's 4px gap so final placement matches the click.
- Escape and outside click close the menu; a blank New Session row does not open it.
- The ellipsis menu remains available and Rename targets the correct current title.
- The post-change `corepack yarn check` passed: Market 274 tests; Desktop 654 passed and 3 skipped; runtime closure and license checks passed.

## Risks

- The workspace row is not a public extension slot, so this behavior is version-pinned to the published `0.1.0-rc.7` bundle and must be refreshed when upstream changes.
- The interaction was verified through the development Host in a browser; a packaged Electron build remains a release-stage check.
