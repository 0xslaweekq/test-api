import { Activity, Clock, Target, TrendingUp, Globe, Database, AlertTriangle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ABTestResult } from '../types';

interface Props {
  result: ABTestResult;
  isLoading?: boolean;
}

export const TestResults: React.FC<Props> = ({ result, isLoading = false }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className='card'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4'>{t('testResults.title')}</h3>
        <div className='animate-pulse space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='bg-gray-200 h-20 rounded-lg'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    const locale = t('common.locale', { defaultValue: 'ru-RU' });

    const formattedNum = num.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (isNaN(Number(formattedNum))) {
      return '0';
    }

    return formattedNum;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getPerformanceColor = (rps: number): string => {
    if (rps >= 1000) {
      return 'text-green-600 dark:text-green-400 night:text-green-300';
    }
    if (rps >= 100) {
      return 'text-yellow-600 dark:text-yellow-400 night:text-yellow-300';
    }

    return 'text-red-600 dark:text-red-400 night:text-red-300';
  };

  return (
    <div className='space-y-6'>
      {/* Основные метрики */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4'>{t('testResults.mainMetrics')}</h3>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {/* Requests per Second */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <TrendingUp className='text-primary-500' size={24} />
            </div>
            <div className={`metric-value ${getPerformanceColor(result.requestsPerSecond)}`}>{formatNumber(result.requestsPerSecond)}</div>
            <div className='metric-label'>{t('testResults.requestsPerSecond')}</div>
          </div>

          {/* Average Response Time */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <Clock className='text-primary-500' size={24} />
            </div>
            <div className='metric-value'>{formatNumber(result.timePerRequest)}</div>
            <div className='metric-label'>{t('testResults.averageResponseTime')}</div>
          </div>

          {/* Success Rate */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <Target className='text-primary-500' size={24} />
            </div>
            <div className='metric-value'>
              {formatNumber((result.completeRequests / (result.completeRequests + result.failedRequests)) * 100)}%
            </div>
            <div className='metric-label'>{t('testResults.successRate')}</div>
          </div>

          {/* Total Time */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <Activity className='text-primary-500' size={24} />
            </div>
            <div className='metric-value'>{formatNumber(result.timeTaken)}</div>
            <div className='metric-label'>{t('testResults.totalTime')}</div>
          </div>

          {/* Concurrent Response Time */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <Clock className='text-primary-500' size={24} />
            </div>
            <div className='metric-value'>{formatNumber(result.timePerRequestConcurrent)}</div>
            <div className='metric-label'>{t('testResults.concurrentResponseTime')}</div>
          </div>

          {/* Transfer Rate */}
          <div className='metric-card'>
            <div className='flex items-center justify-center mb-2'>
              <Database className='text-primary-500' size={24} />
            </div>
            <div className='metric-value'>{formatNumber(result.transferRate)}</div>
            <div className='metric-label'>{t('testResults.transferRate')}</div>
          </div>
        </div>
      </div>

      {/* Детальная информация */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Информация о запросах */}
        <div className='card'>
          <h4 className='text-md font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4 flex items-center'>
            <Activity className='mr-2' size={20} />
            {t('testResults.requestStatistics')}
          </h4>

          <div className='space-y-3'>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.totalRequests')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>
                {result.completeRequests + result.failedRequests}
              </span>
            </div>

            {/* Показываем реальную статистику успешности по статус-кодам если доступна */}
            {result.successfulRequests !== undefined ? (
              <>
                <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                  <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.successfulRequests')}</span>
                  <span className='font-medium text-green-600'>{result.successfulRequests}</span>
                </div>

                {(result.clientErrors ?? 0) > 0 && (
                  <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                    <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.clientErrors')}</span>
                    <span className='font-medium text-yellow-600'>{result.clientErrors}</span>
                  </div>
                )}

                {(result.serverErrors ?? 0) > 0 && (
                  <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                    <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.serverErrors')}</span>
                    <span className='font-medium text-red-600'>{result.serverErrors}</span>
                  </div>
                )}

                {(result.redirects ?? 0) > 0 && (
                  <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                    <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.redirects')}</span>
                    <span className='font-medium text-blue-600'>{result.redirects}</span>
                  </div>
                )}

                <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                  <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.networkErrors')}</span>
                  <span className='font-medium text-red-600'>{result.failedRequests}</span>
                </div>
              </>
            ) : (
              <>
                <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                  <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.completed')}</span>
                  <span className='font-medium text-green-600'>{result.completeRequests}</span>
                </div>

                <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                  <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.failed')}</span>
                  <span className='font-medium text-red-600'>{result.failedRequests}</span>
                </div>
              </>
            )}

            <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.concurrencyLevel')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{result.concurrencyLevel}</span>
            </div>

            <div className='flex justify-between items-center py-2'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.documentLength')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>
                {result.documentLength ? `${result.documentLength} ${t('testResults.bytes')}` : t('testResults.documentLengthUnknown')}
              </span>
            </div>
          </div>
        </div>

        {/* Информация о сервере */}
        <div className='card'>
          <h4 className='text-md font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4 flex items-center'>
            <Globe className='mr-2' size={20} />
            {t('testResults.serverInfo')}
          </h4>

          <div className='space-y-3'>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.host')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{result.serverHostname}</span>
            </div>

            <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.port')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{result.serverPort}</span>
            </div>

            <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.path')}</span>
              <span className='font-medium font-mono text-sm text-gray-900 dark:text-white night:text-gray-100'>{result.documentPath}</span>
            </div>

            {result.serverSoftware && (
              <div className='flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 night:border-gray-700'>
                <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.serverSoftware')}</span>
                <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{result.serverSoftware}</span>
              </div>
            )}

            <div className='flex justify-between items-center py-2'>
              <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.dataTransferred')}</span>
              <span className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{formatBytes(result.totalTransferred)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Оценка производительности */}
      <div className='card'>
        <h4 className='text-md font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4'>
          {t('testResults.performanceAssessment')}
        </h4>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='text-center p-4 rounded-lg bg-gray-100 dark:bg-gray-700 night:bg-gray-800'>
            <div className='text-lg font-semibold mb-2 text-gray-900 dark:text-white night:text-gray-100'>
              {result.requestsPerSecond >= 1000
                ? t('testResults.excellent')
                : result.requestsPerSecond >= 100
                  ? t('testResults.good')
                  : t('testResults.needsOptimization')}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.overallPerformance')}</div>
          </div>

          <div className='text-center p-4 rounded-lg bg-gray-100 dark:bg-gray-700 night:bg-gray-800'>
            <div className='text-lg font-semibold mb-2 text-gray-900 dark:text-white night:text-gray-100'>
              {result.timePerRequest <= 100
                ? t('testResults.fast')
                : result.timePerRequest <= 500
                  ? t('testResults.normal')
                  : t('testResults.slow')}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.responseSpeed')}</div>
          </div>

          <div className='text-center p-4 rounded-lg bg-gray-100 dark:bg-gray-700 night:bg-gray-800'>
            <div className='text-lg font-semibold mb-2 text-gray-900 dark:text-white night:text-gray-100'>
              {result.failedRequests === 0
                ? t('testResults.stable')
                : result.failedRequests < 5
                  ? t('testResults.acceptable')
                  : t('testResults.unstable')}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testResults.reliability')}</div>
          </div>
        </div>

        {/* Рекомендации */}
        <div className='mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 night:bg-blue-900/30 rounded-lg'>
          <h5 className='font-medium text-blue-900 dark:text-blue-200 night:text-blue-100 mb-2'>{t('testResults.recommendations')}</h5>
          <ul className='text-sm text-blue-800 dark:text-blue-200 night:text-blue-100 space-y-1'>
            {result.requestsPerSecond < 100 && <li>{t('testResults.optimizeServerCode')}</li>}
            {result.timePerRequest > 500 && <li>{t('testResults.checkDatabaseAndAPIs')}</li>}
            {result.failedRequests > 0 && <li>{t('testResults.investigateFailedRequests')}</li>}
            {result.requestsPerSecond >= 1000 && <li>{t('testResults.excellentPerformance')}</li>}
          </ul>
        </div>
      </div>

      {/* Анализ ошибок и статус-кодов */}
      {result.errorSummary && result.errorSummary.length > 0 && (
        <div className='card'>
          <h4 className='text-md font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-4 flex items-center'>
            <AlertTriangle className='mr-2 text-red-500' size={20} />
            {t('testResults.errorAnalysis')}
          </h4>

          <div className='space-y-3'>
            {result.errorSummary.map((error, index) => (
              <div key={index} className='flex items-center justify-between p-3 rounded-lg border border-gray-200'>
                <div className='flex items-center space-x-3'>
                  <div
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      parseInt(error.statusCode) >= 500
                        ? 'bg-red-100 text-red-800'
                        : parseInt(error.statusCode) >= 400
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {error.statusCode}
                  </div>
                  <div>
                    <div className='font-medium text-gray-900 dark:text-white night:text-gray-100'>{error.message}</div>
                    <div className='text-sm text-gray-500 dark:text-gray-400 night:text-gray-300'>
                      {((error.count / (result.completeRequests + result.failedRequests)) * 100).toFixed(1)}% {t('testResults.ofTotalRequests')}
                    </div>
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100'>{error.count}</div>
                  <div className='text-sm text-gray-500 dark:text-gray-400 night:text-gray-300'>{t('testResults.requestsCount')}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Сводка по статус-кодам */}
          {result.statusCodes && Object.keys(result.statusCodes).length > 0 && (
            <div className='mt-6'>
              <h5 className='text-sm font-medium text-gray-900 dark:text-white night:text-gray-100 mb-3'>{t('testResults.allStatusCodes')}</h5>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                {Object.entries(result.statusCodes).map(([code, count]) => (
                  <div key={code} className='text-center p-2 border border-gray-200 dark:border-gray-600 night:border-gray-700 rounded'>
                    <div className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100'>{code}</div>
                    <div className='text-sm text-gray-500 dark:text-gray-400 night:text-gray-300'>
                      {count} {t('testResults.requestsCount')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Предупреждение о реальной статистике */}
          <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/20 night:bg-red-900/30 border border-red-200 dark:border-red-700 night:border-red-600 rounded-md'>
            <div className='flex items-start space-x-2'>
              <AlertTriangle className='text-amber-500 mt-0.5' size={16} />
              <div className='text-sm text-red-700 dark:text-red-200 night:text-red-100'>
                <strong>{t('testResults.importantNote')}</strong> {t('testResults.importantNoteText')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
