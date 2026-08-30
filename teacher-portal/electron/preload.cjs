/**
 * electron/preload.cjs
 * Electron preload script (CommonJS, .cjs to avoid ESM conflict).
 *
 * Exposes the backend server URL to the React renderer safely via contextBridge.
 * All actual API communication goes through standard HTTP to localhost:8000.
 */

"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronEnv", {
  serverUrl: "http://localhost:8000",
});
