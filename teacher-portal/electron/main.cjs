/**
 * electron/main.cjs
 * Electron main process for AttendanceClient.exe
 *
 * Uses CommonJS (.cjs) because the React project has "type":"module" in
 * package.json, which makes Node treat all .js files as ESM — but Electron's
 * main process must be CommonJS.
 *
 * Behavior:
 *  1. Shows a loading screen while polling for the FastAPI backend on port 8000
 *  2. Loads dist/index.html (compiled React) once the server is reachable
 *  3. Shows an error dialog if the server never responds
 */

"use strict";

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_URL = "http://localhost:8000";
const SERVER_HEALTH = `${SERVER_URL}/`;
const MAX_WAIT_MS = 30_000; // 30 seconds max wait for server
const POLL_INTERVAL_MS = 1_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Ping the backend once. Returns a Promise<boolean>. */
function pingServer() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_HEALTH, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Poll the server until it responds or timeout is reached. */
async function waitForServer(win) {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const ok = await pingServer();
    if (ok) return true;
    const elapsed = Math.round((Date.now() - start) / 1000);
    if (win && !win.isDestroyed()) {
      win.webContents
        .executeJavaScript(
          `document.getElementById('status') && (document.getElementById('status').textContent = 'Connecting to server... (${elapsed}s)')`
        )
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

// ─── Loading Screen HTML ─────────────────────────────────────────────────────

const LOADING_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Attendance App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #e2e8f0;
      user-select: none;
    }
    .logo { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.5rem; }
    p  { color: #94a3b8; font-size: 0.95rem; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #334155;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 2rem 0 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { color: #64748b; font-size: 0.85rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="logo">&#128203;</div>
  <h1>Attendance App</h1>
  <p>Loading, please wait...</p>
  <div class="spinner"></div>
  <p id="status">Connecting to server...</p>
</body>
</html>`;

// ─── Main Window ─────────────────────────────────────────────────────────────

let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Attendance App",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    backgroundColor: "#0f172a",
  });

  mainWindow.setMenuBarVisibility(false);

  // Show the loading screen
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`
  );
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Restore focus to the renderer after any native dialog (alert/confirm/prompt)
  // closes — without this, Electron can lose keyboard focus and inputs stop working.
  mainWindow.on("blur", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.focus();
    }
  });

  // Open external links in the OS browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Wait for the backend to become ready
  const serverReady = await waitForServer(mainWindow);

  if (!serverReady) {
    dialog.showErrorBox(
      "Server Not Running",
      "Could not connect to AttendanceServer on port 8000.\n\n" +
        "Please start AttendanceServer.exe first, then reopen the client."
    );
    app.quit();
    return;
  }

  // Load the compiled React app
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      "Build Not Found",
      `Could not find the compiled React app at:\n${indexPath}\n\nPlease rebuild with: npm run build`
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(indexPath);
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
