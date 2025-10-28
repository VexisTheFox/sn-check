import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";

const DB_PATH = process.env.SQLITE_PATH || "./data/serialcheck.sqlite";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "changeme";

const serialStatuses = ["verified", "fake", "unknown"];

export async function initDb() {
  sqlite3.verbose();
  await ensureDataDirectory(DB_PATH);
  const db = await openDb(DB_PATH);
  await run(db, "PRAGMA foreign_keys = ON");
  await run(db, `CREATE TABLE IF NOT EXISTS serials (
      sn TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('verified','fake','unknown')),
      note TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  await run(db, `CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  await ensureAdminUser(db, ADMIN_USER, ADMIN_PASS);
  return db;
}

async function ensureDataDirectory(path) {
  const { dirname } = await import("path");
  const fs = await import("fs/promises");
  const dir = dirname(path);
  if (!dir || dir === ".") return;
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

function openDb(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function ensureAdminUser(db, username, password) {
  const existing = await get(db, "SELECT * FROM admin WHERE username = ?", [username]);
  if (existing) {
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  await run(db, "INSERT INTO admin (username, password_hash) VALUES (?, ?)", [username, hash]);
  console.log(`Created default admin user '${username}'. Please change the password.`);
}

export const dbHelpers = {
  run,
  get,
  all,
  serialStatuses
};
