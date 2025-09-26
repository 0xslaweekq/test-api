export interface ABTestConfig {
  url: string;
  requests: number;
  concurrency: number;
  timelimit?: number;
  keepalive?: boolean;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  dataBody?: string;
  contentType?: string;
  timeout?: number;
  verbosity?: number;
  authUsername?: string;
  authPassword?: string;
  proxyUrl?: string;
  acceptVaryingLength?: boolean;
}

export interface ABTestResult {
  serverSoftware?: string;
  serverHostname: string;
  serverPort: number;
  documentPath: string;
  documentLength?: number;
  concurrencyLevel: number;
  timeTaken: number;
  completeRequests: number;
  failedRequests: number;
  totalTransferred: number;
  htmlTransferred: number;
  requestsPerSecond: number;
  timePerRequest: number;
  timePerRequestConcurrent: number;
  transferRate: number;
  percentileTable?: {
    percentage: number;
    time: number;
  }[];
  // Новые поля для анализа статус-кодов
  statusCodes?: Record<string, number>; // { "200": 5, "401": 3, "500": 2 }
  successfulRequests?: number; // запросы с 2xx статусами
  clientErrors?: number; // 4xx статусы
  serverErrors?: number; // 5xx статусы
  redirects?: number; // 3xx статусы
  errorSummary?: {
    statusCode: string;
    count: number;
    message: string;
  }[];
  error?: string;
}

export enum WebSocketMessageType {
  test_start = 'test_start',
  test_progress = 'test_progress',
  test_complete = 'test_complete',
  test_error = 'test_error',
  log = 'log',
  connected = 'connected',
  session_state = 'session_state',
  test_stopped = 'test_stopped',
}

export enum TestStatus {
  preparing = 'preparing',
  running = 'running',
  completed = 'completed',
  stopped = 'stopped',
  error = 'error',
}

export enum LogLevel {
  info = 'info',
  error = 'error',
  debug = 'debug',
}

export interface TestSession {
  id: string;
  config: ABTestConfig;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  result?: ABTestResult;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  sessionId: string;
  data?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SessionListItem {
  id: string;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  config: {
    url: string;
    requests: number;
    concurrency: number;
  };
}
