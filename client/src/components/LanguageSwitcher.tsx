import { Globe } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'ru' | 'en';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'ru', name: t('languages.ru'), flag: '🇷🇺' },
    { code: 'en', name: t('languages.en'), flag: '🇺🇸' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  const changeLanguage = useCallback(
    (langCode: Language) => {
      i18n.changeLanguage(langCode);
      setIsOpen(false);
    },
    [i18n],
  );

  // Обработчик для внешнего переключения языка
  useEffect(() => {
    const handleToggleLanguage = () => {
      const languagess: Language[] = ['ru', 'en'];
      const currentIndex = languagess.indexOf(i18n.language as Language);
      const nextIndex = (currentIndex + 1) % languagess.length;
      changeLanguage(languagess[nextIndex]);
    };

    window.addEventListener('toggle-language', handleToggleLanguage);

    return () => window.removeEventListener('toggle-language', handleToggleLanguage);
  }, [i18n.language, changeLanguage]);

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center space-x-2 px-3 py-2 rounded-lg
                   bg-white dark:bg-gray-800 night:bg-gray-900
                   border border-gray-200 dark:border-gray-700 night:border-gray-600
                   text-gray-700 dark:text-gray-200 night:text-gray-100
                   hover:bg-gray-50 dark:hover:bg-gray-700 night:hover:bg-gray-800
                   transition-colors duration-200 shadow-sm'
        title={`Current language: ${currentLanguage.name}`}
      >
        <Globe size={16} />
        <span className='text-sm font-medium'>{currentLanguage.flag}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className='fixed inset-0 z-10' onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className='absolute right-0 mt-2 w-36 z-20
                          bg-white dark:bg-gray-800 night:bg-gray-900
                          border border-gray-200 dark:border-gray-700 night:border-gray-600
                          rounded-lg shadow-lg overflow-hidden'
          >
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => changeLanguage(language.code)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-sm
                           ${
                             i18n.language === language.code
                               ? 'bg-blue-50 dark:bg-blue-900/20 night:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                               : 'text-gray-700 dark:text-gray-200 night:text-gray-100'
                           }
                           hover:bg-gray-50 dark:hover:bg-gray-700 night:hover:bg-gray-800
                           transition-colors duration-150`}
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
