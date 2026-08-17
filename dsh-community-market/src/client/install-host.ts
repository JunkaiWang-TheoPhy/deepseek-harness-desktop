/**
 * Install host adapter (M6.3).
 *
 * Bridges the Client UI to the Host's `/v1/market/install/{preview,confirm}`
 * routes. The renderer never sees a `target` field — the Host derives it
 * locally (threat model T-11).
 */

export interface PreviewRequestPayload {
  readonly sourceRecordId: string
  readonly itemId: string
  readonly identityChoice?: 'npm' | 'repository'
  readonly lifecycleWarning: string
  readonly snapshot: {
    readonly fetchedAt: string
    readonly source: { readonly providerId: string }
    readonly items: readonly unknown[]
  }
}

export interface ConfirmRequestPayload {
  readonly token: unknown
  readonly snapshotFetchedAt: string
}

export interface PreviewResponsePayload {
  readonly preview: unknown
  readonly token: unknown
  readonly fetchedAt: string
}

export interface ConfirmResponsePayload {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly spec: string
}

export interface ErrorResponsePayload {
  readonly error: { readonly reason: string; readonly detail?: string }
}

export interface InstallHostAdapter {
  /** POST /v1/market/install/preview; returns either a 200 ok-preview or an error. */
  requestPreview(body: PreviewRequestPayload): Promise<PreviewResponsePayload | ErrorResponsePayload>
  /** POST /v1/market/install/confirm; returns either a 200 ok-confirm or an error. */
  requestConfirm(body: ConfirmRequestPayload): Promise<ConfirmResponsePayload | ErrorResponsePayload>
}

/** Detect an error response by the presence of `error`. */
export function isErrorResponse(value: PreviewResponsePayload | ErrorResponsePayload): value is ErrorResponsePayload {
  return 'error' in value
}
export function isErrorConfirm(value: ConfirmResponsePayload | ErrorResponsePayload): value is ErrorResponsePayload {
  return 'error' in value
}

/** A simple fetch-based adapter for the production DSH harness. */
export function makeFetchInstallHost(baseUrl: string): InstallHostAdapter {
  const previewUrl = `${baseUrl.replace(/\/$/, '')}/v1/market/install/preview`
  const confirmUrl = `${baseUrl.replace(/\/$/, '')}/v1/market/install/confirm`
  return {
    async requestPreview(body) {
      const res = await fetch(previewUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return await res.json() as PreviewResponsePayload | ErrorResponsePayload
    },
    async requestConfirm(body) {
      const res = await fetch(confirmUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return await res.json() as ConfirmResponsePayload | ErrorResponsePayload
    },
  }
}