import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { WebSocketMessage, LogEntry, ABTestResult, WebSocketMessageType, TestStatus } from '../types';

// Максимальное количество логов в памяти
const MAX_LOGS_COUNT = 10000;
// Максимальное количество попыток переподключения
const MAX_RECONNECT_ATTEMPTS = 3;

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

interface UseWebSocketReturn {
  state: WebSocketState;
  subscribe: (sessionId: string) => void;
  connect: () => void;
  disconnect: () => void;
  unsubscribe: () => void;
  clearLogs: () => void;
  logs: LogEntry[];
  result: ABTestResult | null;
  testStatus: TestStatus | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const { t } = useTranslation();

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ABTestResult | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const reconnectAttemptsRef = useRef<number>(0);
  const connectionBlockedRef = useRef<boolean>(false); // Флаг постоянной блокировки подключения

  const connect = useCallback(() => {
    // Проверяем, заблокированы ли попытки переподключения навсегда
    if (connectionBlockedRef.current) {
      console.log('Connection permanently blocked until page refresh');

      return;
    }

    // Проверяем, есть ли уже активное соединение
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');

      return;
    }

    // Если соединение устанавливается, ждем
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting, waiting...');

      return;
    }

    // Закрываем существующее соединение перед созданием нового
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection');
      wsRef.current.close(1000, 'Creating new connection');
      wsRef.current = null;
    }

    // Очищаем таймауты переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      // В режиме разработки используем относительный путь, чтобы Vite проксировал
      console.log('Connecting to WebSocket');

      const wsUrl = '/ws';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
        reconnectAttemptsRef.current = 0; // Сбрасываем счетчик при успешном подключении
        connectionBlockedRef.current = false; // Сбрасываем блокировку при успешном подключении
        setState({
          connected: true,
          connecting: false,
          error: null,
        });

        // Если есть активная сессия, переподписываемся
        if (currentSessionRef.current) {
          const message = {
            type: 'subscribe',
            sessionId: currentSessionRef.current,
          };
          wsRef.current?.send(JSON.stringify(message));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case WebSocketMessageType.connected:
              console.log('WebSocket connection confirmation');
              break;

            case WebSocketMessageType.session_state:
              if (message.data) {
                setTestStatus(message.data.status);
                if (message.data.logs) {
                  setLogs(
                    message.data.logs.map((log: any) => ({
                      ...log,
                      timestamp: new Date(log.timestamp),
                    })),
                  );
                }
                if (message.data.result) {
                  setResult(message.data.result);
                }
              }
              break;

            case WebSocketMessageType.test_start:
              setTestStatus(TestStatus.running);
              setResult(null);
              // Очищаем старые логи при запуске нового теста
              setLogs([]);
              break;

            case WebSocketMessageType.test_complete:
              setTestStatus(TestStatus.completed);
              if (message.data?.result) {
                setResult(message.data.result);
                toast.success(t('success.testCompleted'));
              }
              break;

            case WebSocketMessageType.test_stopped:
              setTestStatus(TestStatus.stopped);
              if (message.data?.result) {
                setResult(message.data.result);
                toast.info(t('success.testStopped'));
              }
              // Очищаем currentSessionId при остановке теста, чтобы можно было запустить новый
              currentSessionRef.current = null;
              break;

            case WebSocketMessageType.test_error:
              setTestStatus(TestStatus.error);
              if (message.data?.error) {
                console.error('Test error:', message.data.error);
                toast.error(`${t('errors.testError')}: ${message.data.error}`);
              } else {
                toast.error(t('errors.testError'));
              }
              break;

            case WebSocketMessageType.log:
              if (message.data) {
                const logEntry: LogEntry = {
                  ...message.data,
                  timestamp: new Date(message.data.timestamp),
                };
                setLogs((prev) => {
                  const newLogs = [...prev, logEntry];
                  // Ограничиваем количество логов, оставляя только последние MAX_LOGS_COUNT

                  return newLogs.length > MAX_LOGS_COUNT ? newLogs.slice(-MAX_LOGS_COUNT) : newLogs;
                });
              }
              break;

            default:
              console.log('Unknown WebSocket message:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log({
          message: 'WebSocket connection closed:',
          code: event.code,
          reason: event.reason,
          timeStamp: event.timeStamp,
          wasClean: event.wasClean,
        });
        setState({
          connected: false,
          connecting: false,
          error: event.code !== 1000 ? 'Connection closed' : null,
        });

        // Очищаем существующий таймаут переподключения
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }

        // Переподключение только при неожиданном закрытии и если пользователь не отключился явно и соединение не заблокировано
        const shouldReconnect =
          event.code !== 1000 &&
          !event.wasClean &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
          currentSessionRef.current !== null &&
          !connectionBlockedRef.current;

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000); // Экспоненциальная задержка, макс 10 сек
          console.log(`WebSocket reconnection attempt... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Executing WebSocket reconnection...');
            connect();
          }, delay);
        } else {
          // Если исчерпали все попытки переподключения, блокируем до обновления страницы
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            connectionBlockedRef.current = true;
            console.log(
              `WebSocket connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Connection permanently blocked until page refresh.`,
            );

            // Принудительно закрываем WebSocket соединение
            if (wsRef.current) {
              console.log('Forcefully closing WebSocket after failed reconnection attempts');
              wsRef.current.close(1000, 'Max reconnection attempts reached');
              wsRef.current = null;
            }

            // Показываем пользователю, что соединение заблокировано навсегда
            setState((prev) => ({
              ...prev,
              connected: false,
              connecting: false,
              error: 'Server is unavailable. Refresh the page to try again',
            }));
          }

          console.log('WebSocket disconnected finally, clearing currentSessionId');
          currentSessionRef.current = null;
          reconnectAttemptsRef.current = 0;

          setState((prev) => ({
            ...prev,
            connecting: false,
            error: 'Connection closed',
          }));

          // Очищаем логи и результат при окончательном отключении
          setLogs([]);
          setResult(null);
          setTestStatus(null);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        const errorMessage = t('errors.connectionError');
        setState((prev) => ({
          ...prev,
          connecting: false,
          error: errorMessage,
        }));
        toast.error(errorMessage);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setState({
        connected: false,
        connecting: false,
        error: 'Error creating WebSocket connection',
      });
    }
  }, [t]);

  const subscribe = useCallback(
    (sessionId: string) => {
      console.log('subscribe called with sessionId:', sessionId);

      // Проверяем, не заблокировано ли соединение
      if (connectionBlockedRef.current) {
        console.log('Cannot subscribe: connection permanently blocked');

        return;
      }

      currentSessionRef.current = sessionId;

      // Очищаем предыдущие данные
      setLogs([]);
      setResult(null);
      setTestStatus(null);

      reconnectAttemptsRef.current = 0;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message = {
          type: 'subscribe',
          sessionId,
        };
        wsRef.current.send(JSON.stringify(message));
        console.log(`✅ Subscribed to session: ${sessionId}`);
      } else {
        console.log(`❌ WebSocket not ready. State: ${wsRef.current?.readyState}, OPEN=${WebSocket.OPEN}`);

        // Проверяем, не заблокировано ли соединение, перед попыткой подключения
        if (connectionBlockedRef.current) {
          console.log('Cannot establish connection: permanently blocked');

          return;
        }

        // Если нет соединения, устанавливаем его
        if (wsRef.current?.readyState !== WebSocket.CONNECTING) {
          console.log('WebSocket not connected, establishing connection...');
          connect();
        } else {
          console.log('WebSocket already connecting, subscription will be performed after connection');
        }
      }
    },
    [connect],
  );

  const unsubscribe = useCallback(() => {
    // Отправляем сообщение серверу об отписке, если соединение активно
    if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionRef.current) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'disconnect',
            sessionId: currentSessionRef.current,
            reason: 'unsubscribe',
          }),
        );
        console.log('Sent unsubscribe message to session:', currentSessionRef.current);
      } catch (error) {
        console.warn('Error sending unsubscribe message:', error);
      }
    }

    currentSessionRef.current = null;
    setLogs([]);
    setResult(null);
    setTestStatus(null);

    // Сбрасываем счетчик попыток переподключения при отписке
    reconnectAttemptsRef.current = 0;
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const disconnect = useCallback(() => {
    console.log('Disconnecting from WebSocket...');

    // Очищаем таймаут переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Закрываем WebSocket соединение
    if (wsRef.current) {
      wsRef.current.close(1000, 'User requested disconnection');
      wsRef.current = null;
    }

    // Сбрасываем счетчик попыток переподключения и блокировку
    reconnectAttemptsRef.current = 0;
    connectionBlockedRef.current = false;

    // Очищаем текущую сессию и данные
    currentSessionRef.current = null;
    setLogs([]);
    setResult(null);
    setTestStatus(null);

    setState({
      connected: false,
      connecting: false,
      error: null,
    });

    console.log('WebSocket disconnected');
  }, []);

  // Очистка при размонтировании и закрытии вкладки
  useEffect(() => {
    // Обработчик закрытия вкладки/страницы
    const handleBeforeUnload = () => {
      console.log('Closing tab - disconnecting WebSocket');

      // Отправляем сообщение об отключении, если соединение активно
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'disconnect',
              sessionId: currentSessionRef.current,
              reason: 'page_close',
            }),
          );
        } catch (error) {
          console.warn('Error sending disconnect message:', error);
        }
      }

      // Очищаем таймауты переподключения
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      // Закрываем соединение
      if (wsRef.current) {
        wsRef.current.close(1000, 'Closing page');
        wsRef.current = null;
      }

      // Очищаем currentSessionId при закрытии страницы
      currentSessionRef.current = null;
    };

    // Обработчик видимости страницы (для случая когда вкладка скрывается)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden - checking WebSocket connection');
      } else {
        console.log('Tab active - checking WebSocket connection');
        // Проверяем состояние соединения при возврате к вкладке
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          console.log('WebSocket not active when returning to tab - waiting for user actions');
        }
      }
    };

    // Добавляем обработчики событий
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Очистка при размонтировании компонента
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Удаляем обработчики событий
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Отключаем WebSocket при размонтировании
      if (wsRef.current) {
        wsRef.current.close(1000, 'Размонтирование компонента');
        wsRef.current = null;
      }

      // Очищаем currentSessionId при размонтировании
      currentSessionRef.current = null;
    };
  }, [connect]);

  return {
    state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearLogs,
    logs,
    result,
    testStatus,
  };
};
