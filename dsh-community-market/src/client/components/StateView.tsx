/**
 * State view component.
 *
 * Shows one of: loading, empty, offline, invalid, partial, stale. Errors
 * are surfaced per-source so a single failing source doesn't hide the
 * valid results from others.
 */
import { t } from '../i18n.js'

export type StateStatus = 'loading' | 'ok' | 'empty' | 'offline' | 'invalid' | 'partial' | 'stale'

export interface StateViewProps {
  readonly status: StateStatus
  readonly locale: 'zh-CN' | 'en'
  readonly errors: readonly { sourceRecordId: string; reason: string }[]
  readonly onRetry: () => void
}

export function StateView(props: StateViewProps): JSX.Element | null {
  if (props.status === 'ok') return null
  const key = messageKey(props.status)
  return (
    <div className={`market-state market-state-${props.status}`} role="status" aria-live="polite">
      <p>{t(props.locale, key)}</p>
      {props.errors.length > 0 && (
        <ul className="market-state-errors">
          {props.errors.map((e) => (
            <li key={e.sourceRecordId}>
              <code>{e.sourceRecordId.slice(0, 8)}</code> · {e.reason}
            </li>
          ))}
        </ul>
      )}
      {props.status !== 'loading' && (
        <button type="button" onClick={props.onRetry}>{t(props.locale, 'catalog.retry')}</button>
      )}
    </div>
  )
}

function messageKey(status: Exclude<StateStatus, 'ok'>): keyof typeof import('../i18n.js').MARKET_I18N['en'] {
  switch (status) {
    case 'loading': return 'catalog.loading'
    case 'empty': return 'catalog.empty'
    case 'offline': return 'catalog.error.offline'
    case 'invalid': return 'catalog.error.invalid'
    case 'partial': return 'catalog.error.partial'
    case 'stale': return 'catalog.stale'
  }
}