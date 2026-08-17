/**
 * DSH Web Client entry for the community market.
 *
 * Per catalog-provider-contract §"组合优先" + plugin-development:
 * - renderer gets no Node / Electron / fs / process / package-manager access
 * - all data flows through Host routes via the loopback carrier
 * - sidebar slot + page registration via dsh-client-ui-slots
 * - i18n via dsh-client-locale, theme via dsh-client-ui-theme
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { renderMarketPage } from './components/MarketPage.js'
import { renderSourcesPage } from './components/SourcesPage.js'
import { MARKET_I18N } from './i18n.js'

/** Stable Client plugin name. */
export const name = 'market-shell'

/** Services the Client entry needs. `i18n` is injected via the local
 *  context helper (the runtime injects it through the slot registration). */
export const inject = ['slots', 'sessions', 'theme', 'loader']

/**
 * Apply the Client plugin: register a sidebar item and two routes.
 *
 * @param ctx - browser Cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const slots = ctx.slots as unknown as SlotRegistryLike
    const sessions = ctx.sessions as unknown as SessionRegistryLike
    const i18n = (ctx as unknown as { i18n?: I18nLike }).i18n ?? defaultI18n
    slots.register({
      id: 'market-shell',
      label: () => i18n.t(MARKET_I18N, 'sidebar.label'),
      icon: 'store',
      render: ({ route }) => {
        if (route === 'sources') return renderSourcesPage(ctx)
        return renderMarketPage(ctx)
      },
      routes: [
        { id: 'catalog', path: '/market', label: () => i18n.t(MARKET_I18N, 'sidebar.catalog') },
        { id: 'sources', path: '/market/sources', label: () => i18n.t(MARKET_I18N, 'sidebar.sources') },
      ],
    })
    sessions.register({
      id: 'market-state',
      initial: { lastVisitedRoute: 'catalog' },
    })
    return () => {
      slots.unregister('market-shell')
    }
  }, 'dsh-community-market: client entry lifetime')
}

/**
 * Minimal local shape for the slot registry. The real type is generated
 * by dsh-client-ui-slots; we keep it loose so the entry compiles without
 * the DSH harness available at type-check time.
 */
interface SlotRegistryLike {
  register(slot: {
    id: string
    label: () => string
    icon: string
    render: (ctx: { route: string }) => unknown
    routes: { id: string; path: string; label: () => string }[]
  }): void
  unregister(id: string): void
}

interface SessionRegistryLike {
  register<T>(session: { id: string; initial: T }): void
}

interface I18nLike {
  t(bundle: Record<string, unknown>, key: string): string
}

/** Default i18n when the runtime doesn't inject one. */
const defaultI18n: I18nLike = {
  t: (_bundle, _key) => '',
}

export { renderMarketPage } from './components/MarketPage.js'
export { renderSourcesPage } from './components/SourcesPage.js'