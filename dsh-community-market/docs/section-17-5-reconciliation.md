# §17-5 Contract Reconciliation

> Status: **Authoritative for Phase 6.** Anywhere Labs selected option B
> (preinstall + 1024Store default-enabled) for the `dsh-community-market`
> package. This document reconciles that decision with the strict
> "no default source" principle in `catalog-provider-contract.zh.md`.

## Decision

§17-5 = **B**: `dsh-community-market` is **preinstalled** with the
DSH 1024Store adapter as a **default-enabled built-in partner** source.

## Reconciliation with `catalog-provider-contract.zh.md`

The contract states:

> DSH Community Market **没有默认、优先或兜底目录来源**

The reconciled reading is:

> DSH Community Market has **no user-facing default / preferred / fallback
> catalog source** for **user-added** sources. The exception is the
> DSH 1024Store adapter, which is registered as a **preinstalled partner
> source** under §17-5 = B. The 1024Store adapter is enabled by default
> in the prebuilt installation, but this enablement is governed by the
> `desktopProfiles` settings namespace (`dsh-community-market`) and may
> be disabled by the user at any time. The "no default" principle still
> applies to every other source the user adds.

## What this means concretely

| Behavior | Pre-§17-5=B | Post-§17-5=B (this document) |
|---|---|---|
| User opens market for the first time | "no sources, add one" | "DSH 1024Store (preinstalled) is available" |
| 1024Store catalog appears on first launch | No | Yes (enabled by default) |
| User adds a 1024Store manifest manually | Yes (treated as user-added) | Blocked (already preinstalled) or treated as duplicate |
| Other 1024Store-like providers | Not preinstalled | Not preinstalled (Labs preinstalls only 1024Store) |
| "Auto-fallback" if 1024Store fails | None | **Still none.** Phase 2 §"多来源聚合" rule holds: a single source failure does not silently fall back to a different one. |
| User disables 1024Store | N/A (wasn't preinstalled) | Allowed at any time; once disabled, "no default source" is fully in effect |

## Where the "no default" principle still binds

1. **Remote responses do not carry install commands.** The contract's
   "绝不执行目录返回的命令字符串" rule is unchanged. 1024Store's
   "trusted" status comes from the local adapter registration, not from
   its remote API.
2. **No silent fallback.** Phase 2 M2.7 aggregator does not switch
   sources on failure. 1024Store being "default-enabled" does not make
   it a fallback target for other sources' failures.
3. **No badge from provider claim.** The DSH 1024Store adapter's badge
   comes from the local `isBuiltInPartner: true` flag on the adapter
   registration, not from any field the partner's API returns.
4. **No telemetry / install events from the partner.** The adapter never
   invokes the partner's install / account / telemetry endpoints.
5. **User can disable at any time.** Disabling 1024Store is a single
   action; no re-install required. The DSH `desktopProfiles.select` /
   `settings.update` cycle is the standard pattern.

## Where the contract needs explicit re-statement

Two files in this repository carry the "no default" wording:

1. `docs/catalog-provider-contract.zh.md` — the wire contract. The
   "决策摘要" section now reads as a **scope qualifier**: "for
   user-added sources". The "DSH 1024Store" section now states that
   the adapter is registered as a built-in partner under §17-5 = B
   and is enabled by default in the prebuilt installation.
2. `docs/market-shell.zh.md` — the design document. The "本地状态边界"
   section now clarifies that "enabled = true" may come from a
   preinstalled registration, not only from explicit user action.
3. `docs/maintainer-defaults.md` and the §17 review thread — already
   reflect the B choice; this document is the formal contract
   reconciliation.

## Where §17-5 = B does **not** apply

- **Other provider adapters.** 1024Store is the only preinstalled
  partner. Other providers (even if they look like 1024Store) are not
  preinstalled; the user must add them and enable them manually.
- **Future partner preinstalls.** Each new preinstall requires an
  explicit §17-5 revision by Labs; this document only covers 1024Store.
- **DSH harness / DSH Desktop upstream.** The upstream DSH
  distribution does not change; Labs' preinstall decision is local
  to the `deepseek-harness-desktop` fork and the `dsh-community-market`
  package's prebuilt distribution.

## Sign-off

| Reviewer | Decision | Date |
|---|---|---|
| Anywhere Labs (initial §17 review) | Picked B for `dsh-community-market` | 2026-08-17 (per conversation) |
| External team lead | Confirms contract reconciliation | 2026-08-17 |
| Anywhere Labs (final) | Pending — blocks Phase 6 release tag |  |

Until the final row is signed, this document and the associated contract
edits are **proposed** and do not modify runtime behavior. Phase 6 ships
with the `isBuiltInPartner: true` flag wired but the default-enabled
state remains a runtime configuration, not a hard-coded behavior.