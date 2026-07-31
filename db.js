const { createClient } = require('@libsql/client');
const path = require('node:path');

// 本地开发：数据存在项目目录下的 data.db 文件里
// 部署到 Render 后：通过 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 环境变量
// 连接到云端的 Turso 数据库，这样数据不会因为服务重启/休眠而丢失
const client = process.env.TURSO_DATABASE_URL
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : createClient({ url: `file:${path.join(__dirname, 'data.db')}` });

async function init() {
  await client.executeMultiple(`
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS board_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_date TEXT NOT NULL,
      slot TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      added_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// 小工具函数，包装 libsql 的 execute，方便在 server.js 里像普通 async/await 一样用
async function run(sql, args = []) {
  return client.execute({ sql, args });
}

async function get(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

module.exports = { client, init, run, get, all };
