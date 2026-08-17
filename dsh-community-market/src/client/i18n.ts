/**
 * i18n bundle for the market shell.
 *
 * Phase 3 ships Chinese (zh-CN) and English (en) keys. The bundle is
 * intentionally tiny — labels and state messages only — so the entry
 * can be audited by security review at a glance.
 */

export const MARKET_I18N = {
  'zh-CN': {
    'sidebar.label': '插件市场',
    'sidebar.catalog': '浏览',
    'sidebar.sources': '来源管理',
    'catalog.title': '插件市场',
    'catalog.search.placeholder': '搜索插件…',
    'catalog.empty': '没有匹配的插件。',
    'catalog.loading': '加载中…',
    'catalog.error.offline': '网络不可用，部分来源未响应。',
    'catalog.error.invalid': '来源响应无效，请稍后重试。',
    'catalog.error.partial': '部分来源失败，结果仅供参考。',
    'catalog.stale': '数据已过期',
    'catalog.retry': '重试',
    'plugin.install': '安装',
    'plugin.detail': '详情',
    'sources.title': '来源管理',
    'sources.empty': '尚未添加任何来源。',
    'sources.add': '添加来源',
    'sources.add.url.label': 'Manifest URL',
    'sources.add.url.placeholder': 'https://example.org/catalog.json',
    'sources.add.submit': '添加',
    'sources.add.cancel': '取消',
    'sources.list.endpoint': 'Endpoint',
    'sources.list.adapter': 'Adapter',
    'sources.list.enabled': '已启用',
    'sources.list.disabled': '已停用',
    'sources.action.enable': '启用',
    'sources.action.disable': '停用',
    'sources.action.remove': '删除',
    'sources.error.failed': '操作失败',
  },
  'en': {
    'sidebar.label': 'Plugins Market',
    'sidebar.catalog': 'Browse',
    'sidebar.sources': 'Sources',
    'catalog.title': 'Plugins Market',
    'catalog.search.placeholder': 'Search plugins…',
    'catalog.empty': 'No plugins match your query.',
    'catalog.loading': 'Loading…',
    'catalog.error.offline': 'Network unavailable; some sources did not respond.',
    'catalog.error.invalid': 'Source response invalid; please retry later.',
    'catalog.error.partial': 'Some sources failed; results are partial.',
    'catalog.stale': 'Stale data',
    'catalog.retry': 'Retry',
    'plugin.install': 'Install',
    'plugin.detail': 'Details',
    'sources.title': 'Sources',
    'sources.empty': 'No sources configured.',
    'sources.add': 'Add source',
    'sources.add.url.label': 'Manifest URL',
    'sources.add.url.placeholder': 'https://example.org/catalog.json',
    'sources.add.submit': 'Add',
    'sources.add.cancel': 'Cancel',
    'sources.list.endpoint': 'Endpoint',
    'sources.list.adapter': 'Adapter',
    'sources.list.enabled': 'Enabled',
    'sources.list.disabled': 'Disabled',
    'sources.action.enable': 'Enable',
    'sources.action.disable': 'Disable',
    'sources.action.remove': 'Remove',
    'sources.error.failed': 'Action failed',
  },
} as const

export type MarketI18nKey = keyof (typeof MARKET_I18N)['en']

export function t(locale: 'zh-CN' | 'en', key: MarketI18nKey): string {
  const bundle = MARKET_I18N[locale]
  return bundle[key] ?? MARKET_I18N.en[key]
}