import { TFunction } from 'i18next';
import { AlertCircle, CheckCircle, Settings } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { useConfirm } from '../hooks/useConfirm';
import { ABTestConfig, ValidationResult } from '../types';
import { api } from '../utils/api';

interface Props {
  onConfigChange: (config: ABTestConfig) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

const defaultConfig: ABTestConfig = {
  url: `http://localhost:5173/api/health`,
  requests: 1000,
  concurrency: 10,
  method: 'GET',
  keepalive: true,
  timeout: 3,
  verbosity: 2,
  acceptVaryingLength: false,
};

// Ключи для localStorage
const STORAGE_KEYS = {
  CONFIG: 'test-api-config',
  HEADERS: 'test-api-headers',
  COOKIES: 'test-api-cookies',
  SHOW_ADVANCED: 'test-api-show-advanced',
};

// Функции для работы с localStorage
const saveToStorage = (key: string, data: any, t: TFunction) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(t('errors.saveToStorage'), error);
  }
};

const loadFromStorage = (key: string, defaultValue: any, t: TFunction): any => {
  try {
    const stored = localStorage.getItem(key);

    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(t('errors.loadFromStorage'), error);

    return defaultValue;
  }
};

export const TestConfigForm: React.FC<Props> = ({ onConfigChange, onValidationChange, disabled = false }) => {
  const { t } = useTranslation();
  const { confirm, ConfirmComponent } = useConfirm();
  // Загружаем данные из localStorage при инициализации
  const [config, setConfig] = useState<ABTestConfig>(() => loadFromStorage(STORAGE_KEYS.CONFIG, defaultConfig, t));
  const [validation, setValidation] = useState<ValidationResult>({
    valid: true,
    errors: [],
  });
  const [showAdvanced, setShowAdvanced] = useState(() => loadFromStorage(STORAGE_KEYS.SHOW_ADVANCED, false, t));
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(() => loadFromStorage(STORAGE_KEYS.HEADERS, [], t));
  const [cookies, setCookies] = useState<{ key: string; value: string }[]>(() => loadFromStorage(STORAGE_KEYS.COOKIES, [], t));

  // Валидация конфигурации
  const validateConfig = useCallback(
    async (newConfig: ABTestConfig) => {
      try {
        const result = await api.validateConfig(newConfig);
        setValidation(result);
        onValidationChange(result.valid);
      } catch (error) {
        const errorResult = {
          valid: false,
          errors: [t('testConfig.validationError')],
        };
        setValidation(errorResult);
        onValidationChange(false);
      }
    },
    [t, onValidationChange],
  );

  // Инициализация при первой загрузке
  useEffect(() => {
    // Если в конфигурации уже есть заголовки/cookies из localStorage,
    // но массивы headers/cookies пусты, загружаем их
    if (config.headers && headers.length === 0) {
      const headerPairs = Object.entries(config.headers || {}).map(([key, value]) => ({ key, value }));
      setHeaders(headerPairs);
    }

    if (config.cookies && cookies.length === 0) {
      const cookiePairs = Object.entries(config.cookies || {}).map(([key, value]) => ({ key, value }));
      setCookies(cookiePairs);
    }

    // Валидируем конфигурацию при первой загрузке
    validateConfig(config);
    onConfigChange(config);
  }, [config, cookies.length, headers.length, validateConfig, onConfigChange]);

  // Функция очистки кэша
  const clearCache = async () => {
    const confirmed = await confirm({
      title: t('testConfig.clearCacheTitle'),
      message: t('testConfig.clearCacheConfirm'),
      confirmText: t('common.clear'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      localStorage.removeItem(STORAGE_KEYS.CONFIG);
      localStorage.removeItem(STORAGE_KEYS.HEADERS);
      localStorage.removeItem(STORAGE_KEYS.COOKIES);
      localStorage.removeItem(STORAGE_KEYS.SHOW_ADVANCED);

      setConfig(defaultConfig);
      setHeaders([]);
      setCookies([]);
      setShowAdvanced(false);

      onConfigChange(defaultConfig);
      validateConfig(defaultConfig);

      toast.success(t('success.cacheCleared'));
    }
  };

  // Обновление конфигурации
  const updateConfig = (updates: Partial<ABTestConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveToStorage(STORAGE_KEYS.CONFIG, newConfig, t); // Сохраняем в localStorage
    onConfigChange(newConfig);
    validateConfig(newConfig);
  };

  // Обработка изменения заголовков
  const updateHeaders = (newHeaders: { key: string; value: string }[]) => {
    setHeaders(newHeaders);
    saveToStorage(STORAGE_KEYS.HEADERS, newHeaders, t); // Сохраняем в localStorage
    const headersObj = newHeaders.reduce(
      (acc, h) => {
        if (h.key.trim() && h.value.trim()) {
          acc[h.key.trim()] = h.value.trim();
        }

        return acc;
      },
      {} as Record<string, string>,
    );

    updateConfig({
      headers: Object.keys(headersObj).length > 0 ? headersObj : {},
    });
  };

  // Обработка изменения cookies
  const updateCookies = (newCookies: { key: string; value: string }[]) => {
    setCookies(newCookies);
    saveToStorage(STORAGE_KEYS.COOKIES, newCookies, t); // Сохраняем в localStorage
    const cookiesObj = newCookies.reduce(
      (acc, c) => {
        if (c.key.trim() && c.value.trim()) {
          acc[c.key.trim()] = c.value.trim();
        }

        return acc;
      },
      {} as Record<string, string>,
    );

    updateConfig({
      cookies: Object.keys(cookiesObj).length > 0 ? cookiesObj : {},
    });
  };

  // Добавление новой пары ключ-значение
  const addHeaderPair = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const addCookiePair = () => {
    setCookies([...cookies, { key: '', value: '' }]);
  };

  // Удаление пары ключ-значение
  const removeHeaderPair = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    updateHeaders(newHeaders);
  };

  const removeCookiePair = (index: number) => {
    const newCookies = cookies.filter((_, i) => i !== index);
    updateCookies(newCookies);
  };

  const handleShowAdvancedToggle = () => {
    const newValue = !showAdvanced;
    setShowAdvanced(newValue);
    saveToStorage(STORAGE_KEYS.SHOW_ADVANCED, newValue, t); // Сохраняем в localStorage
  };

  // Инициализируем поля при первой загрузке
  useEffect(() => {
    onConfigChange(config);
    validateConfig(config);
  }, [config, onConfigChange, validateConfig]);

  return (
    <div className='card'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4'>
        <h2 className='text-lg lg:text-xl font-semibold text-gray-900 dark:text-white night:text-gray-100'>{t('testConfig.title')}</h2>
        <button
          type='button'
          onClick={clearCache}
          className='text-sm text-gray-500 dark:text-gray-400 night:text-gray-300 hover:text-red-600 dark:hover:text-red-400 night:hover:text-red-300 px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 night:hover:bg-red-900/30 transition-colors self-start sm:self-auto'
          title={t('testConfig.clearCache')}
          disabled={disabled}
        >
          🗑️ {t('testConfig.clearCache')}
        </button>
      </div>

      {/* Основные настройки */}
      <div className='space-y-4'>
        {/* URL */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>{t('testConfig.url')} *</label>
          <input
            type='url'
            value={config.url}
            onChange={(e) => updateConfig({ url: e.target.value })}
            className='input'
            placeholder='https://example.com/api/endpoint'
            disabled={disabled}
          />
        </div>

        {/* Количество запросов и Concurrency в одной строке */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
              {t('testConfig.requests')} *
            </label>
            <input
              type='number'
              min='1'
              value={config.requests}
              onChange={(e) => updateConfig({ requests: parseInt(e.target.value) || 1 })}
              className='input'
              disabled={disabled}
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
              {t('testConfig.concurrency')} *
            </label>
            <input
              type='number'
              min='1'
              value={config.concurrency}
              onChange={(e) => updateConfig({ concurrency: parseInt(e.target.value) || 1 })}
              className='input'
              disabled={disabled}
            />
          </div>
        </div>

        {/* HTTP метод */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>{t('testConfig.method')}</label>
          <select
            value={config.method}
            onChange={(e) => {
              const value = e.target.value;
              if (value && ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(value)) {
                const newMethod = value as ABTestConfig['method'];
                updateConfig({
                  method: newMethod,
                  // Очищаем данные при смене метода
                  dataBody: newMethod === 'GET' || newMethod === 'POST' || newMethod === 'PUT' ? config.dataBody || '' : '',
                });
              }
            }}
            className='input'
            disabled={disabled}
          >
            <option value='GET'>GET</option>
            <option value='POST'>POST</option>
            <option value='PUT'>PUT</option>
            <option value='DELETE'>DELETE</option>
            <option value='HEAD'>HEAD</option>
          </select>
        </div>

        {/* Данные для GET */}
        {(config.method === 'GET' || config.method === 'POST' || config.method === 'PUT') && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
              {config.method} {t('testConfig.dataBody')}
            </label>
            <textarea
              value={config.dataBody || ''}
              onChange={(e) => updateConfig({ dataBody: e.target.value })}
              className='input'
              rows={4}
              placeholder={t('testConfig.dataBodyPlaceholder')}
              disabled={disabled}
            />
          </div>
        )}

        {/* Content-Type для GET/POST/PUT */}
        {(config.method === 'GET' || config.method === 'POST' || config.method === 'PUT') && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
              {t('testConfig.contentType')}
            </label>
            <input
              type='text'
              value={config.contentType || 'application/json'}
              onChange={(e) => updateConfig({ contentType: e.target.value })}
              className='input'
              placeholder='application/json'
              disabled={disabled}
            />
          </div>
        )}

        {/* Основные настройки */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='flex items-center'>
            <input
              type='checkbox'
              id='keepalive'
              checked={config.keepalive || false}
              onChange={(e) => updateConfig({ keepalive: e.target.checked })}
              className='mr-2'
              disabled={disabled}
            />
            <label htmlFor='keepalive' className='text-sm text-gray-700 dark:text-gray-200 night:text-gray-100'>
              HTTP Keep-Alive
            </label>
          </div>
          <div className='flex items-center'>
            <input
              type='checkbox'
              id='varying-length'
              checked={config.acceptVaryingLength || false}
              onChange={(e) => updateConfig({ acceptVaryingLength: e.target.checked })}
              className='mr-2'
              disabled={disabled}
            />
            <label htmlFor='varying-length' className='text-sm text-gray-700 dark:text-gray-200 night:text-gray-100'>
              {t('testConfig.acceptVaryingLength')}
            </label>
          </div>
        </div>
      </div>

      {/* Дополнительные настройки */}
      <div className='mt-6'>
        <button
          type='button'
          onClick={handleShowAdvancedToggle}
          className='flex items-center space-x-2 text-blue-600 dark:text-blue-400 night:text-blue-300 hover:text-blue-700 dark:hover:text-blue-300 night:hover:text-blue-200 transition-colors'
          disabled={disabled}
        >
          <Settings size={16} />
          <span>{t('testConfig.advancedSettings')}</span>
          <span className='text-sm'>{showAdvanced ? '▼' : '▶'}</span>
        </button>

        {showAdvanced && (
          <div className='mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-700 night:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 night:border-gray-700'>
            {/* Тайм-ауты */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                  {t('testConfig.timeLimit')}
                </label>
                <input
                  type='number'
                  min='1'
                  value={config.timelimit || ''}
                  onChange={(e) =>
                    updateConfig({
                      timelimit: parseInt(e.target.value) || 0,
                    })
                  }
                  className='input'
                  placeholder={t('testConfig.timeLimitPlaceholder')}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                  {t('testConfig.timeout')}
                </label>
                <input
                  type='number'
                  min='1'
                  value={config.timeout || ''}
                  onChange={(e) =>
                    updateConfig({
                      timeout: parseInt(e.target.value) || 0,
                    })
                  }
                  className='input'
                  placeholder='30'
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Verbosity */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                {t('testConfig.verbosity')}
              </label>
              <select
                value={config.verbosity || 2}
                onChange={(e) => updateConfig({ verbosity: parseInt(e.target.value) })}
                className='input'
                disabled={disabled}
              >
                <option value={1}>{t('testConfig.verbosityMinimal')}</option>
                <option value={2}>{t('testConfig.verbosityNormal')}</option>
                <option value={3}>{t('testConfig.verbosityDetailed')}</option>
              </select>
            </div>

            {/* Аутентификация */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                  {t('testConfig.authUsername')}
                </label>
                <input
                  type='text'
                  value={config.authUsername || ''}
                  onChange={(e) => updateConfig({ authUsername: e.target.value })}
                  className='input'
                  placeholder={t('testConfig.authUsernamePlaceholder')}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                  {t('testConfig.authPassword')}
                </label>
                <input
                  type='password'
                  value={config.authPassword || ''}
                  onChange={(e) => updateConfig({ authPassword: e.target.value })}
                  className='input'
                  placeholder={t('testConfig.authPasswordPlaceholder')}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Proxy */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100 mb-1'>
                {t('testConfig.proxyUrl')}
              </label>
              <input
                type='text'
                value={config.proxyUrl || ''}
                onChange={(e) => updateConfig({ proxyUrl: e.target.value })}
                className='input'
                placeholder='http://proxy:port'
                disabled={disabled}
              />
            </div>

            {/* Headers */}
            <div>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100'>
                  {t('testConfig.headers')}
                </label>
                <button type='button' onClick={addHeaderPair} className='text-blue-600 hover:text-blue-700 text-sm' disabled={disabled}>
                  + {t('testConfig.addHeader')}
                </button>
              </div>
              <div className='space-y-2'>
                {headers.map((header, index) => (
                  <div key={index} className='flex space-x-2'>
                    <input
                      type='text'
                      placeholder={t('testConfig.headerName')}
                      value={header.key}
                      onChange={(e) => {
                        const newHeaders = [...headers];
                        newHeaders[index] = { ...header, key: e.target.value };
                        updateHeaders(newHeaders);
                      }}
                      className='input flex-1'
                      disabled={disabled}
                    />
                    <input
                      type='text'
                      placeholder={t('testConfig.headerValue')}
                      value={header.value}
                      onChange={(e) => {
                        const newHeaders = [...headers];
                        newHeaders[index] = {
                          ...header,
                          value: e.target.value,
                        };
                        updateHeaders(newHeaders);
                      }}
                      className='input flex-1'
                      disabled={disabled}
                    />
                    <button
                      type='button'
                      onClick={() => removeHeaderPair(index)}
                      className='text-red-600 hover:text-red-700 px-2'
                      disabled={disabled}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cookies */}
            <div>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-100'>Cookies</label>
                <button type='button' onClick={addCookiePair} className='text-blue-600 hover:text-blue-700 text-sm' disabled={disabled}>
                  + {t('testConfig.addCookie')}
                </button>
              </div>
              <div className='space-y-2'>
                {cookies.map((cookie, index) => (
                  <div key={index} className='flex space-x-2'>
                    <input
                      type='text'
                      placeholder={t('testConfig.cookieName')}
                      value={cookie.key}
                      onChange={(e) => {
                        const newCookies = [...cookies];
                        newCookies[index] = { ...cookie, key: e.target.value };
                        updateCookies(newCookies);
                      }}
                      className='input flex-1'
                      disabled={disabled}
                    />
                    <input
                      type='text'
                      placeholder={t('testConfig.cookieValue')}
                      value={cookie.value}
                      onChange={(e) => {
                        const newCookies = [...cookies];
                        newCookies[index] = {
                          ...cookie,
                          value: e.target.value,
                        };
                        updateCookies(newCookies);
                      }}
                      className='input flex-1'
                      disabled={disabled}
                    />
                    <button
                      type='button'
                      onClick={() => removeCookiePair(index)}
                      className='text-red-600 hover:text-red-700 px-2'
                      disabled={disabled}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Статус валидации */}
      {!validation.valid && (
        <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/20 night:bg-red-900/30 border border-red-200 dark:border-red-700 night:border-red-600 rounded-lg'>
          <div className='flex items-start space-x-2'>
            <AlertCircle className='text-red-500 dark:text-red-400 mt-0.5' size={16} />
            <div>
              <p className='text-sm font-medium text-red-900 dark:text-red-200 night:text-red-100'>{t('testConfig.configErrors')}</p>
              <ul className='text-sm text-red-700 dark:text-red-300 night:text-red-200 mt-1 list-disc list-inside'>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validation.valid && (
        <div className='mt-4 p-3 bg-green-50 dark:bg-green-900/20 night:bg-green-900/30 border border-green-200 dark:border-green-700 night:border-green-600 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <CheckCircle className='text-green-500 dark:text-green-400' size={16} />
            <p className='text-sm text-green-900 dark:text-green-200 night:text-green-100'>{t('testConfig.configValid')}</p>
          </div>
        </div>
      )}

      {/* Диалог подтверждения */}
      {ConfirmComponent}
    </div>
  );
};
