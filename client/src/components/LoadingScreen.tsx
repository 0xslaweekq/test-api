import { Activity } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className='min-h-screen bg-gray-100 dark:bg-gray-900 night:bg-black flex items-center justify-center transition-colors duration-200'>
      <div className='text-center'>
        <div className='relative'>
          <Activity className='mx-auto text-blue-600 dark:text-blue-400 mb-4 animate-pulse' size={64} />
          <div className='absolute inset-0 animate-spin'>
            <div className='h-16 w-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full'></div>
          </div>
        </div>
        <h2 className='text-xl font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-2'>{t('app.title')}</h2>
        <p className='text-gray-600 dark:text-gray-300 night:text-gray-400'>{t('loading.connectingToServer')}</p>
        <div className='mt-4 flex justify-center'>
          <div className='flex space-x-1'>
            <div className='w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce'></div>
            <div className='w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce' style={{ animationDelay: '0.1s' }}></div>
            <div className='w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce' style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
