const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const crypto = require('crypto');

// Сохранение в файл
const DB_FILE = 'users.json';

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: {}, friends: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const DB = loadDB();
const users = new Map(Object.entries(DB.users));
const friends = new Map(Object.entries(DB.friends).map(([k, v]) => [k, new Set(v)]));

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // Регистрация
    if (req.method === 'POST' && req.url === '/register') {
      const { username, password } = JSON.parse(body);
      const id = username.toLowerCase();
      if (users.has(id)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Существует' }));
        return;
      }
      users.set(id, { name: username, password: hashPassword(password) });
      friends.set(id, new Set());
      DB.users[id] = { name: username, password: hashPassword(password) };
      DB.friends[id] = [];
      saveDB(DB);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }

    // Вход
    else if (req.method === 'POST' && req.url === '/login') {
      const { username, password } = JSON.parse(body);
      const id = username.toLowerCase();
      const user = users.get(id);
      if (!user || user.password !== hashPassword(password)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ошибка' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: id,
        name: user.name,
        friends: Array.from(friends.get(id))
      }));
    }

    // Поиск пользователя
    else if (req.method === 'GET' && req.url.startsWith('/user?id=')) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const friendId = url.searchParams.get('id').toLowerCase();
      if (users.has(friendId)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: true, id: friendId, name: users.get(friendId).name }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false }));
      }
    }

    // Главная
    else if (req.method === 'GET' && req.url === '/') {
      fs.readFile('index.html', (err, data) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    }

    // 404
    else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});
