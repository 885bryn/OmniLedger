import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from '../locales/en/common.json'
import zhCommon from '../locales/zh/common.json'

const resources = {
  en: {
    translation: enCommon,
  },
  zh: {
    translation: zhCommon,
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
