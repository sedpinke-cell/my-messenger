const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const crypto = require('crypto');

const users = new Map();
const friends = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Единый обработчик всех запросов
const server = http.createServer((req, res) => {
  // Лог для отладки
  console.log(`${req.method} ${req.url}`);

  // Обработка POST /register
  if (req.method === 'POST' && req.url === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const id = username.toLowerCase();

        if (users.has(id)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Пользователь уже существует' }));
          return;
        }

        users.set(id, { name: username, password: hashPassword(password) });
        friends.set(id, new Set());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверные данные' }));
      }
    });
    return;
  }

  // Обработка POST /login
  if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const id = username.toLowerCase();
        const user = users.get(id);

        if (!user || user.password !== hashPassword(password)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Неверный логин или пароль' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: id,
          name: user.name,
          friends: Array.from(friends.get(id))
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверные данные' }));
      }
    });
    return;
  }

  // Обработка GET /
  if (req.method === 'GET' && req.url === '/') {
    fs.readFile('index.html', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Ошибка сервера');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }

  // Все остальные маршруты — 404
  res.writeHead(404);
  res.end('Not Found');
});

// WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'chat') {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  });
});

// Порт
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});