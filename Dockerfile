# Multi-stage build для Apache Benchmark Tester
FROM node:22-alpine AS base

# Установка системных зависимостей
RUN apk add --no-cache \
    apache2-utils \
    && rm -rf /var/cache/apk/*

# Установка рабочей директории
WORKDIR /app

# Копирование package.json файлов
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Установка зависимостей
RUN npm install --omit=dev && npm cache clean --force

# Stage для сборки клиента
FROM base AS client-builder

# Установка всех зависимостей (включая dev)
RUN npm install

# Копирование исходного кода клиента
COPY client/ ./client/
COPY tsconfig*.json ./

# Сборка клиента
RUN npm run client:build

# Stage для сборки сервера
FROM base AS server-builder

# Установка всех зависимостей (включая dev)
RUN npm install

# Копирование исходного кода сервера
COPY server/ ./server/
COPY tsconfig*.json ./

# Сборка сервера
RUN npm run server:build

# Production stage
FROM node:22-alpine AS production

# Установка системных зависимостей
RUN apk add --no-cache \
    apache2-utils \
    wget \
    && rm -rf /var/cache/apk/*

# Установка рабочей директории
WORKDIR /app

# Копирование package.json файлов
COPY package*.json ./
COPY server/package*.json ./server/

# Установка только production зависимостей
RUN npm install --omit=dev && npm cache clean --force

# Копирование собранных приложений
COPY --from=client-builder /app/client/build ./client/build
COPY --from=server-builder /app/server/dist ./server/dist

# Копирование конфигурационных файлов
COPY ecosystem.config.js ./

# Создание директорий для логов и временных файлов
RUN mkdir -p logs temp

# Открытие портов
EXPOSE 5173

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=5173

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5173/api/health || exit 1

# Запуск приложения (сервер + статические файлы клиента)
CMD ["npm", "run", "server:start"]
