const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const db = require('./db');
const { guessEmoji } = require('./emoji-map');

const app = express();
const PORT = process.env.PORT || 3000;
const VALID_SLOTS = ['baby_breakfast', 'baby_dinner', 'adult_breakfast', 'adult_dinner'];
const AVATARS = ['🐻', '🐰', '🐱', '🐼', '🦊', '🐨', '🐯', '🐸'];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'family-meal-cute-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, // 30 days
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
  next();
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?');
  return stmt.get(id);
}

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: '请填写用户名、密码和昵称' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已被使用' });

  const hash = bcrypt.hashSync(password, 10);
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, avatar) VALUES (?, ?, ?, ?)'
  ).run(username, hash, displayName, avatar);

  req.session.userId = Number(info.lastInsertRowid);
  res.json({ user: getUserById(req.session.userId) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码不正确' });
  }
  req.session.userId = user.id;
  res.json({ user: getUserById(user.id) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: getUserById(req.session.userId) });
});

// ---------- Ingredients ----------
app.get('/api/ingredients', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, u.display_name AS added_by_name, u.avatar AS added_by_avatar
    FROM ingredients i LEFT JOIN users u ON u.id = i.added_by
    ORDER BY i.created_at DESC
  `).all();
  res.json({ ingredients: rows });
});

app.post('/api/ingredients', requireAuth, (req, res) => {
  const { name, category } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入食材名字' });
  const cat = ['meat', 'vegetable', 'fruit', 'staple', 'dairy', 'other'].includes(category) ? category : 'other';
  const emoji = guessEmoji(name, cat);
  const info = db.prepare(
    'INSERT INTO ingredients (name, category, emoji, added_by) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), cat, emoji, req.session.userId);
  const row = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(Number(info.lastInsertRowid));
  res.json({ ingredient: row });
});

app.delete('/api/ingredients/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM board_items WHERE ingredient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Board (daily meal slots) ----------
app.get('/api/board', requireAuth, (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: '缺少日期参数' });
  const rows = db.prepare(`
    SELECT b.*, i.name, i.emoji, i.category, u.display_name AS added_by_name
    FROM board_items b
    JOIN ingredients i ON i.id = b.ingredient_id
    LEFT JOIN users u ON u.id = b.added_by
    WHERE b.meal_date = ?
    ORDER BY b.created_at ASC
  `).all(date);
  res.json({ items: rows });
});

app.post('/api/board', requireAuth, (req, res) => {
  const { date, slot, ingredientId } = req.body || {};
  if (!date || !VALID_SLOTS.includes(slot) || !ingredientId) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const ing = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(ingredientId);
  if (!ing) return res.status(404).json({ error: '食材不存在' });

  const info = db.prepare(
    'INSERT INTO board_items (meal_date, slot, ingredient_id, added_by) VALUES (?, ?, ?, ?)'
  ).run(date, slot, ingredientId, req.session.userId);
  const row = db.prepare(`
    SELECT b.*, i.name, i.emoji, i.category, u.display_name AS added_by_name
    FROM board_items b
    JOIN ingredients i ON i.id = b.ingredient_id
    LEFT JOIN users u ON u.id = b.added_by
    WHERE b.id = ?
  `).get(Number(info.lastInsertRowid));
  res.json({ item: row });
});

app.delete('/api/board/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM board_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`家庭点餐工作台已启动: http://localhost:${PORT}`);
});
