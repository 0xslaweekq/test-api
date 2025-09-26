import { Terminal, AlertCircle, Info, Bug } from 'lucide-react';
import React, { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  isConnected: boolean;
  maxHeight?: string;
  verbosity?: number;
}

export const LogViewer: React.FC<Props> = ({ logs, isConnected, maxHeight = '400px', verbosity = 2 }) => {
  const { t } = useTranslation();
  // Фильтрация логов — при включении скрываем только отладочные сообщения
  const filteredLogs = useMemo(() => {
    const filtered = logs.filter((log) => log.level !== 'debug');

    if (verbosity === 1) {
      return filtered.filter((log) => log.level !== 'error').filter((log) => !log.message.includes('Finished'));
    }

    if (verbosity === 2) {
      return filtered;
    }

    return logs;
  }, [logs, verbosity]);

  // Подсчёт реальных ошибок
  const errorCount = useMemo(() => {
    return logs.filter((log) => log.level === 'error').length;
  }, [logs]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Автоскролл к новым логам
  useEffect(() => {
    if (shouldAutoScroll.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Проверка, нужно ли автоскроллить
  const handleScroll = () => {
    if (!logContainerRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    shouldAutoScroll.current = isAtBottom;
  };

  // Форматирование времени
  const formatTime = (timestamp: Date): string => {
    const locale = t('common.locale', { defaultValue: 'ru-RU' });
    const timezone = t('common.timezone', { defaultValue: 'Europe/Moscow' });

    // Получаем время с миллисекундами
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString(locale, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timezone,
    });

    // Добавляем миллисекунды вручную
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0').slice(0, 3);

    return `${timeString}.${milliseconds}`;
  };

  // Иконка для уровня лога
  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle size={14} className='text-red-500 dark:text-red-400' />;
      case 'info':
        return <Info size={14} className='text-blue-500 dark:text-blue-400' />;
      case 'debug':
        return <Bug size={14} className='text-gray-500 dark:text-gray-400' />;
      default:
        return null;
    }
  };

  return (
    <div className='card'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center space-x-2'>
          <Terminal size={20} className='text-gray-600 dark:text-gray-300 night:text-gray-400' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100'>{t('logs.title')}</h3>
        </div>

        <div className='flex items-center space-x-2'>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>
            {isConnected ? t('logs.connected') : t('logs.disconnected')}
          </span>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className='bg-gray-100 dark:bg-gray-900 night:bg-black text-gray-600 dark:text-gray-100 night:text-gray-100 rounded-lg p-4 font-mono text-sm custom-scrollbar overflow-y-auto border border-gray-300 dark:border-gray-700 night:border-gray-800'
        style={{ maxHeight }}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className='text-gray-500 dark:text-gray-400 night:text-gray-500 text-center py-8'>
            <Terminal size={32} className='mx-auto mb-2 opacity-50' />
            <p>{t('logs.noLogs')}</p>
          </div>
        ) : (
          <div className='space-y-1'>
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className='flex items-start space-x-2 hover:bg-gray-200 dark:hover:bg-gray-800 night:hover:bg-gray-900 px-2 py-1 rounded transition-colors duration-150'
              >
                <span className='text-gray-500 dark:text-gray-400 night:text-gray-500 text-xs mt-0.5 font-mono shrink-0'>
                  {formatTime(log.timestamp)}
                </span>

                <div className='shrink-0 mt-0.5'>{getLogIcon(log.level)}</div>

                <span
                  className={`text-xs uppercase font-bold shrink-0 mt-0.5 ${
                    log.level === 'error'
                      ? 'text-red-400 dark:text-red-300 night:text-red-200'
                      : log.level === 'info'
                        ? 'text-blue-400 dark:text-blue-300 night:text-blue-200'
                        : 'text-gray-400 dark:text-gray-300 night:text-gray-400'
                  }`}
                >
                  {log.level}
                </span>

                <span className='text-gray-700 dark:text-gray-200 night:text-gray-100 break-words min-w-0 flex-1'>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredLogs.length > 0 && (
        <div className='mt-2 text-xs text-gray-500 dark:text-gray-400 night:text-gray-500 text-right space-x-4'>
          <span>{t('logs.errorsCount', { count: errorCount, total: logs.length })}</span>

          <br />

          <span>{t('logs.totalRecords', { count: filteredLogs.length })}</span>
        </div>
      )}
    </div>
  );
};
