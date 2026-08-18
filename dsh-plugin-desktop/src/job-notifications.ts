/** Cordis Host plugin surfacing privacy-safe background-job attention. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-jobs'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type {} from './runtime.ts'
import { desktopJobNotificationCopy } from './tray-locale.ts'

/** Stable Cordis plugin name. */
export const name = 'desktop-job-notifications'

/** Native runtime is required; settings and jobs remain optional. */
export const inject = ['desktopRuntime']

/** Live settings namespace controlling background-job attention. */
export const DESKTOP_JOB_NOTIFICATIONS_SETTINGS_NAMESPACE = settingsNamespace('dsh-desktop-job-notifications')

/** User-configurable attention settings for background jobs. */
export interface DesktopJobNotificationSettings {
  /** Notify when a background job finishes successfully. */
  notifyOnCompletion: boolean
  /** Notify when a background job fails. */
  notifyOnFailure: boolean
}

/** Validated live settings schema for background-job attention. */
export const DesktopJobNotificationSettingsSchema: z<DesktopJobNotificationSettings> = z.object({
  notifyOnCompletion: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true),
})

const DEFAULT_SETTINGS = DesktopJobNotificationSettingsSchema({} as DesktopJobNotificationSettings)

/** Register optional live settings and job-done attention handling. */
export function apply(ctx: Context): void {
  let settings = DEFAULT_SETTINGS

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => {
      const scope = settingsCtx.settings.register(
        DESKTOP_JOB_NOTIFICATIONS_SETTINGS_NAMESPACE,
        DesktopJobNotificationSettingsSchema,
        { applies: 'live' },
      )
      settings = scope.get()
      const stopWatching = scope.watch((next) => {
        settings = next
      })
      return () => {
        stopWatching()
        settings = DEFAULT_SETTINGS
      }
    }, 'dsh-plugin-desktop: background job notification settings')
  })

  ctx.inject(['jobs'], (jobsCtx) => {
    jobsCtx.effect(() => jobsCtx.jobs.onJobDone((snapshot) => {
      if (snapshot.status === 'killed') return
      if (snapshot.status === 'completed' && !settings.notifyOnCompletion) return
      if (snapshot.status === 'failed' && !settings.notifyOnFailure) return
      if (snapshot.status !== 'completed' && snapshot.status !== 'failed') return
      jobsCtx.desktopRuntime.notifyAttention(
        desktopJobNotificationCopy(jobsCtx.desktopRuntime.locale, snapshot.status),
      )
    }), 'dsh-plugin-desktop: background job attention')
  })
}
