import { Activity, AlertTriangle, Book, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { BurgerMenu } from './components/BurgerMenu';
import { Docs } from './components/Docs';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LoadingScreen } from './components/LoadingScreen';
import { LogViewer } from './components/LogViewer';
import { TestConfigForm } from './components/TestConfigForm';
import { TestControls } from './components/TestControls';
import { TestResults } from './components/TestResults';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { useWebSocket } from './hooks/useWebSocket';
import { ABTestConfig, TestStatus } from './types';
import { api } from './utils/api';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ABTestConfig | null>(null);
  const currentTheme = useTheme();
  const [isConfigValid, setIsConfigValid] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    healthy: boolean;
    abAvailable: boolean;
    error?: string;
    loading: boolean;
  }>({ healthy: false, abAvailable: false, loading: true });

  const [showDocs, setShowDocs] = useState(false);

  const { state: wsState, subscribe, unsubscribe, clearLogs, logs, result, testStatus, connect } = useWebSocket();

  // Проверка состояния сервера при загрузке
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        // Проверяем доступность сервера
        await api.health();

        // Проверяем доступность Apache Benchmark
        const abStatus = await api.checkABStatus();

        setServerStatus({
          healthy: true,
          abAvailable: abStatus.available,
          loading: false,
        });

        // Автоматически подключаемся к WebSocket после успешной проверки сервера
        setTimeout(() => {
          connect();
        }, 100); // Небольшая задержка для стабильности
      } catch (error) {
        console.error(t('errors.serverUnavailable'), error);
        setServerStatus({
          healthy: false,
          abAvailable: false,
          loading: false,
          error: error instanceof Error ? error.message : t('errors.unknownError'),
        });
      }
    };

    checkServerStatus();
  }, [connect, t]);

  // Запуск теста
  const handleStartTest = async () => {
    try {
      let sessionId = currentSessionId;

      // Если тест завершен, остановлен или есть ошибка, сбрасываем сессию и создаем новую
      if (testStatus === TestStatus.completed || testStatus === TestStatus.stopped || testStatus === TestStatus.error || !sessionId) {
        if (sessionId) {
          // Удаляем старую сессию
          try {
            await api.deleteSession(sessionId);
          } catch (e) {
            // Игнорируем ошибки удаления
          }
        }

        // Отписывание от старой сессии перед созданием новой
        handleResetTest();

        // Создаем новую сессию
        if (config && isConfigValid) {
          const response = await api.createSession(config);
          sessionId = response.sessionId;
          setCurrentSessionId(sessionId);
          if (sessionId) {
            subscribe(sessionId);
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
          console.log('App: Session created successfully, sessionId:', sessionId);
        } else {
          throw new Error(t('errors.configInvalid'));
        }
      }

      // Запускаем тест
      if (sessionId) {
        await api.startTest(sessionId);
        console.log('App: Test started successfully');
      } else {
        throw new Error(t('errors.createSession'));
      }
    } catch (error) {
      console.error(t('errors.startTest'), error);
      // При ошибке запуска отписываемся от сессии и очищаем ресурсы
      unsubscribe();
      setCurrentSessionId(null);
      toast.error(`${error instanceof Error ? error.message : t('errors.unknownError')}`);
    }
  };

  // Остановка теста
  const handleStopTest = async () => {
    console.log('App: handleStopTest called, currentSessionId:', currentSessionId, 'testStatus:', testStatus);
    if (!currentSessionId) {
      console.log('App: No currentSessionId, stopping is not possible');

      return;
    }

    if (testStatus !== TestStatus.running) {
      console.log('App: Test not running, current status:', testStatus);

      return;
    }

    try {
      console.log('App: Stopping test for session:', currentSessionId);
      await api.stopTest(currentSessionId);
      console.log('App: Test stopped successfully, waiting for WebSocket notification');
      // НЕ очищаем сессию сразу - ждем test_stopped от сервера
    } catch (error) {
      console.error(t('errors.stopTest'), error);
      // При ошибке остановки очистка ресурсов
      unsubscribe();
      setCurrentSessionId(null);
      toast.error(`${t('errors.stopTest')}: ${error instanceof Error ? error.message : t('errors.unknownError')}`);
    }
  };

  // Сброс теста
  const handleResetTest = () => {
    unsubscribe();
    clearLogs();
    setCurrentSessionId(null);
  };

  // Сброс сессии при изменении конфигурации (если тест не запущен)
  const handleConfigChange = useCallback((newConfig: ABTestConfig) => {
    setConfig(newConfig);
    // Убираем автоматический сброс сессии - пусть пользователь сам решает когда сбрасывать
  }, []);

  // Удаление сессии
  const handleDeleteSession = async () => {
    if (!currentSessionId) {
      toast.info(t('errors.noActiveSession'));

      return;
    }

    try {
      await api.deleteSession(currentSessionId);
    } catch (error) {
      console.error(t('errors.deleteSession'), error);
      // При ошибке удаления также очищаем ресурсы
      toast.error(`${error instanceof Error ? error.message : t('errors.unknownError')}`);
    } finally {
      // Очищаем ресурсы независимо от результата
      unsubscribe();
      setCurrentSessionId(null);
      toast.success(t('success.deleteSession'));
    }
  };

  // Статус подключения
  const getConnectionStatus = () => {
    if (!serverStatus.healthy) {
      return {
        icon: <WifiOff className='text-error-500' size={20} />,
        text: t('status.serverUnavailable'),
        color: 'text-error-600',
      };
    }

    if (!wsState.connected) {
      return {
        icon: <WifiOff className='text-warning-500' size={20} />,
        text: t('status.websocketDisconnected'),
        color: 'text-warning-600',
      };
    }

    return {
      icon: <Wifi className='text-success-500' size={20} />,
      text: t('status.connected'),
      color: 'text-success-600',
    };
  };

  const connectionStatus = getConnectionStatus();

  // Экран загрузки пока проверяется сервер
  if (serverStatus.loading) {
    return <LoadingScreen />;
  }

  return (
    <div className='min-h-screen bg-gray-100 dark:bg-gray-900 night:bg-black transition-colors duration-200 flex flex-col'>
      {/* Header */}
      <header className='bg-white dark:bg-gray-800 night:bg-gray-900 shadow-sm border-b border-gray-300 dark:border-gray-700 night:border-gray-800'>
        <div className='max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <div className='flex items-center space-x-3'>
              <Activity className='text-blue-600 dark:text-blue-400' size={28} />
              <div className='hidden sm:block'>
                <h1 className='text-xl font-bold text-gray-900 dark:text-white night:text-gray-100'>{t('app.title')}</h1>
                <p className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('app.subtitle')}</p>
              </div>
              <div className='sm:hidden'>
                <h1 className='text-lg font-bold text-gray-900 dark:text-white night:text-gray-100'>{t('app.titleShort')}</h1>
              </div>
            </div>

            {/* Десктопное меню */}
            <div className='hidden lg:flex items-center space-x-6'>
              {/* Статус Apache Benchmark */}
              <div className='flex items-center space-x-2'>
                {serverStatus.abAvailable ? (
                  <CheckCircle className='text-green-500' size={16} />
                ) : (
                  <AlertTriangle className='text-yellow-500' size={16} />
                )}
                <span className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>
                  {serverStatus.abAvailable ? t('status.apacheBenchmarkAvailable') : t('status.apacheBenchmarkUnavailable')}
                </span>
              </div>

              {/* Статус подключения */}
              <div className='flex items-center space-x-2'>
                {connectionStatus.icon}
                <span className={`text-sm ${connectionStatus.color}`}>{connectionStatus.text}</span>
              </div>

              {/* Кнопка документации */}
              <button
                className='inline-flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200 night:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400'
                onClick={() => setShowDocs((v) => !v)}
                title={t('navigation.documentation')}
              >
                <Book size={18} />
                <span>{showDocs ? t('navigation.interface') : t('navigation.documentation')}</span>
              </button>

              {/* Переключатель языка */}
              <LanguageSwitcher />

              {/* Переключатель темы */}
              <ThemeToggle />
            </div>

            {/* Мобильное меню */}
            <div className='lg:hidden flex items-center space-x-4'>
              {/* Статус индикаторы для всех мобильных устройств */}
              <div className='flex items-center space-x-2 sm:space-x-3'>
                {serverStatus.abAvailable ? (
                  <CheckCircle className='text-green-500' size={14} />
                ) : (
                  <AlertTriangle className='text-yellow-500' size={14} />
                )}
                <div className='scale-75 sm:scale-100'>{connectionStatus.icon}</div>
              </div>

              {/* Бургер-меню */}
              <BurgerMenu
                serverStatus={serverStatus}
                wsState={wsState}
                showDocs={showDocs}
                onToggleDocs={() => setShowDocs((v) => !v)}
                onToggleTheme={() => {
                  // Переключение темы будет обработано в ThemeToggle
                  const event = new CustomEvent('toggle-theme');
                  window.dispatchEvent(event);
                }}
                onToggleLanguage={() => {
                  // Переключение языка будет обработано в LanguageSwitcher
                  const event = new CustomEvent('toggle-language');
                  window.dispatchEvent(event);
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {showDocs ? (
          <div className='card p-6'>
            <Docs />
          </div>
        ) : (
          <>
            {/* Предупреждения */}
            {!serverStatus.healthy && (
              <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 night:bg-red-900/30 border border-red-200 dark:border-red-800 night:border-red-700 rounded-lg'>
                <div className='flex items-start space-x-3'>
                  <AlertTriangle className='text-red-500 dark:text-red-400 mt-0.5' size={20} />
                  <div>
                    <h3 className='text-red-900 dark:text-red-200 night:text-red-100 font-medium'>{t('alerts.serverUnavailable.title')}</h3>
                    <p className='text-red-700 dark:text-red-300 night:text-red-200 text-sm mt-1'>
                      {serverStatus.error || t('alerts.serverUnavailable.message')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {serverStatus.healthy && !serverStatus.abAvailable && (
              <div className='mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 night:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 night:border-yellow-700 rounded-lg'>
                <div className='flex items-start space-x-3'>
                  <AlertTriangle className='text-yellow-500 dark:text-yellow-400 mt-0.5' size={20} />
                  <div>
                    <h3 className='text-yellow-900 dark:text-yellow-200 night:text-yellow-100 font-medium'>
                      {t('alerts.apacheBenchmarkUnavailable.title')}
                    </h3>
                    <p className='text-yellow-700 dark:text-yellow-300 night:text-yellow-200 text-sm mt-1'>
                      {t('alerts.apacheBenchmarkUnavailable.message')}
                      <code className='bg-yellow-100 dark:bg-yellow-800 night:bg-yellow-700 px-1 ml-1 rounded'>
                        {t('alerts.apacheBenchmarkUnavailable.installCommand')}
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Основной интерфейс */}
            <div className='grid grid-cols-1 xl:grid-cols-5 gap-6 lg:gap-8'>
              {/* Левая колонка - Конфигурация и управление */}
              <div className='xl:col-span-2 space-y-4 lg:space-y-6'>
                <TestConfigForm
                  onConfigChange={handleConfigChange}
                  onValidationChange={setIsConfigValid}
                  disabled={testStatus === TestStatus.running || !serverStatus.healthy || !serverStatus.abAvailable}
                />

                {config && (
                  <TestControls
                    status={testStatus as any}
                    config={config}
                    isConfigValid={isConfigValid}
                    onStart={handleStartTest}
                    onStop={handleStopTest}
                    onReset={handleResetTest}
                    onDelete={handleDeleteSession}
                    disabled={!serverStatus.healthy || !serverStatus.abAvailable}
                  />
                )}
              </div>

              {/* Правая колонка - Результаты и логи */}
              <div className='xl:col-span-3 space-y-4 lg:space-y-6'>
                {/* Логи */}
                <LogViewer logs={logs} isConnected={wsState.connected} maxHeight='400px' verbosity={config?.verbosity || 2} />

                {/* Результаты */}
                {result && <TestResults result={result} isLoading={testStatus === TestStatus.running} />}

                {/* Состояние ожидания */}
                {!result && testStatus !== TestStatus.running && currentSessionId && (
                  <div className='card text-center py-8 lg:py-12'>
                    <Activity className='mx-auto text-gray-400 dark:text-gray-500 mb-4' size={48} />
                    <h3 className='text-lg font-medium text-gray-900 dark:text-white night:text-gray-100 mb-2'>{t('testResults.ready')}</h3>
                    <p className='text-gray-600 dark:text-gray-300 night:text-gray-400 text-sm lg:text-base'>
                      {t('testResults.readyDescription')}
                    </p>
                  </div>
                )}

                {!currentSessionId && !testStatus && (
                  <div className='card text-center py-8 lg:py-12'>
                    <Activity className='mx-auto text-gray-400 dark:text-gray-500 mb-4' size={48} />
                    <h3 className='text-lg font-medium text-gray-900 dark:text-white night:text-gray-100 mb-2'>{t('testResults.welcome')}</h3>
                    <p className='text-gray-600 dark:text-gray-300 night:text-gray-400 text-sm lg:text-base'>
                      {t('testResults.welcomeDescription')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className='bg-white dark:bg-gray-800 night:bg-gray-900 border-t border-gray-300 dark:border-gray-700 night:border-gray-800 mt-12'>
        <div className='max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <div className='text-center text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>
            <p>{t('app.version')}</p>
            <p className='mt-1'>{t('app.copyright')}</p>
          </div>
        </div>
      </footer>

      {/* Toast контейнер для уведомлений */}
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={currentTheme === 'light' ? 'light' : 'dark'}
      />
    </div>
  );
};

export default App;
