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
import { StateView } from './StateView.js'
import { t } from '../i18n.js'
import type { CatalogSnapshot, CatalogSnapshotItem, CatalogQuery } from '../../contracts/types.js'

export interface MarketPageProps {
  readonly initialSnapshots?: readonly CatalogSnapshot[]
  readonly initialErrors?: readonly { sourceRecordId: string; reason: string }[]
  readonly loader?: MarketLoader
  readonly locale?: 'zh-CN' | 'en'
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
          <PluginCard key={item.id} item={item} locale={props.locale ?? 'en'} />
        ))}
      </ul>
    </div>
  )
}

function PluginCard(props: { item: CatalogSnapshotItem; locale: 'zh-CN' | 'en' }): JSX.Element {
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