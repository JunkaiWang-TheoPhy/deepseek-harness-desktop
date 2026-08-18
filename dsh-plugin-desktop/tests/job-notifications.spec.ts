import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { JobId, JobSnapshot } from '@deepseek-ai/dsh-jobs'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type { DesktopRuntime } from '../src/runtime.ts'
import {
  apply,
  DesktopJobNotificationSettingsSchema,
  DESKTOP_JOB_NOTIFICATIONS_SETTINGS_NAMESPACE,
  inject,
  name,
  type DesktopJobNotificationSettings,
} from '../src/job-notifications.ts'

interface HarnessOptions {
  readonly jobs?: boolean
  readonly settings?: boolean
  readonly locale?: DesktopRuntime['locale']
}

interface Harness {
  readonly runtime: DesktopRuntime
  readonly notifyAttention: ReturnType<typeof vi.fn>
  readonly register: ReturnType<typeof vi.fn>
  readonly watchStop: ReturnType<typeof vi.fn>
  readonly disposeJobs: ReturnType<typeof vi.fn>
  readonly disposers: Array<() => void>
  jobDone(snapshot: JobSnapshot): Promise<void>
  updateSettings(next: DesktopJobNotificationSettings): Promise<void>
  dispose(): void
}

function createHarness(options: HarnessOptions = {}): Harness {
  const notifyAttention = vi.fn()
  const watchStop = vi.fn()
  const disposeJobs = vi.fn()
  const settingsState = {
    current: DesktopJobNotificationSettingsSchema({} as DesktopJobNotificationSettings),
  }
  let watcher:
    | ((next: DesktopJobNotificationSettings, prev: DesktopJobNotificationSettings) => void | Promise<void>)
    | undefined
  let onJobDone:
    | ((snapshot: JobSnapshot) => void | PromiseLike<void>)
    | undefined
  const disposers: Array<() => void> = []
  const runtime = {
    locale: options.locale ?? 'en',
    platform: 'darwin',
    updates: {
      isPackaged: false,
      canDownload: false,
      currentVersion: '2.0.1',
      statePath: '/tmp/dsh-desktop-update-state.json',
      request: async () => new Response(null, { status: 304 }),
      confirmDownload: async () => false,
      showManualCheckResult: async () => {},
      downloadAndOpen: async () => {},
      notify: () => {},
    },
    schedule: () => async () => {},
    mountScheduled: async () => {},
    show: () => {},
    notifyAttention,
    registerTrayItem: () => ({ refresh: () => {}, dispose: () => {} }),
    openTerminal: () => {},
    exportDiagnostics: async () => {},
    reportRendererBoot: () => {},
    setLocalePreference: () => {},
    setThemeSource: () => {},
    requestRestart: async () => {},
    prepareToQuit: () => {},
  } as unknown as DesktopRuntime
  const register = vi.fn((_namespace, _schema, _options) => ({
    get: () => settingsState.current,
    watch: (callback: typeof watcher) => {
      watcher = callback
      return watchStop
    },
    update: vi.fn(async () => {}),
    replace: vi.fn(async () => {}),
  } satisfies SettingsScope<DesktopJobNotificationSettings>))
  const ctx = {
    desktopRuntime: runtime,
    settings: { register },
    jobs: {
      onJobDone: vi.fn((listener: typeof onJobDone) => {
        onJobDone = listener
        return disposeJobs
      }),
    },
    inject: vi.fn((services: string[], callback: (child: Context) => void) => {
      if (services.every(service => options[service as keyof HarnessOptions] ?? true)) {
        callback(ctx as unknown as Context)
      }
    }),
    effect: vi.fn((registerEffect: () => (() => void) | void) => {
      const dispose = registerEffect()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    }),
  } as unknown as Context

  apply(ctx)

  return {
    runtime,
    notifyAttention,
    register,
    watchStop,
    disposeJobs,
    disposers,
    async jobDone(snapshot: JobSnapshot) {
      await onJobDone?.(snapshot)
    },
    async updateSettings(next: DesktopJobNotificationSettings) {
      const previous = settingsState.current
      settingsState.current = next
      await watcher?.(next, previous)
    },
    dispose() {
      for (const dispose of disposers.splice(0).reverse()) dispose()
    },
  }
}

describe('desktop background-job notifications Host plugin', () => {
  it('registers live settings defaults when a settings service is present', () => {
    const harness = createHarness({ jobs: false, settings: true })

    expect(name).toBe('desktop-job-notifications')
    expect(inject).toEqual(['desktopRuntime'])
    expect(DesktopJobNotificationSettingsSchema({} as DesktopJobNotificationSettings)).toEqual({
      notifyOnCompletion: true,
      notifyOnFailure: true,
    })
    expect(String(DESKTOP_JOB_NOTIFICATIONS_SETTINGS_NAMESPACE)).toBe('dsh-desktop-job-notifications')
    expect(harness.register).toHaveBeenCalledWith(
      DESKTOP_JOB_NOTIFICATIONS_SETTINGS_NAMESPACE,
      DesktopJobNotificationSettingsSchema,
      { applies: 'live' },
    )
  })

  it('wires optional services independently and disposes their registrations', () => {
    const jobsOnly = createHarness({ jobs: true, settings: false })
    const settingsOnly = createHarness({ jobs: false, settings: true })

    expect(jobsOnly.register).not.toHaveBeenCalled()
    expect(jobsOnly.disposeJobs).not.toHaveBeenCalled()
    jobsOnly.dispose()
    expect(jobsOnly.disposeJobs).toHaveBeenCalledOnce()

    expect(settingsOnly.register).toHaveBeenCalledOnce()
    expect(settingsOnly.disposeJobs).not.toHaveBeenCalled()
    settingsOnly.dispose()
    expect(settingsOnly.watchStop).toHaveBeenCalledOnce()
  })

  it('routes completed and failed jobs, suppresses killed jobs, and keeps native copy privacy-safe', async () => {
    const harness = createHarness({ jobs: true, settings: true, locale: 'zh' })
    const sensitive = {
      id: 'bash-7' as JobId,
      kind: 'bash',
      label: 'python /Users/example/project/run_secret.py --workspace /tmp/private',
      status: 'completed',
      detail: 'exit code: 0',
      output: 'session-123 /Users/example/private-output',
      startedAt: 1,
      finishedAt: 2,
      reported: false,
    } satisfies JobSnapshot & { output?: string }

    await harness.jobDone(sensitive)
    await harness.jobDone({ ...sensitive, status: 'failed' })
    await harness.jobDone({ ...sensitive, status: 'killed' })

    expect(harness.notifyAttention).toHaveBeenCalledTimes(2)
    expect(harness.notifyAttention).toHaveBeenNthCalledWith(1, {
      title: '后台任务已完成',
      body: '有一个后台任务已结束。',
    })
    expect(harness.notifyAttention).toHaveBeenNthCalledWith(2, {
      title: '后台任务失败',
      body: '有一个后台任务需要处理。',
    })
    for (const [{ title, body }] of harness.notifyAttention.mock.calls) {
      expect(`${title} ${body}`).not.toContain('/Users/example')
      expect(`${title} ${body}`).not.toContain('run_secret.py')
      expect(`${title} ${body}`).not.toContain('session-123')
      expect(`${title} ${body}`).not.toContain('private-output')
    }
  })

  it('suppresses the matching outcome when live settings disable it', async () => {
    const harness = createHarness({ jobs: true, settings: true })
    const baseSnapshot: JobSnapshot = {
      id: 'bash-2' as JobId,
      kind: 'bash',
      label: 'pnpm install',
      status: 'completed',
      startedAt: 1,
      finishedAt: 2,
      reported: false,
    }

    await harness.updateSettings({
      notifyOnCompletion: false,
      notifyOnFailure: true,
    })
    await harness.jobDone(baseSnapshot)
    await harness.jobDone({ ...baseSnapshot, status: 'failed' })

    await harness.updateSettings({
      notifyOnCompletion: true,
      notifyOnFailure: false,
    })
    await harness.jobDone(baseSnapshot)
    await harness.jobDone({ ...baseSnapshot, status: 'failed' })

    expect(harness.notifyAttention.mock.calls).toEqual([
      [{ title: 'Background Job Failed', body: 'A background job needs attention.' }],
      [{ title: 'Background Job Completed', body: 'A background job has finished.' }],
    ])
  })
})
