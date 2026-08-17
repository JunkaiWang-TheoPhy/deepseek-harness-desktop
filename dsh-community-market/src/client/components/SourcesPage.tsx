/**
 * Sources page renderer — source management.
 *
 * Lists LocalSourceRecord entries, allows add / enable / disable / remove.
 * All mutations go through the Host routes.
 */
import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import type { LocalSourceRecord } from '../../contracts/types.js'

export interface SourcesPageProps {
  readonly initial?: readonly LocalSourceRecord[]
  readonly host?: SourcesHostAdapter
  readonly locale?: 'zh-CN' | 'en'
}

export interface SourcesHostAdapter {
  list(): Promise<readonly LocalSourceRecord[]>
  add(input: { manifestUrl: string; providerId?: string }): Promise<LocalSourceRecord>
  remove(sourceRecordId: string): Promise<void>
  enable(sourceRecordId: string): Promise<void>
  disable(sourceRecordId: string): Promise<void>
}

export function SourcesPage(props: SourcesPageProps): JSX.Element {
  const [records, setRecords] = useState<readonly LocalSourceRecord[]>(props.initial ?? [])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    const host = props.host
    if (host === undefined) return
    void host.list().then(setRecords).catch(() => setError('list-failed'))
  }, [props.host])

  const handleAdd = async () => {
    setError(undefined)
    const host = props.host
    if (host === undefined) return
    try {
      await host.add({ manifestUrl: draft })
      setDraft('')
      setRecords(await host.list())
    } catch (cause) {
      setError(String(cause))
    }
  }

  return (
    <div className="sources-page">
      <h1>{t(props.locale ?? 'en', 'sources.title')}</h1>
      <div className="sources-add">
        <label>
          {t(props.locale ?? 'en', 'sources.add.url.label')}
          <input
            type="url"
            placeholder={t(props.locale ?? 'en', 'sources.add.url.placeholder')}
            value={draft}
            onChange={(event) => setDraft((event.target as HTMLInputElement).value)}
          />
        </label>
        <button type="button" onClick={() => void handleAdd()}>
          {t(props.locale ?? 'en', 'sources.add.submit')}
        </button>
      </div>
      {error !== undefined && <p role="alert">{t(props.locale ?? 'en', 'sources.error.failed')}: {error}</p>}
      <ul>
        {records.map((r) => (
          <li key={r.sourceRecordId}>
            <span className="source-endpoint">{r.manifestUrl ?? r.builtInProviderKey}</span>
            <span className="source-state">{r.enabled
              ? t(props.locale ?? 'en', 'sources.list.enabled')
              : t(props.locale ?? 'en', 'sources.list.disabled')}</span>
            <button
              type="button"
              onClick={() => props.host?.[r.enabled ? 'disable' : 'enable'](r.sourceRecordId).then(() => props.host?.list().then(setRecords))}
            >
              {r.enabled
                ? t(props.locale ?? 'en', 'sources.action.disable')
                : t(props.locale ?? 'en', 'sources.action.enable')}
            </button>
            <button
              type="button"
              onClick={() => props.host?.remove(r.sourceRecordId).then(() => props.host?.list().then(setRecords))}
            >
              {t(props.locale ?? 'en', 'sources.action.remove')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function renderSourcesPage(_ctx: unknown): JSX.Element {
  return <SourcesPage />
}