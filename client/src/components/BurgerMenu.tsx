import { Activity, AlertTriangle, Book, CheckCircle, Globe, Menu, X, Wifi, WifiOff } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BurgerMenuProps {
  serverStatus: {
    healthy: boolean;
    abAvailable: boolean;
    error?: string;
    loading: boolean;
  };
  wsState: {
    connected: boolean;
  };
  showDocs: boolean;
  onToggleDocs: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({ serverStatus, wsState, showDocs, onToggleDocs, onToggleTheme, onToggleLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const getConnectionStatus = () => {
    if (!serverStatus.healthy) {
      return {
        icon: <WifiOff className='text-red-500' size={16} />,
        text: t('status.serverUnavailable'),
        color: 'text-red-600',
      };
    }

    if (!wsState.connected) {
      return {
        icon: <WifiOff className='text-yellow-500' size={16} />,
        text: t('status.websocketDisconnected'),
        color: 'text-yellow-600',
      };
    }

    return {
      icon: <Wifi className='text-green-500' size={16} />,
      text: t('status.connected'),
      color: 'text-green-600',
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <>
      {/* Кнопка бургер-меню */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='lg:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 night:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 night:hover:bg-gray-800 transition-colors'
        aria-label={t('navigation.menu')}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Мобильное меню */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div className='fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden' onClick={() => setIsOpen(false)} />

          {/* Меню */}
          <div className='fixed top-16 right-0 left-0 bg-white dark:bg-gray-800 night:bg-gray-900 border-b border-gray-200 dark:border-gray-700 night:border-gray-800 shadow-lg z-50 lg:hidden'>
            <div className='px-4 py-6 space-y-4'>
              {/* Статус Apache Benchmark */}
              <div className='flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 night:bg-gray-800 rounded-lg'>
                {serverStatus.abAvailable ? (
                  <CheckCircle className='text-green-500' size={18} />
                ) : (
                  <AlertTriangle className='text-yellow-500' size={18} />
                )}
                <div className='flex-1'>
                  <div className='text-sm font-medium text-gray-900 dark:text-white night:text-gray-100'>Apache Benchmark</div>
                  <div className='text-xs text-gray-600 dark:text-gray-300 night:text-gray-400'>
                    {serverStatus.abAvailable ? t('status.apacheBenchmarkAvailable') : t('status.apacheBenchmarkUnavailable')}
                  </div>
                </div>
              </div>

              {/* Статус подключения */}
              <div className='flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 night:bg-gray-800 rounded-lg'>
                {connectionStatus.icon}
                <div className='flex-1'>
                  <div className={`text-sm font-medium ${connectionStatus.color}`}>{connectionStatus.text}</div>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className='space-y-2'>
                <button
                  onClick={() => {
                    onToggleDocs();
                    setIsOpen(false);
                  }}
                  className='w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-gray-200 night:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 night:hover:bg-gray-800 rounded-lg transition-colors'
                >
                  <Book size={18} />
                  <span>{showDocs ? t('navigation.interface') : t('navigation.documentation')}</span>
                </button>

                <button
                  onClick={() => {
                    onToggleTheme();
                    setIsOpen(false);
                  }}
                  className='w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-gray-200 night:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 night:hover:bg-gray-800 rounded-lg transition-colors'
                >
                  <Activity size={18} />
                  <span>{t('navigation.theme')}</span>
                </button>

                <button
                  onClick={() => {
                    onToggleLanguage();
                    setIsOpen(false);
                  }}
                  className='w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-gray-200 night:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 night:hover:bg-gray-800 rounded-lg transition-colors'
                >
                  <Globe size={18} />
                  <span>{t('navigation.language')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
