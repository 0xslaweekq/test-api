import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4' onClick={handleBackdropClick}>
      {/* Диалог без фона */}
      <div className='bg-white dark:bg-gray-800 night:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 night:border-gray-600 p-6 max-w-sm w-full'>
        {/* Заголовок */}
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white night:text-gray-100 mb-3'>{title}</h3>

        {/* Сообщение */}
        <p className='text-sm text-gray-600 dark:text-gray-300 night:text-gray-400 mb-6'>{message}</p>

        {/* Кнопки */}
        <div className='flex gap-3 justify-end'>
          <button
            onClick={onConfirm}
            className='px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 night:bg-red-700 night:hover:bg-red-800 rounded-lg transition-colors'
          >
            {confirmText || t('common.delete')}
          </button>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 night:text-gray-300 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 night:bg-gray-700 night:hover:bg-gray-600 rounded-lg transition-colors'
          >
            {cancelText || t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
