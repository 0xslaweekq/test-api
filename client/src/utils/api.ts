import i18n from '../i18n';
import { ABTestConfig, TestSession, ValidationResult, SessionListItem } from '../types';

const API_BASE = '/api';

// Функция для получения переводов ошибок
const getErrorMessage = (key: string, fallback: string): string => {
  return i18n.t(key, fallback);
};

export const api = {
  // Проверка состояния сервера
  health: async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) {
        throw new Error(getErrorMessage('errors.serverUnavailable', 'Server unavailable'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error checking server health:', error);
      throw error;
    }
  },

  // Проверка доступности Apache Benchmark
  checkABStatus: async () => {
    try {
      const response = await fetch(`${API_BASE}/status`);
      if (!response.ok) {
        throw new Error(getErrorMessage('errors.checkABStatus', 'Error checking Apache Benchmark'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error checking Apache Benchmark availability:', error);
      throw error;
    }
  },

  // Валидация конфигурации
  validateConfig: async (config: ABTestConfig): Promise<ValidationResult> => {
    try {
      const response = await fetch(`${API_BASE}/validate-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(getErrorMessage('errors.validation', 'Validation error'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error validating configuration:', error);
      throw error;
    }
  },

  // Создание новой сессии
  createSession: async (config: ABTestConfig) => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(getErrorMessage('errors.createSession', 'Error creating session'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error creating session:', error);
      throw error;
    }
  },

  // Получение информации о сессии
  getSession: async (sessionId: string): Promise<TestSession> => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(getErrorMessage('errors.sessionNotFound', 'Session not found'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error getting session information:', error);
      throw error;
    }
  },

  // Получение списка сессий
  getSessions: async (): Promise<SessionListItem[]> => {
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      if (!response.ok) {
        throw new Error(getErrorMessage('errors.getSessions', 'Error getting sessions list'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error getting sessions list:', error);
      throw error;
    }
  },

  // Запуск теста
  startTest: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(getErrorMessage('errors.startTest', 'Error starting test'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error starting test:', error);
      throw error;
    }
  },

  // Остановка теста
  stopTest: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(getErrorMessage('errors.stopTest', `Error stopping test: ${response.status} ${response.statusText}`));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error stopping test:', error);
      throw error;
    }
  },

  // Удаление сессии
  deleteSession: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(getErrorMessage('errors.deleteSession', 'Error deleting session'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error deleting session:', error);
      throw error;
    }
  },

  // Получение логов сессии
  getSessionLogs: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/logs`);
      if (!response.ok) {
        throw new Error(getErrorMessage('errors.getLogs', 'Error getting logs'));
      }

      return response.json();
    } catch (error) {
      console.error('API: Error getting logs session:', error);
      throw error;
    }
  },
};
