# Быстрый старт Docker

## Запуск

```bash
# Запустить сервис
docker-compose -f ./docker-compose.* -p test_api up -d
```

## Проверка

```bash
# Проверить статус
docker-compose -f docker-compose.test.yml ps

# Проверить здоровье API
curl http://localhost:5173/api/health

# Проверить веб-интерфейс
curl -I http://localhost:5173/
```

## Управление

```bash
# Логи
docker-compose -f docker-compose.test.yml logs -f

# Остановка
docker-compose -f docker-compose.test.yml down

# Перезапуск
docker-compose -f docker-compose.test.yml restart
```

## Nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5173/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket поддержка
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Порт `127.0.0.1:5173` - только локальный доступ для nginx проксирования.
