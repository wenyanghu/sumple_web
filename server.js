const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { storageMode, readTodos, writeTodos } = require("./lib/storage");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

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
      sendJson(res, 200, { ok: true, storage: storageMode() });
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
      sendJson(res, 200, { ok: true, storage: storageMode() });
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
  const mode = storageMode();
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    mode === "postgres"
      ? "Todos stored in PostgreSQL (DATABASE_URL)"
      : "Todos stored in data/todos.json (local file)"
  );
});
