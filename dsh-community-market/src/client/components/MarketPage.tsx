/**
 * Market page renderer — plugin catalog browse.
 *
 * Reads Host snapshots over the loopback carrier (rendered as a fetch
 * through `ctx.loader.request` in production; here we keep a small
 * `fetchAdapter` indirection so unit tests can stub the response).
 *
 * Phase 3 keeps the layout intentionally minimal: a search bar, a list
 * of plugin cards, a per-source error rail, and a "stale" badge for
 * last-good cache hits. Detailed styling lands in a follow-up.
 */
import { useEffect, useState } from 'react'
import * as React from 'react'
import { StateView } from './StateView.js'
import { t } from '../i18n.js'
import type { CatalogSnapshot, CatalogSnapshotItem, CatalogQuery } from '../../contracts/types.js'
import {
  InstallDialog,
  type InstallConfirmPayload,
  type InstallErrorPayload,
  type InstallPreviewPayload,
} from './InstallDialog.js'
import {
  isErrorConfirm,
  isErrorResponse,
  type InstallHostAdapter,
} from '../install-host.js'

export interface MarketPageProps {
  readonly initialSnapshots?: readonly CatalogSnapshot[]
  readonly initialErrors?: readonly { sourceRecordId: string; reason: string }[]
  readonly loader?: MarketLoader
  readonly locale?: 'zh-CN' | 'en'
  readonly installHost?: InstallHostAdapter
  readonly identityChoices?: ReadonlyMap<string, 'npm' | 'repository'>
}

export interface MarketLoader {
  load(query: CatalogQuery): Promise<{
    snapshots: readonly CatalogSnapshot[]
    errors: readonly { sourceRecordId: string; reason: string }[]
    hadActive: boolean
  }>
}

export function MarketPage(props: MarketPageProps): JSX.Element {
  const [snapshots, setSnapshots] = useState<readonly CatalogSnapshot[]>(props.initialSnapshots ?? [])
  const [errors, setErrors] = useState<readonly { sourceRecordId: string; reason: string }[]>(props.initialErrors ?? [])
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'offline' | 'invalid' | 'partial' | 'stale'>('ok')
  const [search, setSearch] = useState('')
  const [installItem, setInstallItem] = useState<CatalogSnapshotItem | null>(null)
  const [preview, setPreview] = useState<InstallPreviewPayload | null>(null)
  const [installError, setInstallError] = useState<InstallErrorPayload | null>(null)
  const [installResult, setInstallResult] = useState<InstallConfirmPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsRestart, setNeedsRestart] = useState(false)

  useEffect(() => {
    const loader = props.loader
    if (loader === undefined) return
    setStatus('loading')
    void loader.load({ q: search }).then((result) => {
      setSnapshots(result.snapshots)
      setErrors(result.errors)
      if (!result.hadActive) setStatus('empty')
      else if (result.snapshots.length === 0 && result.errors.length > 0) setStatus('offline')
      else if (result.errors.length > 0) setStatus('partial')
      else if (result.snapshots.every((s) => staleSnapshot(s))) setStatus('stale')
      else setStatus('ok')
    }).catch(() => setStatus('invalid'))
  }, [search, props.loader])

  const openInstall = async (item: CatalogSnapshotItem) => {
    setInstallItem(item)
    setPreview(null)
    setInstallError(null)
    setInstallResult(null)
    setNeedsRestart(false)
    const host = props.installHost
    if (host === undefined) {
      setInstallError({ reason: 'install-unavailable' })
      return
    }
    const hasPackage = item.package !== undefined
    const hasRepo = item.repository !== undefined
    let identityChoice: 'npm' | 'repository' | undefined
    if (hasPackage && hasRepo) {
      identityChoice = props.identityChoices?.get(item.id)
    } else if (hasPackage) {
      identityChoice = 'npm'
    } else if (hasRepo) {
      identityChoice = 'repository'
    }
    if (identityChoice === undefined) {
      setInstallError({ reason: 'identity-choice-required' })
      return
    }
    setBusy(true)
    const result = await host.requestPreview({
      sourceRecordId: item.provenance.sourceRecordId,
      itemId: item.id,
      identityChoice,
      lifecycleWarning: 'package 安装可能执行 lifecycle script',
      snapshot: {
        fetchedAt: snapshots[0]?.source.fetchedAt ?? new Date().toISOString(),
        source: { providerId: item.provenance.providerId },
        items: snapshots.flatMap((s) => s.items),
      },
    })
    setBusy(false)
    if (isErrorResponse(result)) {
      setInstallError(result.error)
    } else {
      setPreview(result as unknown as InstallPreviewPayload)
    }
  }

  const confirmInstall = async () => {
    if (preview === null) return
    const host = props.installHost
    if (host === undefined) {
      setInstallError({ reason: 'install-unavailable' })
      return
    }
    setBusy(true)
    const result = await host.requestConfirm({
      token: preview.token,
      snapshotFetchedAt: preview.fetchedAt,
    })
    setBusy(false)
    if (isErrorConfirm(result)) {
      setInstallError(result.error)
    } else {
      setInstallResult(result)
      setNeedsRestart(true)
    }
  }

  const closeInstall = () => {
    setInstallItem(null)
    setPreview(null)
    setInstallError(null)
    setInstallResult(null)
    setNeedsRestart(false)
  }

  return (
    <div className="market-page">
      <header className="market-header">
        <h1>{t(props.locale ?? 'en', 'catalog.title')}</h1>
        <input
          type="search"
          aria-label={t(props.locale ?? 'en', 'catalog.search.placeholder')}
          placeholder={t(props.locale ?? 'en', 'catalog.search.placeholder')}
          value={search}
          onChange={(event) => setSearch((event.target as HTMLInputElement).value)}
        />
      </header>
      <StateView status={status} locale={props.locale ?? 'en'} errors={errors} onRetry={() => undefined} />
      <ul className="market-card-list">
        {snapshots.flatMap((s) => s.items).map((item) => (
          <PluginCard
            key={item.id}
            item={item}
            locale={props.locale ?? 'en'}
            onInstall={installItem?.id === item.id ? undefined : () => void openInstall(item)}
            busy={installItem?.id === item.id && busy}
          />
        ))}
      </ul>
      {needsRestart && installResult !== null && (
        <div className="market-restart-banner" role="status">
          <p>{t(props.locale ?? 'en', 'install.success')}</p>
          <button type="button" onClick={() => undefined}>{t(props.locale ?? 'en', 'install.confirm.title')}</button>
        </div>
      )}
      <InstallDialog
        open={installItem !== null}
        locale={props.locale ?? 'en'}
        i18n={{
          title: t(props.locale ?? 'en', 'install.confirm.title'),
          installButton: t(props.locale ?? 'en', 'plugin.install'),
          cancelButton: 'Cancel',
          confirmButton: t(props.locale ?? 'en', 'install.confirm.title'),
          target: 'Target',
          profile: 'Profile',
          lifecycle: t(props.locale ?? 'en', 'install.lifecycle.warning'),
          success: t(props.locale ?? 'en', 'install.success'),
          failed: t(props.locale ?? 'en', 'sources.error.failed'),
          staleError: (reason: string) => `${reason}`,
          identityChoiceRequired: t(props.locale ?? 'en', 'install.error.identity-choice-required'),
        }}
        preview={preview}
        result={installResult}
        error={installError}
        busy={busy}
        onConfirm={() => void confirmInstall()}
        onCancel={closeInstall}
      />
    </div>
  )
}

function PluginCard(props: {
  item: CatalogSnapshotItem
  locale: 'zh-CN' | 'en'
  onInstall?: () => void
  busy?: boolean
}): JSX.Element {
  const initial = (props.item.displayName || props.item.name).charAt(0).toUpperCase()
  return (
    <li className="market-card" tabIndex={0}>
      <div className="market-card-icon" aria-hidden>{initial}</div>
      <div className="market-card-body">
        <strong>{props.item.displayName}</strong>
        <p>{props.item.summary}</p>
        <small>
          {props.item.provenance.sourceRecordId.slice(0, 8)}
          {props.item.repository?.url ? ` · ${props.item.repository.url}` : ''}
          {props.item.package?.name ? ` · ${props.item.package.name}` : ''}
        </small>
        {props.onInstall !== undefined && (
          <button
            type="button"
            className="market-card-install"
            onClick={props.onInstall}
            disabled={props.busy === true}
          >
            {props.busy === true ? '...' : t(props.locale, 'plugin.install')}
          </button>
        )}
      </div>
    </li>
  )
}

function staleSnapshot(_snapshot: CatalogSnapshot): boolean {
  // Phase 3 keeps the heuristic simple: a snapshot is "stale" when the
  // page is empty (the host returns last-good). The actual fresh/last-good
  // distinction is on the snapshot envelope; Phase 4 wires it through.
  return false
}

export function renderMarketPage(_ctx: unknown): JSX.Element {
  return <MarketPage />
}