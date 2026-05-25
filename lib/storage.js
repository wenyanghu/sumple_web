const fs = require("fs/promises");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TODOS_FILE = path.join(ROOT, "data", "todos.json");
const TODOS_KEY = "todos";

let pool;

function storageMode() {
  return process.env.DATABASE_URL ? "postgres" : "file";
}

async function getPool() {
  if (!pool) {
    const { Pool } = require("pg");
    const ssl =
      process.env.DATABASE_SSL === "false"
        ? false
        : process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined;

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);
  }
  return pool;
}

async function readTodosFile() {
  try {
    const raw = await fs.readFile(TODOS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeTodosFile(todos) {
  await fs.mkdir(path.dirname(TODOS_FILE), { recursive: true });
  await fs.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2), "utf8");
}

async function readTodosPostgres() {
  const db = await getPool();
  const { rows } = await db.query("SELECT value FROM app_data WHERE key = $1", [
    TODOS_KEY,
  ]);
  const data = rows[0]?.value;
  return Array.isArray(data) ? data : [];
}

async function writeTodosPostgres(todos) {
  const db = await getPool();
  await db.query(
    `INSERT INTO app_data (key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [TODOS_KEY, JSON.stringify(todos)]
  );
}

async function readTodos() {
  return storageMode() === "postgres" ? readTodosPostgres() : readTodosFile();
}

async function writeTodos(todos) {
  return storageMode() === "postgres" ? writeTodosPostgres(todos) : writeTodosFile(todos);
}

module.exports = {
  storageMode,
  readTodos,
  writeTodos,
};
