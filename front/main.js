const API_BASE = "/api";
const TOKEN_KEY = "serialcheck_admin_token";
const USERNAME_KEY = "serialcheck_admin_username";

const serialInput = document.querySelector("#serial-input");
const checkBtn = document.querySelector("#check-btn");
const resultsContainer = document.querySelector("#results");
const checkStatus = document.querySelector("#check-status");
const yearEl = document.querySelector("#year");
const toggleAdminBtn = document.querySelector("#toggle-admin");
const adminPanel = document.querySelector("#admin-panel");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const adminContent = document.querySelector("#admin-content");
const adminStatus = document.querySelector("#admin-status");
const adminUsername = document.querySelector("#admin-username");
const logoutBtn = document.querySelector("#logout-btn");
const refreshListBtn = document.querySelector("#refresh-list");
const exportBtn = document.querySelector("#export-btn");
const reformatBtn = document.querySelector("#reformat-btn");
const resetRateBtn = document.querySelector("#reset-rate-btn");
const clearBtn = document.querySelector("#clear-btn");
const addForm = document.querySelector("#add-form");
const tableBody = document.querySelector("#serial-table tbody");

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  username: localStorage.getItem(USERNAME_KEY) || "",
  serialsCache: []
};

yearEl.textContent = new Date().getFullYear();

checkBtn.addEventListener("click", async () => {
  const serials = serialInput.value
    .split(/\r?\n/)
    .map((sn) => sn.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (serials.length === 0) {
    checkStatus.textContent = "Enter at least one serial.";
    resultsContainer.innerHTML = "";
    return;
  }

  checkBtn.disabled = true;
  checkStatus.textContent = "Checking...";

  try {
    const response = await fetch(`${API_BASE}/check-bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ serials })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
      const err = new Error(errorBody.error || "Request failed");
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    renderResults(data);
    checkStatus.textContent = "Done.";
  } catch (error) {
    checkStatus.textContent = error.message;
    resultsContainer.innerHTML = "";
  } finally {
    checkBtn.disabled = false;
  }
});

function renderResults(results) {
  resultsContainer.innerHTML = "";
  Object.entries(results).forEach(([serial, info]) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const serialEl = document.createElement("div");
    serialEl.className = "serial";
    serialEl.textContent = serial;

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    const badge = document.createElement("span");
    badge.className = `badge ${info.status || "unknown"}`;
    badge.textContent = (info.status || "unknown").toUpperCase();
    statusEl.append(badge);

    if (info.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "note";
      noteEl.textContent = info.note;
      card.append(serialEl, statusEl, noteEl);
    } else {
      card.append(serialEl, statusEl);
    }

    resultsContainer.append(card);
  });
}

toggleAdminBtn.addEventListener("click", () => {
  const isHidden = adminPanel.hasAttribute("hidden");
  if (isHidden) {
    adminPanel.removeAttribute("hidden");
  } else {
    adminPanel.setAttribute("hidden", "");
  }
  const expanded = !isHidden;
  toggleAdminBtn.setAttribute("aria-expanded", String(expanded));
  toggleAdminBtn.textContent = expanded ? "Hide Admin Panel" : "Show Admin Panel";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = event.target.querySelector("#login-username").value.trim();
  const password = event.target.querySelector("#login-password").value;
  if (!username || !password) {
    loginStatus.textContent = "Enter username and password.";
    return;
  }
  loginStatus.textContent = "Signing in...";

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: "Login failed" }));
      const err = new Error(errorBody.error || "Login failed");
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    state.token = data.token;
    state.username = username;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USERNAME_KEY, username);
    loginStatus.textContent = "Logged in.";
    setAdminState(true);
    await fetchSerials();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", () => {
  state.token = "";
  state.username = "";
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  adminStatus.textContent = "Logged out.";
  setAdminState(false);
});

refreshListBtn.addEventListener("click", async () => {
  await fetchSerials();
});

reformatBtn.addEventListener("click", () => adminAction("/admin/reformat", "Database reformatted."));
resetRateBtn.addEventListener("click", () => adminAction("/admin/reset-rate", "Rate limits reset."));
clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear all serial records?")) return;
  await adminAction("/admin/clear", "All serials cleared.");
  await fetchSerials();
});

exportBtn.addEventListener("click", () => {
  if (!state.serialsCache.length) {
    adminStatus.textContent = "Nothing to export.";
    return;
  }
  const exportData = Object.fromEntries(
    state.serialsCache.map((row) => [row.sn, { status: row.status, ...(row.note ? { note: row.note } : {}) }])
  );
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `serialcheck-export-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  adminStatus.textContent = "Export created.";
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sn = document.querySelector("#add-sn").value.trim();
  const status = document.querySelector("#add-status").value;
  const note = document.querySelector("#add-note").value.trim();
  if (!sn) {
    adminStatus.textContent = "Serial is required.";
    return;
  }
  await adminAction("/admin/add", "Serial saved.", {
    method: "POST",
    body: JSON.stringify({ sn, status, note })
  });
  addForm.reset();
  document.querySelector("#add-status").value = status;
  await fetchSerials();
});

tableBody.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest(".delete-btn");
  if (!deleteBtn) return;
  const sn = deleteBtn.dataset.sn ? decodeURIComponent(deleteBtn.dataset.sn) : "";
  if (!sn) return;
  if (!confirm(`Delete serial ${sn}?`)) return;
  await adminAction(`/admin/delete/${encodeURIComponent(sn)}`, "Serial deleted.", { method: "DELETE" });
  await fetchSerials();
});

async function fetchSerials() {
  if (!state.token) return;
  try {
    const response = await fetch(`${API_BASE}/admin/list`, {
      headers: createAuthHeaders()
    });
    if (!response.ok) {
      const err = new Error("Failed to load serials");
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    state.serialsCache = data;
    renderTable(data);
    adminStatus.textContent = `Loaded ${data.length} serial${data.length === 1 ? "" : "s"}.`;
  } catch (error) {
    if (responseUnauthorized(error)) {
      adminStatus.textContent = "Session expired. Please log in again.";
      clearToken();
      setAdminState(false);
      return;
    }
    adminStatus.textContent = error.message;
  }
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.sn)}</td>
      <td><span class="badge ${row.status}">${row.status.toUpperCase()}</span></td>
      <td>${row.note ? escapeHtml(row.note) : ""}</td>
      <td>${row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
      <td><button class="delete-btn" data-sn="${encodeURIComponent(row.sn)}">Delete</button></td>
    `;
    tableBody.append(tr);
  });
}

async function adminAction(path, successMessage, options = {}) {
  if (!state.token) {
    adminStatus.textContent = "Login required.";
    return;
  }
  adminStatus.textContent = "Working...";
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...createAuthHeaders()
      },
      body: options.body || null
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: "Action failed" }));
      const err = new Error(errorBody.error || "Action failed");
      err.status = response.status;
      throw err;
    }
    adminStatus.textContent = successMessage;
  } catch (error) {
    if (responseUnauthorized(error)) {
      adminStatus.textContent = "Session expired. Please log in again.";
      clearToken();
      setAdminState(false);
      return;
    }
    adminStatus.textContent = error.message;
  }
}

function setAdminState(isLoggedIn) {
  if (isLoggedIn && state.token) {
    adminContent.removeAttribute("hidden");
    loginForm.setAttribute("hidden", "");
    adminUsername.textContent = state.username;
  } else {
    adminContent.setAttribute("hidden", "");
    loginForm.removeAttribute("hidden");
    loginForm.reset();
    adminUsername.textContent = "";
  }
}

function createAuthHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function clearToken() {
  state.token = "";
  state.username = "";
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

function responseUnauthorized(error) {
  return Number(error?.status) === 401;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])
  );
}

if (state.token) {
  setAdminState(true);
  adminUsername.textContent = state.username;
  fetchSerials();
}
