import { createServer } from 'http';
import path from 'path';

import cors from 'cors';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import { ApacheBenchmarkRunner } from './apache-benchmark';
import { ABTestConfig, LogLevel, TestSession, TestStatus, WebSocketMessage, WebSocketMessageType } from './types';

// Максимальное количество логов в сессии
const MAX_LOGS_PER_SESSION = 500;
// Максимальное время жизни сессии (в миллисекундах)
const SESSION_LIFETIME = 24 * 60 * 60 * 1000; // 24 часа

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// TODO Обслуживание статических файлов React приложения
app.use(express.static(path.join(__dirname, '../../client/build')));

const wss = new WebSocket.Server({
  server,
});

// Хранилище активных сессий
const sessions = new Map<string, TestSession>();
const websocketClients = new Map<string, WebSocket>();

// Apache Benchmark runner
const abRunner = new ApacheBenchmarkRunner();

/**
 * Очистка старых сессий
 */
function cleanupOldSessions() {
  const now = Date.now();
  const sessionsToDelete: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    const sessionAge = now - session.startTime.getTime();

    // Удаление сессий старше SESSION_LIFETIME или завершенные сессии старше 1 часа
    const isOld = sessionAge > SESSION_LIFETIME;
    const isStaleCompleted = (session.status === TestStatus.completed || session.status === TestStatus.error) && sessionAge > 60 * 60 * 1000; // 1 час

    if (isOld || isStaleCompleted) {
      sessionsToDelete.push(sessionId);
    }
  }

  // Удаление старых сессий
  for (const sessionId of sessionsToDelete) {
    sessions.delete(sessionId);
    websocketClients.delete(sessionId);
    console.log(`Deleted old session: ${sessionId}`);
  }

  if (sessionsToDelete.length > 0) {
    console.log(`Cleaned up ${sessionsToDelete.length} old sessions`);
  }
}

/**
 * Отправка сообщения через WebSocket
 */
function broadcastToSession(sessionId: string, message: WebSocketMessage) {
  const client = websocketClients.get(sessionId);

  if (client && client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ WebSocket: Error sending message for session ${sessionId}:`, error);
    }
  } else {
    console.warn(`⚠️ WebSocket: Client not found or not connected for session ${sessionId}, message: ${JSON.stringify(message)}`);
  }
}

/**
 * Добавление лога в сессию
 */
function addLogToSession(sessionId: string, level: LogLevel, message: string) {
  const session = sessions.get(sessionId);
  if (session) {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
    };

    session.logs.push(logEntry);

    // Ограничение количества логов в сессии
    if (session.logs.length > MAX_LOGS_PER_SESSION) {
      session.logs = session.logs.slice(-MAX_LOGS_PER_SESSION);
    }

    // Отправка лога через WebSocket
    broadcastToSession(sessionId, {
      type: WebSocketMessageType.log,
      sessionId,
      data: logEntry,
    });
  }
}

// WebSocket обработка
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'subscribe' && message.sessionId) {
        // Удаление предыдущей подписки, если она была
        const existingClient = websocketClients.get(message.sessionId);
        if (existingClient && existingClient !== ws) {
          websocketClients.delete(message.sessionId);
        }

        websocketClients.set(message.sessionId, ws);
        console.log(`WebSocket client subscribed to session: ${message.sessionId}`);

        // Отправка текущего состояния сессии, если она существует
        const session = sessions.get(message.sessionId);
        if (session) {
          ws.send(
            JSON.stringify({
              type: 'session_state',
              sessionId: message.sessionId,
              data: {
                status: session.status,
                logs: session.logs,
                result: session.result,
              },
            }),
          );
        }
      } else if (message.type === 'disconnect') {
        // Обработка сообщения об отключении от клиента
        console.log(`WebSocket client disconnected: ${message.sessionId || 'unknown session'}, reason: ${message.reason || 'unknown'}`);

        // Удаление клиента из подписок
        for (const [sessionId, client] of websocketClients.entries()) {
          if (client === ws) {
            websocketClients.delete(sessionId);
            console.log(`WebSocket client unsubscribed from session: ${sessionId}`);
            break;
          }
        }

        // Закрытие соединения
        ws.close(1000, 'Client disconnected');
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    // Удаляем клиента из всех подписок
    for (const [sessionId, client] of websocketClients.entries()) {
      if (client === ws) {
        websocketClients.delete(sessionId);
        console.log(`WebSocket client unsubscribed from session: ${sessionId}`);
      }
    }
  });

  // Отправляем приветственное сообщение
  ws.send(
    JSON.stringify({
      type: 'connected',
      data: { message: 'WebSocket connection established' },
    }),
  );
});

// API Routes

/**
 * Проверка состояния сервера
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.1.4',
  });
});

/**
 * Проверка доступности Apache Benchmark
 */
app.get('/api/status', async (_req, res) => {
  try {
    const isAvailable = await ApacheBenchmarkRunner.checkAvailability();
    res.json({
      available: isAvailable,
      message: isAvailable ? 'Apache Benchmark available' : 'Apache Benchmark not found. Make sure the utility is installed.',
    });
  } catch (error) {
    res.status(500).json({
      available: false,
      error: 'Error checking Apache Benchmark',
    });
  }
});

/**
 * Создание новой тестовой сессии
 */
app.post('/api/sessions', (req, res) => {
  try {
    const config: ABTestConfig = req.body;
    const sessionId = uuidv4();

    const session: TestSession = {
      id: sessionId,
      config,
      status: TestStatus.preparing,
      startTime: new Date(),
      logs: [],
    };

    sessions.set(sessionId, session);

    res.json({
      sessionId,
      message: 'Session created successfully',
    });
  } catch (error) {
    res.status(400).json({
      error: 'Error creating session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Получение информации о сессии
 */
app.get('/api/sessions/:sessionId', (_req, res) => {
  const sessionId = _req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json(session);
});

/**
 * Получение списка всех сессий
 */
app.get('/api/sessions', (_req, res) => {
  const sessionList = Array.from(sessions.values()).map((session) => ({
    id: session.id,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    config: {
      url: session.config.url,
      requests: session.config.requests,
      concurrency: session.config.concurrency,
    },
  }));

  return res.json(sessionList);
});

/**
 * Запуск теста
 */
app.post('/api/sessions/:sessionId/start', (_req, res) => {
  const sessionId = _req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.status !== TestStatus.preparing) {
    return res.status(400).json({ error: 'Session already running or completed' });
  }

  // Запуск теста асинхронно
  try {
    session.status = TestStatus.running;
    session.startTime = new Date();

    broadcastToSession(sessionId, {
      type: WebSocketMessageType.test_start,
      sessionId,
      data: { config: session.config },
    });

    addLogToSession(sessionId, LogLevel.info, 'Starting load testing...');

    // Отправка ответа клиенту сразу после запуска
    res.json({ message: 'Test started' });

    // Запуск Apache Benchmark асинхронно (не жду завершения)
    abRunner
      .runTest(session.config, sessionId, (level, message) => addLogToSession(sessionId, level, message))
      .then((result) => {
        // Проверка, не был ли тест остановлен пользователем
        if (result === null) {
          // Тест был остановлен пользователем
          return;
        }

        // Тест завершен успешно
        session.status = TestStatus.completed;
        session.endTime = new Date();
        session.result = result;

        addLogToSession(sessionId, LogLevel.info, 'Test completed successfully!');

        broadcastToSession(sessionId, {
          type: WebSocketMessageType.test_complete,
          sessionId,
          data: { result },
        });
      });

    return; // HTTP ответ уже отправлен выше
  } catch (error) {
    // Ошибка при запуске теста
    session.status = TestStatus.error;
    session.endTime = new Date();

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addLogToSession(sessionId, LogLevel.error, `Error executing test: ${errorMessage}`);

    broadcastToSession(sessionId, {
      type: WebSocketMessageType.test_error,
      sessionId,
      data: { error: errorMessage },
    });

    return res.status(500).json({ error: errorMessage });
  }
});

/**
 * Остановка теста (пока не реализовано)
 */
app.post('/api/sessions/:sessionId/stop', (_req, res) => {
  const sessionId = _req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Проверка, можно ли остановить тест
  if (session.status === TestStatus.completed || session.status === TestStatus.stopped) {
    // Тест уже завершен или остановлен - возвращение успеха
    return res.json({ message: 'Test already completed or stopped', status: session.status });
  }

  if (session.status !== TestStatus.running && session.status !== TestStatus.preparing) {
    return res.status(400).json({ error: 'Test not running' });
  }

  // Остановка процесса Apache Benchmark
  const stopped = abRunner.stopTest(sessionId);

  if (stopped) {
    session.status = TestStatus.stopped;
    session.endTime = new Date();
    session.result = {
      serverHostname: '',
      serverPort: 0,
      documentPath: '',
      concurrencyLevel: 0,
      timeTaken: 0,
      completeRequests: 0,
      failedRequests: 0,
      totalTransferred: 0,
      htmlTransferred: 0,
      requestsPerSecond: 0,
      timePerRequest: 0,
      timePerRequestConcurrent: 0,
      transferRate: 0,
    };

    addLogToSession(sessionId, LogLevel.info, '✅ Test stopped by user');
    broadcastToSession(sessionId, {
      type: WebSocketMessageType.test_stopped,
      sessionId,
      data: { result: session.result, message: 'Test stopped by user' },
    });

    return res.json({ message: 'Test stopped' });
  } else {
    // Если процесс не найден, но сессия в статусе running,
    // это означает, что процесс уже завершился
    if (session.status === TestStatus.running) {
      session.status = TestStatus.stopped;
      session.endTime = new Date();

      addLogToSession(sessionId, LogLevel.info, '⚠️ Process already finished');
      broadcastToSession(sessionId, {
        type: WebSocketMessageType.test_stopped,
        sessionId,
        data: { result: session.result, message: 'Process already finished' },
      });

      return res.json({ message: 'Process already finished' });
    }

    return res.status(400).json({ error: 'Failed to stop test' });
  }
});

/**
 * Удаление сессии
 */
app.delete('/api/sessions/:sessionId', (_req, res) => {
  const sessionId = _req.params.sessionId;

  if (!sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  sessions.delete(sessionId);
  websocketClients.delete(sessionId);

  return res.json({ message: 'Session deleted' });
});

/**
 * Получение логов сессии
 */
app.get('/api/sessions/:sessionId/logs', (_req, res) => {
  const sessionId = _req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({ logs: session.logs });
});

/**
 * Валидация конфигурации теста
 */
app.post('/api/validate-config', (_req, res) => {
  try {
    const config: ABTestConfig = _req.body;
    const errors: string[] = [];

    // Базовая валидация
    if (!config.url) {
      errors.push('URL is required');
    }
    if (!config.requests || config.requests <= 0) {
      errors.push('Requests must be greater than 0');
    }
    if (!config.concurrency || config.concurrency <= 0) {
      errors.push('Concurrency must be greater than 0');
    }
    if (config.concurrency > config.requests) {
      errors.push('Concurrency must be less than or equal to requests');
    }

    try {
      new URL(config.url);
    } catch {
      errors.push('Invalid URL');
    }

    res.json({
      valid: errors.length === 0,
      errors,
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      errors: ['Validation configuration error'],
    });
  }
});

// API Routes должны быть определены после WebSocket сервера

// Обслуживание React приложения для всех остальных маршрутов
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build/index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 5173;

server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📊 API server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);

  // Проверка доступности Apache Benchmark при запуске
  ApacheBenchmarkRunner.checkAvailability().then((available) => {
    if (available) {
      console.log('✅ Apache Benchmark available');
    } else {
      console.log('❌ Apache Benchmark not found! Install the utility for the service.');
    }
  });

  // Запуск периодической очистки старых сессий каждые 30 минут
  setInterval(cleanupOldSessions, 30 * 60 * 1000);
  console.log('🧹 Automatic session cleanup configured (every 30 minutes)');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

export { app, server };
