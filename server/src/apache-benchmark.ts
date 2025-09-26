import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import { ABTestConfig, ABTestResult, LogLevel } from './types';

export class ApacheBenchmarkRunner {
  private tempDir = path.join(process.cwd(), 'temp');
  private activeProcesses = new Map<string, any>();
  private stoppedByUser = new Set<string>();

  constructor() {
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Валидация конфигурации перед запуском теста
   */
  private validateConfig(config: ABTestConfig): string[] {
    const errors: string[] = [];

    if (!config.url) {
      errors.push('URL is required');
    }

    if (config.requests <= 0) {
      errors.push('Requests must be greater than 0');
    }

    if (config.concurrency <= 0) {
      errors.push('Level concurrency must be greater than 0');
    }

    if (config.concurrency > config.requests) {
      errors.push('Level concurrency must be less than or equal to requests');
    }

    if (config.method === 'POST' && !config.dataBody) {
      errors.push('POST method requires data in dataBody');
    }

    if (config.method === 'PUT' && !config.dataBody) {
      errors.push('PUT method requires data in dataBody');
    }

    try {
      new URL(config.url);
    } catch {
      errors.push('Invalid URL');
    }

    return errors;
  }

  /**
   * Создание файлов для POST/PUT данных
   */
  private async createDataFile(data: string, sessionId: string): Promise<string> {
    const fileName = path.join(this.tempDir, `${sessionId}-data.txt`);
    await fs.writeFile(fileName, data, 'utf-8');

    return fileName;
  }

  /**
   * Построение команды Apache Benchmark
   */
  private async buildCommand(config: ABTestConfig, sessionId: string): Promise<string[]> {
    const args = ['ab'];

    // Основные параметры
    args.push('-n', config.requests.toString());
    args.push('-c', config.concurrency.toString());

    // Таймлимит
    if (config.timelimit) {
      args.push('-t', config.timelimit.toString());
    }

    // Keep-Alive
    if (config.keepalive) {
      args.push('-k');
    }

    // HTTP метод
    if (config.method && config.method !== 'GET') {
      args.push('-m', config.method);
    }

    // Таймаут
    if (config.timeout) {
      args.push('-s', config.timeout.toString());
    }

    // Verbosity
    // Используем максимально запрошенную пользователем подробность; по умолчанию 3
    const verbosity = Math.max(config.verbosity ?? 3, 3);
    args.push('-v', verbosity.toString());

    // Accept varying length (для динамических страниц)
    if (config.acceptVaryingLength) {
      args.push('-l');
    }

    // Заголовки
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        args.push('-H', `${key}: ${value}`);
      }
    }

    // Cookies
    if (config.cookies) {
      for (const [key, value] of Object.entries(config.cookies)) {
        args.push('-C', `${key}=${value}`);
      }
    }

    // Аутентификация
    if (config.authUsername && config.authPassword) {
      args.push('-A', `${config.authUsername}:${config.authPassword}`);
    }

    // Прокси
    if (config.proxyUrl) {
      args.push('-X', config.proxyUrl);
    }

    // POST данные
    if ((config.method === 'POST' || config.method === 'GET') && config.dataBody) {
      const dataFile = await this.createDataFile(config.dataBody, sessionId);
      args.push('-p', dataFile);

      if (config.contentType) {
        args.push('-T', config.contentType);
      }
    }

    // PUT данные
    if (config.method === 'PUT' && config.dataBody) {
      const dataFile = await this.createDataFile(config.dataBody, sessionId);
      args.push('-u', dataFile);

      if (config.contentType) {
        args.push('-T', config.contentType);
      }
    }

    // URL (последний параметр)
    args.push(config.url);

    return args;
  }

  /**
   * Парсинг результатов Apache Benchmark
   */
  private parseResults(output: string): Partial<ABTestResult> {
    const result: Partial<ABTestResult> = {};
    const statusCodes: Record<string, number> = {};

    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Парсинг HTTP статус-кодов из лог сообщений
      if (trimmed.includes('HTTP/1.') && /HTTP\/1\.[01] (\d{3})/.test(trimmed)) {
        const statusMatch = trimmed.match(/HTTP\/1\.[01] (\d{3})/);
        if (statusMatch) {
          const statusCode = statusMatch[1];
          statusCodes[statusCode] = (statusCodes[statusCode] || 0) + 1;
        }
      }

      if (trimmed.includes('Server Software:')) {
        result.serverSoftware = trimmed.split('Server Software:')[1]?.trim();
      }

      if (trimmed.includes('Server Hostname:')) {
        result.serverHostname = trimmed.split('Server Hostname:')[1]?.trim() || '';
      }

      if (trimmed.includes('Server Port:')) {
        result.serverPort = parseInt(trimmed.split('Server Port:')[1]?.trim() || '0');
      }

      if (trimmed.includes('Document Path:')) {
        result.documentPath = trimmed.split('Document Path:')[1]?.trim() || '';
      }

      if (trimmed.includes('Document Length:')) {
        const length = trimmed.split('Document Length:')[1]?.trim().split(' ')[0];
        result.documentLength = length ? parseInt(length, 10) : 0;
      }

      if (trimmed.includes('Concurrency Level:')) {
        result.concurrencyLevel = parseInt(trimmed.split('Concurrency Level:')[1]?.trim() || '0');
      }

      if (trimmed.includes('Time taken for tests:')) {
        const time = trimmed.split('Time taken for tests:')[1]?.trim().split(' ')[0];
        result.timeTaken = time ? parseFloat(time) : 0;
      }

      if (trimmed.includes('Complete requests:')) {
        result.completeRequests = parseInt(trimmed.split('Complete requests:')[1]?.trim() || '0');
      }

      if (trimmed.includes('Failed requests:')) {
        result.failedRequests = parseInt(trimmed.split('Failed requests:')[1]?.trim() || '0');
      }

      if (trimmed.includes('Total transferred:')) {
        const transferred = trimmed.split('Total transferred:')[1]?.trim().split(' ')[0];
        result.totalTransferred = transferred ? parseInt(transferred) : 0;
      }

      if (trimmed.includes('HTML transferred:')) {
        const transferred = trimmed.split('HTML transferred:')[1]?.trim().split(' ')[0];
        result.htmlTransferred = transferred ? parseInt(transferred) : 0;
      }

      if (trimmed.includes('Requests per second:')) {
        const rps = trimmed.split('Requests per second:')[1]?.trim().split(' ')[0];
        result.requestsPerSecond = rps ? parseFloat(rps) : 0;
      }

      if (trimmed.includes('Time per request:') && !trimmed.includes('across all concurrent')) {
        const tpr = trimmed.split('Time per request:')[1]?.trim().split(' ')[0];
        result.timePerRequest = tpr ? parseFloat(tpr) : 0;
      }

      if (trimmed.includes('Time per request:') && trimmed.includes('across all concurrent')) {
        const tpr = trimmed.split('Time per request:')[1]?.trim().split(' ')[0];
        result.timePerRequestConcurrent = tpr ? parseFloat(tpr) : 0;
      }

      if (trimmed.includes('Transfer rate:')) {
        const rate = trimmed.split('Transfer rate:')[1]?.trim().split(' ')[0];
        result.transferRate = rate ? parseFloat(rate) : 0;
      }
    }

    // Анализ статус-кодов
    if (Object.keys(statusCodes).length > 0) {
      result.statusCodes = statusCodes;

      // Подсчет категорий ответов
      let successfulRequests = 0;
      let clientErrors = 0;
      let serverErrors = 0;
      let redirects = 0;

      const errorSummary: {
        statusCode: string;
        count: number;
        message: string;
      }[] = [];

      for (const [code, count] of Object.entries(statusCodes)) {
        const statusNum = parseInt(code);

        if (statusNum >= 200 && statusNum < 300) {
          successfulRequests += count;
        } else if (statusNum >= 300 && statusNum < 400) {
          redirects += count;
          errorSummary.push({
            statusCode: code,
            count,
            message: this.getStatusMessage(statusNum),
          });
        } else if (statusNum >= 400 && statusNum < 500) {
          clientErrors += count;
          errorSummary.push({
            statusCode: code,
            count,
            message: this.getStatusMessage(statusNum),
          });
        } else if (statusNum >= 500) {
          serverErrors += count;
          errorSummary.push({
            statusCode: code,
            count,
            message: this.getStatusMessage(statusNum),
          });
        }
      }

      result.successfulRequests = successfulRequests;
      result.clientErrors = clientErrors;
      result.serverErrors = serverErrors;
      result.redirects = redirects;
      result.errorSummary = errorSummary;
    }

    return result;
  }

  private getStatusMessage(statusCode: number): string {
    // TODO: add more status codes
    const statusMessages: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return statusMessages[statusCode] || `HTTP ${statusCode}`;
  }

  private isIgnorableDebugMessage(message: string): boolean {
    const ignorablePatterns = [
      'SSL/TLS Handshake',
      'SSL/TLS State',
      'SSL/TLS',
      'SSLv3/TLS write',
      'SSLv3/TLS read',
      'TLSv1.3 read',
      'TLSv1.2 read',
      'TLSv1.1 read',
      'read server certificate',
      'read encrypted extensions',
      'read server certificate verify',
      'read finished',
      'write client hello',
      'before SSL initialization',
      'before SSL/TLS connection',
      'after SSL/TLS connection',
      'SSL-Session:',
      'Session-ID:',
      'Session-ID-ctx:',
      'Protocol :',
      'Transport Protocol :',
      'Max Early Data:',
      'Extended master secret:',
      'Verify return code:',
      'Timeout :',
      'Start Time:',
      'Cipher :',
      'Cipher Suite',
      'Cipher Bits:',
      'Resumption PSK:',
      'PSK identity:',
      'PSK identity hint:',
      'SRP username:',
      'Key-Arg   :',
      'TLS session ticket',
      'Compression:',
      'Expansion:',
      'SSL',
    ];

    return ignorablePatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Запуск теста Apache Benchmark
   */
  async runTest(config: ABTestConfig, sessionId: string, onLog: (level: LogLevel, message: string) => void): Promise<ABTestResult | null> {
    // Валидация
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
    }

    onLog(LogLevel.info, 'Preparing to run Apache Benchmark...');

    try {
      // Построение команды
      const args = await this.buildCommand(config, sessionId);
      const verbosity = config.verbosity ?? 2;
      onLog(LogLevel.info, `Command: ${args.join(' ')}`);

      // Запуск процесса
      return new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';

        const abProcess = spawn(args[0], args.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Добавляем логирование при запуске процесса
        onLog(LogLevel.info, `🚀 Apache Benchmark started (PID: ${abProcess.pid})`);

        // Добавляем периодическое логирование прогресса
        const progressInterval = setInterval(() => {
          if (!this.stoppedByUser.has(sessionId) && abProcess.exitCode === null) {
            onLog(LogLevel.info, '⏳ Test is running...');
          }
        }, 1000); // Каждые 1 секунду

        // Сохраняем процесс для возможности остановки
        this.activeProcesses.set(sessionId, abProcess);

        // Счетчики для агрегации логов
        let responseCount = 0;

        // Буфер для JSON ответов (чтобы показывать их после WARNING)
        let pendingJsonResponse: { status: string; code: string; message: string; statusCode: number } | null = null;

        // Создаем readline interface для построчного чтения stdout
        const stdoutReader = readline.createInterface({
          input: abProcess.stdout!,
          crlfDelay: Infinity, // Правильная обработка \r\n
        });

        stdoutReader.on('line', (line: string) => {
          // Не обрабатываем данные если процесс остановлен пользователем
          if (this.stoppedByUser.has(sessionId)) {
            return;
          }

          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }

          // Добавляем к общему выводу для финального парсинга
          output += `${line}\n`;

          // 1. Начало теста
          if (trimmed.includes('Benchmarking')) {
            onLog(LogLevel.info, `🚀 ${trimmed}`);
          } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            // JSON ответы сервера
            try {
              const parsed = JSON.parse(trimmed);
              const code = parsed.code || parsed.statusCode || '';

              // Сохраняем в буфер вместо немедленного вывода
              pendingJsonResponse = {
                status: parsed.status || 'unknown',
                code,
                message: parsed.message || 'Unknown error',
                statusCode: parsed.statusCode || code || 0,
              };
            } catch (e) {
              onLog(LogLevel.debug, `Failed to parse JSON: ${trimmed.substring(0, 100)}...`);
            }
          } else if (trimmed.includes('WARNING: Response code not 2xx')) {
            // WARNING - инкрементируем счетчик и выводим оба лога в правильном порядке
            responseCount++;
            const statusMatch = trimmed.match(/Response code not 2xx \((\d+)\)/);

            let msg = `⚠️ Request #${responseCount}: `;

            // 1. Сначала выводим Request
            if (statusMatch) {
              const statusCode = parseInt(statusMatch[1]);
              msg += `statusCode: ${statusCode}, `;
            } else {
              msg += `Non-2xx response, `;
            }

            // 2. Потом выводим буферизованный JSON ответ
            if (pendingJsonResponse) {
              msg += `status: ${pendingJsonResponse.status},\n
              code: ${pendingJsonResponse.code},\n
              message: ${pendingJsonResponse.message}`;

              if (pendingJsonResponse.statusCode >= 400) {
                onLog(LogLevel.error, msg);
              } else if (verbosity >= 3) {
                onLog(LogLevel.debug, msg);
              }
              pendingJsonResponse = null; // Очищаем буфер
            } else {
              onLog(LogLevel.error, msg);
            }
          } else if (trimmed.includes('LOG: Response code')) {
            // Только для успешных 2xx ответов (когда нет WARNING и JSON)
            const codeMatch = trimmed.match(/Response code = (\d+)/);
            if (codeMatch) {
              const statusCode = parseInt(codeMatch[1]);
              if (statusCode >= 200 && statusCode < 300) {
                responseCount++;
                if (responseCount % 10 === 0) {
                  onLog(LogLevel.debug, `Progress: ${responseCount} requests completed`);
                } else if (verbosity >= 3) {
                  onLog(LogLevel.debug, `Request #${responseCount}: HTTP ${statusCode}`);
                }
              }
            }
          }
        });

        abProcess.stderr?.on('data', (data) => {
          // Не обрабатываем данные если процесс остановлен пользователем
          if (this.stoppedByUser.has(sessionId)) {
            return;
          }

          const chunk = data.toString();
          errorOutput += chunk;

          // STDERR может содержать полезную информацию о прогрессе
          const lines = chunk.split('\n').filter((line: string) => line.trim());
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            // Прогресс выполнения из stderr
            if (trimmed.includes('Completed') && trimmed.includes('requests')) {
              const match = trimmed.match(/Completed (\d+) requests/);
              if (match) {
                onLog(LogLevel.info, `✅ Finished: ${match[1]} requests`);
              }
            } else if (trimmed.includes('apr_socket_recv') || trimmed.includes('Connection') || trimmed.includes('Failed')) {
              // Ошибки соединения
              onLog(LogLevel.error, `❌ Error: ${trimmed}`);
            } else if (!trimmed.includes('Finished') && !this.isIgnorableDebugMessage(trimmed)) {
              // Все остальное + исключаем строки с 'Finished' и игнорируемые сообщения
              onLog(LogLevel.debug, `STDERR: ${trimmed}`);
            }
          }
        });

        abProcess.on('close', (code) => {
          // Очищаем интервал прогресса
          clearInterval(progressInterval);

          // Закрываем readline interface
          stdoutReader.close();

          // Очищаем буфер JSON ответов
          pendingJsonResponse = null;

          // Проверяем, был ли процесс остановлен пользователем
          if (this.stoppedByUser.has(sessionId)) {
            this.stoppedByUser.delete(sessionId);
            this.activeProcesses.delete(sessionId);
            onLog(LogLevel.info, 'Test stopped by user');
            // Очищаем временные файлы при остановке
            this.cleanupTempFiles(sessionId).catch(() => {});
            // Возвращаем null чтобы указать что тест был остановлен пользователем
            resolve(null);

            return;
          }

          // Удаляем процесс из активных
          this.activeProcesses.delete(sessionId);

          if (code !== 0) {
            const error = `Apache Benchmark finished with code ${code}: ${errorOutput}`;
            onLog(LogLevel.error, error);
            reject(new Error(error));

            return;
          }

          try {
            const parsedResult = this.parseResults(output);
            const result: ABTestResult = {
              serverHostname: parsedResult.serverHostname || '',
              serverPort: parsedResult.serverPort || 80,
              documentPath: parsedResult.documentPath || '',
              concurrencyLevel: parsedResult.concurrencyLevel || config.concurrency,
              timeTaken: parsedResult.timeTaken || 0,
              completeRequests: parsedResult.completeRequests || 0,
              failedRequests: parsedResult.failedRequests || 0,
              totalTransferred: parsedResult.totalTransferred || 0,
              htmlTransferred: parsedResult.htmlTransferred || 0,
              requestsPerSecond: parsedResult.requestsPerSecond || 0,
              timePerRequest: parsedResult.timePerRequest || 0,
              timePerRequestConcurrent: parsedResult.timePerRequestConcurrent || 0,
              transferRate: parsedResult.transferRate || 0,
              ...parsedResult,
            };

            onLog(LogLevel.info, `Test completed: ${result.requestsPerSecond.toFixed(2)} RPS`);
            resolve(result);
          } catch (parseError) {
            onLog(LogLevel.error, `Error parsing results: ${parseError}`);
            reject(parseError);
          } finally {
            // Очищаем временные файлы
            this.cleanupTempFiles(sessionId).catch(() => {});
          }
        });

        abProcess.on('error', (error) => {
          clearInterval(progressInterval);

          // Закрываем readline interface
          stdoutReader.close();

          // Очищаем буфер JSON ответов
          pendingJsonResponse = null;

          onLog(LogLevel.error, `Error process: ${error.message}`);
          // Очищаем временные файлы при ошибке
          this.cleanupTempFiles(sessionId).catch(() => {});
          reject(error);
        });

        onLog(LogLevel.info, 'Apache Benchmark started...');
        onLog(LogLevel.info, `Running ${config.requests} requests with concurrency ${config.concurrency}`);
      });
    } catch (error) {
      onLog(LogLevel.error, `Error start: ${error}`);
      throw error;
    } finally {
      await this.cleanupTempFiles(sessionId);
    }
  }

  /**
   * Остановка процесса Apache Benchmark
   */
  stopTest(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);

    if (process && !process.killed) {
      try {
        this.stoppedByUser.add(sessionId);

        // Мгновенная принудительная остановка
        // process.kill('SIGTERM');
        process.kill('SIGKILL');
        console.log(`Process Apache Benchmark forcibly stopped for session: ${sessionId}`);

        // Сразу удаляем из активных процессов
        this.activeProcesses.delete(sessionId);

        return true;
      } catch (error) {
        console.error(`Error stopping process for session ${sessionId}:`, error);

        return false;
      }
    }

    return false;
  }

  /**
   * Очистка временных файлов
   */
  private async cleanupTempFiles(sessionId: string): Promise<void> {
    try {
      const dataFile = path.join(this.tempDir, `${sessionId}-data.txt`);
      await fs.unlink(dataFile).catch(() => {}); // Игнорируем ошибки
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }

  /**
   * Проверка доступности Apache Benchmark
   */
  static async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('ab', ['-V'], { stdio: 'pipe' });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }
}
