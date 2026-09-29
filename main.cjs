"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_electron2 = require("electron");
var import_node_path3 = __toESM(require("node:path"));
var import_node_process3 = __toESM(require("node:process"));

// src/server-manager.ts
var import_node_child_process = require("node:child_process");
var import_node_path = __toESM(require("node:path"));
var import_node_http = __toESM(require("node:http"));
var import_node_net = __toESM(require("node:net"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_process = __toESM(require("node:process"));
function findRepoRoot(startDir) {
  let curr = startDir;
  for (let i = 0; i < 8; i++) {
    if (import_node_fs.default.existsSync(import_node_path.default.join(curr, "server/src/index.ts")) && import_node_fs.default.existsSync(import_node_path.default.join(curr, "package.json"))) {
      return curr;
    }
    const parent = import_node_path.default.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}
var ServerManager = class {
  port = 3100;
  childProc = null;
  options;
  isRunning = false;
  lastStderr = "";
  childExitCode = null;
  childSpawnError = "";
  constructor(options) {
    this.options = options;
    this.port = options.preferredPort ?? 3100;
  }
  getPort() {
    return this.port;
  }
  async start() {
    const alreadyAlive = await this.checkHealth(this.port);
    if (alreadyAlive) {
      this.options.onStatus?.(`Found active Paperclip server on port ${this.port}`);
      this.isRunning = true;
      return this.port;
    }
    this.options.onStatus?.("Starting Paperclip control plane server...");
    if (await this.isPortOccupied(this.port)) {
      throw new Error(
        `Port ${this.port} is already in use by another process that is not a healthy Paperclip server. Stop the other process (or wait for it to finish starting) and relaunch Paperclip.`
      );
    }
    const cwdRepo = findRepoRoot(import_node_process.default.cwd());
    const appRepo = findRepoRoot(this.options.appRoot);
    const repoRoot = cwdRepo || appRepo;
    let execCmd = "node";
    let execArgs = [];
    let spawnCwd = this.options.appRoot;
    if (repoRoot) {
      spawnCwd = import_node_path.default.join(repoRoot, "server");
      const tsxCli = import_node_path.default.join(repoRoot, "cli/node_modules/tsx/dist/cli.mjs");
      const serverSrc = import_node_path.default.join(repoRoot, "server/src/index.ts");
      if (import_node_fs.default.existsSync(tsxCli) && import_node_fs.default.existsSync(serverSrc)) {
        execCmd = "node";
        execArgs = [tsxCli, serverSrc];
      } else {
        execCmd = import_node_process.default.platform === "win32" ? "pnpm.cmd" : "pnpm";
        execArgs = ["--filter", "@paperclipai/server", "dev"];
        spawnCwd = repoRoot;
      }
    } else {
      const bundledServer = import_node_path.default.join(this.options.appRoot, "server/dist/index.js");
      if (!import_node_fs.default.existsSync(bundledServer)) {
        throw new Error(
          `Packaged server bundle not found at ${bundledServer}. The desktop installer does not ship a server build yet \u2014 launch from a Paperclip repo checkout instead.`
        );
      }
      execCmd = "node";
      execArgs = [bundledServer];
    }
    const env = {
      ...import_node_process.default.env,
      PORT: String(this.port),
      NODE_ENV: "development",
      PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
      PAPERCLIP_MIGRATION_PROMPT: "never"
    };
    try {
      this.childProc = (0, import_node_child_process.spawn)(execCmd, execArgs, {
        cwd: spawnCwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
        windowsHide: true
      });
      this.childProc.stdout?.on("data", (data) => {
        const text = data.toString();
        this.options.onLog?.(`[server] ${text}`);
        const clean = text.replace(/\u001b\[[0-9;]*m/g, "").replace(/\[\d{2}:\d{2}:\d{2}\]\s+[A-Z]+:\s+/, "").trim();
        if (clean.length > 0 && clean.length < 80 && !/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//.test(clean)) {
          this.options.onStatus?.(clean);
        }
      });
      this.childProc.stderr?.on("data", (data) => {
        const text = data.toString();
        this.lastStderr = text;
        this.options.onLog?.(`[server:err] ${text}`);
      });
      this.childProc.on("exit", (code) => {
        this.isRunning = false;
        this.childExitCode = code;
        if (code !== 0 && code !== null) {
          this.options.onStatus?.(`Server stopped with code ${code}. ${this.lastStderr}`);
        }
      });
      this.childProc.on("error", (err) => {
        this.childSpawnError = err.message;
      });
      await this.waitForHealthy(60, 1e3);
      this.isRunning = true;
      this.options.onStatus?.("Paperclip control plane ready!");
      return this.port;
    } catch (err) {
      this.options.onStatus?.(`Failed to launch server: ${err.message}`);
      throw err;
    }
  }
  async stop() {
    if (!this.childProc) return;
    this.options.onStatus?.("Stopping Paperclip server...");
    return new Promise((resolve) => {
      const proc = this.childProc;
      if (!proc || proc.killed) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
        }
        resolve();
      }, 5e3);
      proc.on("exit", () => {
        clearTimeout(timer);
        this.childProc = null;
        this.isRunning = false;
        resolve();
      });
      try {
        proc.kill("SIGINT");
      } catch {
        resolve();
      }
    });
  }
  async waitForHealthy(maxAttempts, intervalMs) {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.childSpawnError) {
        throw new Error(`Server failed to launch: ${this.childSpawnError}`);
      }
      if (this.childExitCode !== null && this.childExitCode !== 0) {
        throw new Error(
          `Server crashed on startup (exit code ${this.childExitCode})${this.lastStderr ? `: ${this.lastStderr.trim().slice(-500)}` : ""}`
        );
      }
      const isHealthy = await this.checkHealth(this.port);
      if (isHealthy) return;
      if (i % 5 === 0 && i > 0) {
        this.options.onStatus?.(`Starting database & server services (${i}s)...`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `Server failed to report healthy on port ${this.port} after ${maxAttempts} seconds` + (this.lastStderr ? `. Server output: ${this.lastStderr.trim().slice(-500)}` : ". Check that no other process is using the port.")
    );
  }
  isPortOccupied(port) {
    return new Promise((resolve) => {
      const socket = import_node_net.default.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(2e3, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
  checkHealth(port) {
    return new Promise((resolve) => {
      const req = import_node_http.default.get(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/health",
          timeout: 2e3
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }
};

// src/tray-manager.ts
var import_electron = require("electron");
var import_node_path2 = __toESM(require("node:path"));
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_process2 = __toESM(require("node:process"));
var TrayManager = class {
  tray = null;
  mainWindow = null;
  port = 3100;
  appRoot;
  constructor(appRoot) {
    this.appRoot = appRoot;
  }
  setMainWindow(win) {
    this.mainWindow = win;
  }
  setPort(port) {
    this.port = port;
    this.updateContextMenu();
  }
  init() {
    let iconPath = import_node_path2.default.resolve(this.appRoot, "assets/icon.ico");
    let icon;
    if (import_node_fs2.default.existsSync(iconPath)) {
      icon = import_electron.nativeImage.createFromPath(iconPath);
    } else {
      icon = import_electron.nativeImage.createEmpty();
    }
    try {
      this.tray = new import_electron.Tray(icon);
      this.tray.setToolTip("Paperclip \u2014 AI Agent Control Plane");
      this.tray.on("click", () => {
        this.toggleWindow();
      });
      this.tray.on("double-click", () => {
        this.showWindow();
      });
      this.updateContextMenu();
    } catch (err) {
      console.warn("Could not initialize system tray:", err);
    }
  }
  updateContextMenu() {
    if (!this.tray) return;
    const contextMenu = import_electron.Menu.buildFromTemplate([
      {
        label: "Open Paperclip",
        click: () => this.showWindow()
      },
      {
        label: `Server: Running (Port ${this.port})`,
        enabled: false
      },
      { type: "separator" },
      {
        label: "Open in Browser",
        click: () => {
          import_electron.shell.openExternal(`http://127.0.0.1:${this.port}`);
        }
      },
      {
        label: "Toggle Developer Tools",
        click: () => {
          this.mainWindow?.webContents.toggleDevTools();
        }
      },
      { type: "separator" },
      {
        label: "Quit Paperclip",
        click: () => {
          this.mainWindow?.destroy();
          import_node_process2.default.exit(0);
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  showWindow() {
    if (!this.mainWindow) return;
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.show();
    this.mainWindow.focus();
  }
  toggleWindow() {
    if (!this.mainWindow) return;
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow();
    }
  }
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
};

// src/main.ts
var mainWindow = null;
var splashWindow = null;
var serverManager = null;
var trayManager = null;
var serverPort = 3100;
var isQuitting = false;
var gotTheLock = import_electron2.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron2.app.quit();
} else {
  import_electron2.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  import_electron2.app.whenReady().then(async () => {
    const appRoot = import_node_path3.default.resolve(__dirname, "..");
    trayManager = new TrayManager(appRoot);
    trayManager.init();
    createSplashWindow(appRoot);
    serverManager = new ServerManager({
      appRoot,
      isPackaged: import_electron2.app.isPackaged,
      preferredPort: 3100,
      onStatus: (status) => {
        sendSplashStatus(status);
      },
      onLog: (log) => {
        if (!import_electron2.app.isPackaged) {
          console.log(log);
        }
      }
    });
    try {
      serverPort = await serverManager.start();
      trayManager.setPort(serverPort);
      await createMainWindow(appRoot, serverPort);
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    } catch (err) {
      const message = `Error starting Paperclip: ${err?.message ?? "Unknown error"}`;
      console.error(message);
      sendSplashStatus(message);
      if (!isQuitting) {
        import_electron2.dialog.showErrorBox("Paperclip failed to start", message);
      }
    }
  });
  import_electron2.app.on("activate", () => {
    if (import_electron2.BrowserWindow.getAllWindows().length === 0) {
      const appRoot = import_node_path3.default.resolve(__dirname, "..");
      createMainWindow(appRoot, serverPort);
    }
  });
  import_electron2.app.on("before-quit", async () => {
    isQuitting = true;
    trayManager?.destroy();
    if (serverManager) {
      await serverManager.stop();
    }
  });
  import_electron2.app.on("window-all-closed", () => {
    if (import_node_process3.default.platform !== "darwin") {
      import_electron2.app.quit();
    }
  });
}
function sendSplashStatus(status) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("desktop:status", status);
  }
}
function createSplashWindow(appRoot) {
  const options = {
    width: 480,
    height: 400,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    webPreferences: {
      preload: import_node_path3.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  splashWindow = new import_electron2.BrowserWindow(options);
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
  splashWindow.loadFile(import_node_path3.default.join(appRoot, "splash.html"));
  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });
}
async function createMainWindow(appRoot, port) {
  const options = {
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: "Paperclip \u2014 AI Agent Control Plane",
    backgroundColor: "#090a0f",
    show: false,
    webPreferences: {
      preload: import_node_path3.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
  mainWindow = new import_electron2.BrowserWindow(options);
  trayManager?.setMainWindow(mainWindow);
  const targetUrl = `http://127.0.0.1:${port}`;
  await mainWindow.loadURL(targetUrl);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      import_electron2.shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron2.ipcMain.handle("desktop:getServerPort", () => serverPort);
import_electron2.ipcMain.handle("desktop:openExternal", (_event, url) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return import_electron2.shell.openExternal(url);
  }
});
import_electron2.ipcMain.handle("desktop:sendNotification", (_event, { title, body }) => {
  if (import_electron2.Notification.isSupported()) {
    new import_electron2.Notification({ title, body }).show();
  }
});
//# sourceMappingURL=main.cjs.map
