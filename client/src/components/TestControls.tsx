import { Play, Square, RotateCcw, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '../hooks/useConfirm';
import { ABTestConfig, TestStatus } from '../types';

interface Props {
  status: TestStatus | null;
  config: ABTestConfig;
  isConfigValid: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onReset: () => void;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}

export const TestControls: React.FC<Props> = ({ status, config, isConfigValid, onStart, onStop, onReset, onDelete, disabled = false }) => {
  const { t } = useTranslation();
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm, ConfirmComponent } = useConfirm();

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStart();
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    console.log('TestControls: handleStop called, status:', status);
    setIsStopping(true);
    try {
      console.log('TestControls: calling onStop...');
      await onStop();
      console.log('TestControls: onStop completed successfully');
    } catch (error) {
      console.error(t('errors.stopTest'), error);
    } finally {
      setIsStopping(false);
      setIsStarting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t('testControls.deleteTitle'),
      message: t('testControls.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case TestStatus.preparing:
        return {
          text: t('status.preparing'),
          color: 'text-gray-600 dark:text-gray-300 night:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-700 night:bg-gray-800',
          icon: '⏳',
        };
      case TestStatus.running:
        return {
          text: t('status.running'),
          color: 'text-yellow-700 dark:text-yellow-200 night:text-yellow-100',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 night:bg-yellow-900/50',
          icon: '🚀',
        };
      case TestStatus.completed:
        return {
          text: t('status.completed'),
          color: 'text-green-700 dark:text-green-200 night:text-green-100',
          bgColor: 'bg-green-100 dark:bg-green-900/30 night:bg-green-900/50',
          icon: '✅',
        };
      case TestStatus.stopped:
        return {
          text: t('status.stopped'),
          color: 'text-blue-700 dark:text-blue-200 night:text-blue-100',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30 night:bg-blue-900/50',
          icon: '⏹️',
        };
      case TestStatus.error:
        return {
          text: t('status.error'),
          color: 'text-red-700 dark:text-red-200 night:text-red-100',
          bgColor: 'bg-red-100 dark:bg-red-900/30 night:bg-red-900/50',
          icon: '❌',
        };
      default:
        return {
          text: t('status.notInitialized'),
          color: 'text-gray-500 dark:text-gray-400 night:text-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-700 night:bg-gray-800',
          icon: '⚪',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const canStart =
    (status === TestStatus.preparing ||
      status === TestStatus.completed ||
      status === TestStatus.stopped ||
      status === TestStatus.error ||
      status === null) &&
    isConfigValid &&
    !disabled;
  const canStop = (status === TestStatus.running || status === TestStatus.preparing) && !disabled;
  const canReset = (status === TestStatus.completed || status === TestStatus.stopped || status === TestStatus.error) && !disabled;
  const canDelete = status !== TestStatus.running && !disabled;

  return (
    <div className='card'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100'>{t('testControls.title')}</h3>

        <div
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color} self-start sm:self-auto`}
        >
          <span className='mr-2'>{statusInfo.icon}</span>
          {statusInfo.text}
        </div>
      </div>

      {/* Краткая информация о тесте */}
      <div className='bg-gray-50 dark:bg-gray-700 night:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-600 night:border-gray-700'>
        <h4 className='font-medium text-gray-900 dark:text-white night:text-gray-100 mb-2'>{t('testControls.testParameters')}</h4>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>URL:</span>
            <div className='font-mono text-xs mt-1 break-all text-gray-900 dark:text-white night:text-gray-100 leading-relaxed py-1'>
              {config.url}
            </div>
          </div>
          <div>
            <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testConfig.method')}:</span>
            <div className='font-medium mt-1 text-gray-900 dark:text-white night:text-gray-100'>{config.method || 'GET'}</div>
          </div>
          <div>
            <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testConfig.requests')}:</span>
            <div className='font-medium mt-1 text-gray-900 dark:text-white night:text-gray-100'>{config.requests.toLocaleString()}</div>
          </div>
          <div>
            <span className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('testConfig.concurrency')}:</span>
            <div className='font-medium mt-1 text-gray-900 dark:text-white night:text-gray-100'>{config.concurrency}</div>
          </div>
        </div>
      </div>

      {/* Кнопки управления */}
      <div className='space-y-3'>
        {/* Основные действия */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className={`btn ${canStart ? 'btn-primary' : 'btn-outline'} flex items-center justify-center space-x-2`}
            title={
              status === TestStatus.completed || status === TestStatus.stopped || status === TestStatus.error
                ? t('testControls.startTooltip')
                : t('testControls.startTooltipNew')
            }
          >
            <Play size={16} />
            <span className='hidden sm:inline'>{isStarting ? t('testControls.starting') : t('testControls.startTest')}</span>
            <span className='sm:hidden'>{isStarting ? t('testControls.starting') : t('testControls.startTestShort')}</span>
          </button>

          <button
            onClick={handleStop}
            disabled={!canStop || isStopping}
            className={`btn ${canStop ? 'btn-warning' : 'btn-outline'} flex items-center justify-center space-x-2`}
          >
            <Square size={16} />
            <span className='hidden sm:inline'>{isStopping ? t('testControls.stopping') : t('testControls.stopTest')}</span>
            <span className='sm:hidden'>{isStopping ? t('testControls.stopping') : t('testControls.stopTestShort')}</span>
          </button>
        </div>

        {/* Дополнительные действия */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <button
            onClick={onReset}
            disabled={!canReset}
            className={`btn ${canReset ? 'btn-secondary' : 'btn-outline'} flex items-center justify-center space-x-2`}
          >
            <RotateCcw size={16} />
            <span>{t('testControls.reset')}</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className={`btn ${canDelete ? 'btn-error' : 'btn-outline'} flex items-center justify-center space-x-2`}
          >
            <Trash2 size={16} />
            <span className='hidden sm:inline'>{isDeleting ? t('testControls.deleting') : t('testControls.delete')}</span>
            <span className='sm:hidden'>{isDeleting ? t('testControls.deleting') : t('testControls.delete')}</span>
          </button>
        </div>
      </div>

      {/* Предупреждения */}
      {!isConfigValid && (
        <div className='mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 night:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 night:border-yellow-600 rounded-md'>
          <p className='text-sm text-yellow-700 dark:text-yellow-200 night:text-yellow-100'>⚠️ {t('testControls.configInvalid')}</p>
        </div>
      )}

      {status === TestStatus.running && (
        <div className='mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 night:bg-blue-900/30 border border-blue-200 dark:border-blue-700 night:border-blue-600 rounded-md'>
          <p className='text-sm text-blue-700 dark:text-blue-200 night:text-blue-100'>🚀 {t('testControls.testRunning')}</p>
        </div>
      )}

      {status === TestStatus.error && (
        <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/20 night:bg-red-900/30 border border-red-200 dark:border-red-700 night:border-red-600 rounded-md'>
          <p className='text-sm text-red-700 dark:text-red-200 night:text-red-100'>❌ {t('testControls.testError')}</p>
        </div>
      )}

      {status === TestStatus.completed && (
        <div className='mt-4 p-3 bg-green-50 dark:bg-green-900/20 night:bg-green-900/30 border border-green-200 dark:border-green-700 night:border-green-600 rounded-lg'>
          <p className='text-sm text-green-900 dark:text-green-200 night:text-green-100'>✅ {t('testControls.testCompleted')}</p>
        </div>
      )}

      {status === TestStatus.stopped && (
        <div className='mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 night:bg-blue-900/30 border border-blue-200 dark:border-blue-700 night:border-blue-600 rounded-lg'>
          <p className='text-sm text-blue-900 dark:text-blue-200 night:text-blue-100'>⏹️ {t('testControls.testStopped')}</p>
        </div>
      )}

      {/* Диалог подтверждения */}
      {ConfirmComponent}
    </div>
  );
};
