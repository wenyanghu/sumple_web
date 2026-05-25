const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const countEl = document.getElementById("todo-count");
const clearBtn = document.getElementById("clear-done");
const statusEl = document.getElementById("save-status");

let todos = [];
let saving = false;
let pendingSave = false;

init();

async function init() {
  setStatus("載入中...");
  try {
    todos = await loadTodos();
    render();
    setStatus("已載入");
  } catch {
    setStatus("載入失敗，請確認 server 有在跑", true);
    render();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  todos.unshift({
    id: crypto.randomUUID(),
    text,
    done: false,
  });

  input.value = "";
  saveAndRender();
});

clearBtn.addEventListener("click", () => {
  todos = todos.filter((todo) => !todo.done);
  saveAndRender();
});

async function loadTodos() {
  const res = await fetch("/api/todos");
  if (!res.ok) throw new Error("load failed");
  return await res.json();
}

async function saveTodos() {
  if (saving) {
    pendingSave = true;
    return;
  }

  saving = true;
  setStatus("儲存中...");

  try {
    const res = await fetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todos),
    });

    if (!res.ok) throw new Error("save failed");
    setStatus("已儲存");
  } catch {
    setStatus("儲存失敗", true);
  } finally {
    saving = false;
    if (pendingSave) {
      pendingSave = false;
      await saveTodos();
    }
  }
}

function saveAndRender() {
  render();
  saveTodos();
}

function render() {
  const activeCount = todos.filter((todo) => !todo.done).length;
  countEl.textContent = `${activeCount} 項待辦`;

  if (todos.length === 0) {
    list.innerHTML = `<li class="empty">還沒有待辦，加一個吧。</li>`;
    return;
  }

  list.innerHTML = todos
    .map(
      (todo) => `
        <li class="todo-item ${todo.done ? "done" : ""}" data-id="${todo.id}">
          <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="完成" />
          <span>${escapeHtml(todo.text)}</span>
          <button type="button" aria-label="刪除">&times;</button>
        </li>
      `
    )
    .join("");

  list.querySelectorAll(".todo-item").forEach((item) => {
    const id = item.dataset.id;
    const checkbox = item.querySelector('input[type="checkbox"]');
    const deleteBtn = item.querySelector("button");

    checkbox.addEventListener("change", () => {
      todos = todos.map((todo) =>
        todo.id === id ? { ...todo, done: checkbox.checked } : todo
      );
      saveAndRender();
    });

    deleteBtn.addEventListener("click", () => {
      todos = todos.filter((todo) => todo.id !== id);
      saveAndRender();
    });
  });
}

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
