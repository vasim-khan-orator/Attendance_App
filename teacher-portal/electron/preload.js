/**
 * electron/preload.js
 * Electron preload script — runs in the renderer context with Node.js access.
 *
 * We use contextBridge to safely expose only the APIs the React app needs
 * from the Node/Electron layer. Currently we expose nothing extra because
 * all API calls go through HTTP to localhost:8000.
 *
 * If you need to expose specific Electron APIs to React in the future,
 * add them here via contextBridge.exposeInMainWorld().
 */

const { contextBridge } = require("electron");

// Expose the server base URL so React can read it without hardcoding
contextBridge.exposeInMainWorld("electronEnv", {
  serverUrl: "http://localhost:8000",
});
