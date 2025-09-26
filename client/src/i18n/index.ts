import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Импорты переводов
import en from './locales/en.json';
import ru from './locales/ru.json';

const resources = {
  ru: {
    translation: ru,
  },
  en: {
    translation: en,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    debug: import.meta.env.MODE === 'development',

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React уже экранирует значения
    },

    // Настройки для языков
    supportedLngs: ['ru', 'en'],

    // Настройки загрузки
    load: 'languageOnly',

    // Настройки для локализации
    keySeparator: '.',
    nsSeparator: false,
  });

export default i18n;
