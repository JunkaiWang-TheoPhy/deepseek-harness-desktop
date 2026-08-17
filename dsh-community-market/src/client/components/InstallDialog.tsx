/**
 * Two-step install confirm dialog (M6.3).
 *
 * Phase 6 default: the preview payload is fetched from the Host's
 * `/v1/market/install/preview` route; the second step confirms against
 * `/v1/market/install/confirm`. The lifecycle warning is rendered
 * verbatim from the i18n bundle so the security test table can assert
 * its presence.
 *
 * The dialog is uncontrolled in the sense that the host (MarketPage)
 * drives state via props; this component just renders.
 */
import * as React from 'react'
import { t } from '../i18n.js'

export interface InstallPreviewPayload {
  readonly preview: {
    readonly pluginName: string
    readonly displayName: string
    readonly summary: string
    readonly target:
      | { readonly kind: 'npm'; readonly spec: string }
      | { readonly kind: 'git'; readonly spec: string }
    readonly profile: { readonly name: string; readonly dir: string }
    readonly lifecycleWarning: string
  }
  readonly token: {
    readonly sourceRecordId: string
    readonly itemId: string
    readonly choice: 'npm' | 'repository'
    readonly target: { readonly kind: string; readonly spec: string }
    readonly profile: { readonly name: string; readonly dir: string }
    readonly generation: { readonly id: string }
    readonly fetchedAt: string
    readonly issuedAt: number
    readonly expiresAt: number
  }
  readonly fetchedAt: string
}

export interface InstallConfirmPayload {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly spec: string
}

export interface InstallErrorPayload {
  readonly reason: string
  readonly detail?: string
}

export interface InstallDialogProps {
  readonly open: boolean
  readonly locale: 'zh-CN' | 'en'
  /** Locale-bundled strings. */
  readonly i18n: {
    readonly title: string
    readonly installButton: string
    readonly cancelButton: string
    readonly confirmButton: string
    readonly target: string
    readonly profile: string
    readonly lifecycle: string
    readonly success: string
    readonly failed: string
    readonly staleError: (reason: string) => string
    readonly identityChoiceRequired: string
  }
  readonly preview: InstallPreviewPayload | null
  readonly result: InstallConfirmPayload | null
  readonly error: InstallErrorPayload | null
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function InstallDialog(props: InstallDialogProps): React.JSX.Element | null {
  if (!props.open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-install-dialog-title"
      className="market-install-dialog"
    >
      <h2 id="market-install-dialog-title">{props.i18n.title}</h2>
      {props.preview !== null && (
        <section>
          <p><strong>{props.preview.preview.displayName}</strong> · {props.preview.preview.summary}</p>
          <dl>
            <dt>{props.i18n.target}</dt>
            <dd><code>{props.preview.preview.target.spec}</code></dd>
            <dt>{props.i18n.profile}</dt>
            <dd>
              <code>{props.preview.preview.profile.name}</code> ·{' '}
              <code>{props.preview.preview.profile.dir}</code>
            </dd>
          </dl>
          <p role="alert" className="market-install-lifecycle">
            {props.preview.preview.lifecycleWarning}
          </p>
        </section>
      )}
      {props.error !== null && (
        <p role="alert" className="market-install-error">
          {props.error.reason === 'identity-choice-required'
            ? props.i18n.identityChoiceRequired
            : props.i18n.staleError(props.error.reason)}
          {props.error.detail !== undefined ? ` (${props.error.detail})` : ''}
        </p>
      )}
      {props.result !== null && (
        <p role="status" className="market-install-success">
          {props.i18n.success} · <code>{props.result.spec}</code>
        </p>
      )}
      <div className="market-install-dialog-actions">
        <button type="button" onClick={props.onCancel}>{props.i18n.cancelButton}</button>
        {props.preview !== null && props.result === null && (
          <button type="button" onClick={props.onConfirm} disabled={props.busy}>
            {props.i18n.confirmButton}
          </button>
        )}
      </div>
    </div>
  )
}
