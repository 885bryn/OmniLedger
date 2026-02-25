import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      shell: {
        title: 'Household Asset and Commitment Tracker',
        workspace: 'HACT Workspace',
      },
      navigation: {
        dashboard: 'Dashboard',
        items: 'Items',
        events: 'Events',
      },
      language: {
        english: 'English',
        chinese: '中文',
      },
      userSwitcher: {
        actorLabel: 'Actor',
        loading: 'Loading users...',
        noUsers: 'No users',
      },
    },
  },
  zh: {
    translation: {
      shell: {
        title: '家庭资产与承诺追踪器',
        workspace: 'HACT 工作区',
      },
      navigation: {
        dashboard: '仪表盘',
        items: '资产',
        events: '事件',
      },
      language: {
        english: 'English',
        chinese: '中文',
      },
      userSwitcher: {
        actorLabel: '用户',
        loading: '正在加载用户...',
        noUsers: '暂无用户',
      },
    },
  },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
