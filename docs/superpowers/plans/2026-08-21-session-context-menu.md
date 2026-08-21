# Session Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the existing session actions menu at the pointer when a user right-clicks a nonblank session row in DSH Desktop.

**Architecture:** Extend the existing Desktop-owned Yarn patch for `@deepseek-ai/dsh-client-ui-workspace`. Reuse the package's current `Menu`, rename, fork, and archive callbacks; add only pointer-position anchoring and context-menu event handling, leaving the pinned upstream source checkout untouched.

**Tech Stack:** React, DSH UI primitives, Yarn patch protocol, Vitest, Playwright.

**Spec:** User-provided Codex context-menu screenshot in the current task; the screenshot is interaction reference only.

## Global Constraints

- Do not edit `deepseek-harness/`.
- Preserve the ellipsis menu and drag-and-drop behavior.
- Blank New Session rows must not open a context menu.
- Use only actions already owned by the workspace browser: Rename, Fork, Archive.

---

### Task 1: Patch verification

**Files:**
- Create: `dsh-plugin-desktop/src/client/session-context-menu.ts`
- Create: `dsh-plugin-desktop/tests/client-session-context-menu.spec.ts`
- Modify: `dsh-plugin-desktop/tests/package.spec.ts`
- Modify: `patches/dsh-client-ui-workspace@0.1.0-rc.7.patch`

**Interfaces:**
- Consumes: the published workspace browser bundle.
- Produces: a patched session row with pointer-position menu anchoring.

- [x] Write a failing package test for context-menu markers.
- [x] Run the focused test and confirm it fails on the missing behavior.
- [x] Add right-click handling to the existing workspace patch.
- [x] Refresh Yarn's installed patched package and lock hash.
- [x] Run the focused test and confirm it passes.

### Task 2: Interaction verification

**Files:**
- Modify only if a defect is found: workspace patch or focused tests.

**Interfaces:**
- Consumes: the packaged client bundle produced by Task 1.
- Produces: verified pointer and keyboard behavior.

- [x] Run typecheck and package tests.
- [x] Start the desktop development app.
- [x] Verify right-click placement, selection dispatch, outside-click close, and Escape close.
- [x] Verify the ellipsis menu and drag behavior still work.
- [x] Lock native-menu suppression, blank-row rejection, and exact point compensation in unit tests.

### Task 3: Delivery

**Files:**
- Modify: `project_summary.md`

**Interfaces:**
- Consumes: verified implementation and test evidence.
- Produces: reviewable commit and PR.

- [x] Run `corepack yarn check`.
- [x] Update the project map and remaining risks.
- [ ] Commit with Lore trailers, push the branch, and open the upstream PR.
