# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a zero-dependency Node.js Todo app. The server (`server.js`) serves both the static frontend and REST API on port 3000.

### Running the app

```bash
npm run dev
```

This starts the server at `http://localhost:3000`. No build step required.

### Storage modes

- **File mode (default):** Todos persist to `data/todos.json`. No external services needed.
- **Cloud mode:** Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars to use Supabase. See `.env.example`.

### API endpoints

- `GET /api/health` — health check (returns storage mode)
- `GET /api/todos` — list all todos
- `PUT /api/todos` — replace all todos (body: JSON array)

### Notes

- No linter or test framework is configured in this repo.
- No build step exists — the frontend is vanilla HTML/CSS/JS served directly.
- The `data/` directory is created automatically on first write if it doesn't exist.
