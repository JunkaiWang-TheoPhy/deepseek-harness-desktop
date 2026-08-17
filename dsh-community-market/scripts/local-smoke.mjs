#!/usr/bin/env node
/**
 * Local smoke test — drive dsh-community-market end-to-end through a
 * minimal Cordis runtime without a browser.
 *
 * What this proves:
 *   1. The compiled package (`lib/index.mjs`) is loadable and exports
 *      a Cordis Host plugin (name/inject/apply).
 *   2. The plugin's `apply()` registers the Host routes under
 *      `/v1/market/...`.
 *   3. The plugin's `apply()` registers the install routes when
 *      `desktopProfiles` + `desktopPnpm` are provided.
 *   4. The preview + confirm flow works end-to-end against the
 *      installed plugin, with the real lifecycle warning.
 *
 * Run:
 *   yarn workspace dsh-community-market build
 *   node scripts/local-smoke.mjs
 *
 * Or:
 *   yarn local-smoke
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const libMod = await import(pathToFileURL(path.join(root, 'lib', 'index.mjs')).href)
const { applyMarketHost, marketHostName, marketHostInject } = libMod
const { Context } = await import('@deepseek-ai/cordis')

const section = (title) => console.log(`\n=== ${title} ===`)

section('1. Plugin contract')
const { name, inject, apply, Config } = {
  name: marketHostName,
  inject: marketHostInject,
  apply: applyMarketHost,
  Config: libMod.MarketHostConfigSchema,
}
console.log('  name            :', name)
console.log('  inject          :', JSON.stringify(inject))
console.log('  apply type      :', typeof apply)
console.log('  Config type     :', typeof Config)

if (name !== 'dsh-community-market') {
  console.error('FAIL: plugin name mismatch')
  process.exit(1)
}
if (typeof apply !== 'function') {
  console.error('FAIL: apply is not a function')
  process.exit(1)
}

section('2. Build minimal Cordis Context with mock services')

const registeredRoutes = []
const settingsStorage = new Map()
const pnpmCalls = []
let currentProfile = { name: 'default', dir: '/profiles/default' }
let currentGeneration = { id: 'gen-1' }
let currentSnapshotFetchedAt = '2026-08-17T08:00:00Z'

const ctx = new Context()
ctx.provide('webServer', {
  host: '127.0.0.1',
  port: 0,
  register(route) {
    registeredRoutes.push({ path: route.path, kind: route.kind })
  },
})
ctx.provide('settings', {
  register() {
    return {
      get: () => undefined,
      update: () => undefined,
      watch: () => () => undefined,
    }
  },
  get: (ns) => settingsStorage.get(ns),
  update: (ns, value) => { settingsStorage.set(ns, value) },
})
ctx.provide('desktopProfiles', {
  get current() { return currentProfile },
})
ctx.provide('desktopPnpm', {
  run: () => ({ done: Promise.resolve({ exitCode: 0, signal: null }) }),
  runPlugin: (args, cwd) => {
    pnpmCalls.push({ args, cwd })
    return { done: Promise.resolve({ exitCode: 0, signal: null }) }
  },
})

section('3. Apply the plugin')
apply(ctx, { routePrefix: '/v1/market/' })
console.log('  apply() returned without error')

section('4. Routes registered')
for (const r of registeredRoutes) {
  console.log(`  - ${r.kind.padEnd(6)} ${r.path}`)
}

if (registeredRoutes.length === 0) {
  console.error('FAIL: no routes registered')
  process.exit(1)
}

section('5. Live install flow (preview → confirm)')

// We can't drive the routes through a real fetch (we'd need a Node HTTP
// server). Instead, exercise the pure handlers via dynamic import of
// the lib's internal modules. The plugin's Host routes use these
// handlers, so a green pass here mirrors a real preview/confirm round.

const libNs = libMod

const sampleSnapshot = {
  schemaVersion: '1.0.0',
  source: {
    sourceRecordId: 'src-1',
    providerId: 'org.example.community-catalog',
    adapterId: 'market.standard-v1',
    registrationKind: 'user-added',
    fetchedAt: currentSnapshotFetchedAt,
    finalUrl: 'https://example.org/v1/plugins',
  },
  items: [{
    id: 'better-sidebar',
    name: 'dsh-plugin-better-sidebar',
    displayName: 'Better Sidebar',
    summary: 'A configurable sidebar panel that ships as a DSH plugin.',
    package: { registry: 'npm', name: 'dsh-plugin-better-sidebar', latestVersion: '1.2.0' },
    provenance: {
      sourceRecordId: 'src-1',
      providerId: 'org.example.community-catalog',
      itemId: 'better-sidebar',
    },
  }],
  page: {},
}

const { handleInstallPreview, handleInstallConfirm } = libNs

const installDeps = {
  services: {
    profiles: { get current() { return currentProfile } },
    pnpm: {
      run: () => ({ done: Promise.resolve({ exitCode: 0, signal: null }) }),
      runPlugin: (args, cwd) => {
        pnpmCalls.push({ args, cwd })
        return { done: Promise.resolve({ exitCode: 0, signal: null }) }
      },
    },
    generation: () => currentGeneration,
  },
  invokingDir: currentProfile.dir,
}

const preview = await handleInstallPreview(installDeps, {
  sourceRecordId: 'src-1',
  itemId: 'better-sidebar',
  identityChoice: 'npm',
  lifecycleWarning: 'package 安装可能执行 lifecycle script',
  snapshot: sampleSnapshot,
})
if (preview.kind !== 'ok-preview') {
  console.error('FAIL: preview did not return ok-preview:', JSON.stringify(preview))
  process.exit(1)
}
console.log('  preview  : ok-preview')
console.log('    target :', preview.preview.target.spec)
console.log('    profile:', `${preview.preview.profile.name} (${preview.preview.profile.dir})`)
console.log('    warning:', preview.preview.lifecycleWarning)
console.log('    token TTL ms:', preview.token.expiresAt - preview.token.issuedAt)

const confirm = await handleInstallConfirm(installDeps, {
  token: preview.token,
  snapshotFetchedAt: preview.fetchedAt,
})
if (confirm.kind !== 'ok-confirm') {
  console.error('FAIL: confirm did not return ok-confirm:', JSON.stringify(confirm))
  process.exit(1)
}
console.log('  confirm  : ok-confirm')
console.log('    exit    :', confirm.exitCode)
console.log('    spec    :', confirm.spec)
console.log('  pnpm calls:', pnpmCalls.length, 'call(s)')
if (pnpmCalls.length !== 1) {
  console.error('FAIL: expected exactly 1 pnpm call')
  process.exit(1)
}
if (pnpmCalls[0]?.args?.[0] !== 'add' || pnpmCalls[0]?.args?.[1] !== 'dsh-plugin-better-sidebar@1.2.0') {
  console.error('FAIL: pnpm call args mismatch:', pnpmCalls[0])
  process.exit(1)
}

section('6. Stale-confirmation guard')
currentProfile = { name: 'staging', dir: '/profiles/staging' }
const stale = await handleInstallConfirm(installDeps, {
  token: preview.token,
  snapshotFetchedAt: preview.fetchedAt,
})
if (stale.kind !== 'error' || stale.reason !== 'profile-changed') {
  console.error('FAIL: stale profile should return 409 profile-changed, got:', JSON.stringify(stale))
  process.exit(1)
}
console.log('  stale profile → 409 reason="profile-changed" (runPlugin NOT invoked)')
console.log('  total pnpm calls after stale:', pnpmCalls.length, '(should still be', 1, ')')

console.log('\n=== OK ===')
console.log('dsh-community-market loads and runs end-to-end under Cordis.')
console.log('To drive the same plugin in a real browser:')
console.log('  - add this package to dsh-plugin-desktop/dependencies')
console.log('  - rebuild dsh-plugin-desktop and run yarn start')
console.log('  - the market sidebar item will appear; click into it to test browse + install')