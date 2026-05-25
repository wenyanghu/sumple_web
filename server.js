const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TODOS_FILE = path.join(ROOT, "data", "todos.json");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const USE_CLOUD = Boolean(SUPABASE_URL && SUPABASE_KEY);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function supabaseRequest(pathname, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${res.status}: ${detail}`);
  }

  return res;
}

async function readTodosFromFile() {
  try {
    const raw = await fs.readFile(TODOS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeTodosToFile(todos) {
  await fs.mkdir(path.dirname(TODOS_FILE), { recursive: true });
  await fs.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2), "utf8");
}

async function readTodosFromCloud() {
  const res = await supabaseRequest("app_data?key=eq.todos&select=value");
  const rows = await res.json();
  const value = rows[0]?.value;
  return Array.isArray(value) ? value : [];
}

async function writeTodosToCloud(todos) {
  await supabaseRequest("app_data?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "todos", value: todos }),
  });
}

async function readTodos() {
  return USE_CLOUD ? readTodosFromCloud() : readTodosFromFile();
}

async function writeTodos(todos) {
  return USE_CLOUD ? writeTodosToCloud(todos) : writeTodosToFile(todos);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch (err) {
    if (err.code === "ENOENT") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        storage: USE_CLOUD ? "supabase" : "file",
      });
      return;
    }

    if (req.url === "/api/todos" && req.method === "GET") {
      sendJson(res, 200, await readTodos());
      return;
    }

    if (req.url === "/api/todos" && req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "[]");

      if (!Array.isArray(body)) {
        sendJson(res, 400, { error: "Expected array" });
        return;
      }

      await writeTodos(body);
      sendJson(res, 200, { ok: true, storage: USE_CLOUD ? "supabase" : "file" });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    USE_CLOUD
      ? "Todos stored in Supabase (app_data.todos)"
      : `Todos saved to ${TODOS_FILE}`
  );
});
