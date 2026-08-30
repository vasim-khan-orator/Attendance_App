/**
 * electron/main.js
 * Electron main process for AttendanceClient.exe
 *
 * Behavior:
 *  1. Creates a native BrowserWindow and loads the compiled React app (dist/index.html)
 *  2. Optionally waits for AttendanceServer to be reachable before loading the UI
 *  3. Shows a loading screen while the server is starting up
 */

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
    // Update loading message
    if (win && !win.isDestroyed()) {
      const elapsed = Math.round((Date.now() - start) / 1000);
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
  <div class="logo">📋</div>
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
    show: false, // Show only after content is ready
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Use default frame for a clean look on Windows
    frame: true,
    backgroundColor: "#0f172a",
  });

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);

  // Show loading screen while waiting for server
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`
  );
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Wait for the backend to be ready
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
      `Could not find the React build at:\n${indexPath}\n\nPlease run: npm run build`
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(indexPath);
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // On Windows/Linux, quit when all windows are closed
  app.quit();
});

app.on("activate", () => {
  // macOS: re-create window if dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
