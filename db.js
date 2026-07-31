const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, 'data.db');
const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '🙂',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  emoji TEXT NOT NULL DEFAULT '🍽️',
  added_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS board_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_date TEXT NOT NULL,
  slot TEXT NOT NULL,
  ingredient_id INTEGER NOT NULL,
  added_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);
`);

module.exports = db;
