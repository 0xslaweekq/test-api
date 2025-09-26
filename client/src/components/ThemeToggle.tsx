import { Sun, Moon, Monitor } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme, setTheme } from '../hooks/useTheme';

type Theme = 'light' | 'dark' | 'night';

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [isOpen, setIsOpen] = useState(false);

  // Обработчик для внешнего переключения темы
  useEffect(() => {
    const handleToggleTheme = () => {
      const themes: Theme[] = ['light', 'dark', 'night'];
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    };

    window.addEventListener('toggle-theme', handleToggleTheme);

    return () => window.removeEventListener('toggle-theme', handleToggleTheme);
  }, [theme]);

  const themes: { name: Theme; icon: React.ReactNode; label: string }[] = [
    { name: 'light', icon: <Sun size={16} />, label: t('themes.light') },
    { name: 'dark', icon: <Moon size={16} />, label: t('themes.dark') },
    { name: 'night', icon: <Monitor size={16} />, label: t('themes.night') },
  ];

  const currentTheme = themes.find((t) => t.name === theme);

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
      >
        {currentTheme?.icon}
        <span className='text-sm font-medium'>{currentTheme?.label}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className='fixed inset-0 z-10' onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className='absolute right-0 mt-2 w-40 z-20
                          bg-white dark:bg-gray-800 night:bg-gray-900
                          border border-gray-200 dark:border-gray-700 night:border-gray-600
                          rounded-lg shadow-lg overflow-hidden'
          >
            {themes.map((themeOption) => (
              <button
                key={themeOption.name}
                onClick={() => {
                  setTheme(themeOption.name as Theme);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-sm
                           ${
                             theme === themeOption.name
                               ? 'bg-blue-50 dark:bg-blue-900/20 night:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                               : 'text-gray-700 dark:text-gray-200 night:text-gray-100'
                           }
                           hover:bg-gray-50 dark:hover:bg-gray-700 night:hover:bg-gray-800
                           transition-colors duration-150`}
              >
                {themeOption.icon}
                <span>{themeOption.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
