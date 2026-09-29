import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  Notification,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "node:path";
import process from "node:process";
import { ServerManager } from "./server-manager.js";
import { TrayManager } from "./tray-manager.js";

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let serverManager: ServerManager | null = null;
let trayManager: TrayManager | null = null;
let serverPort: number = 3100;
let isQuitting: boolean = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const appRoot = path.resolve(__dirname, "..");
    trayManager = new TrayManager(appRoot);
    trayManager.init();

    // 1. Create splash window
    createSplashWindow(appRoot);

    // 2. Start Paperclip backend
    serverManager = new ServerManager({
      appRoot,
      isPackaged: app.isPackaged,
      preferredPort: 3100,
      logFile: path.join(app.getPath("userData"), "logs", "server.log"),
      bundledServerPath: path.join(process.resourcesPath, "server", "dist", "index.js"),
      onStatus: (status) => {
        sendSplashStatus(status);
      },
      onLog: (log) => {
        if (!app.isPackaged) {
          console.log(log);
        }
      },
    });

    try {
      serverPort = await serverManager.start();
      trayManager.setPort(serverPort);

      // 3. Create main window
      await createMainWindow(appRoot, serverPort);

      // 4. Close splash window smoothly
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    } catch (err: any) {
      const message = `Error starting Paperclip: ${err?.message ?? "Unknown error"}`;
      console.error(message);
      sendSplashStatus(message);
      // Skip the dialog when the user already dismissed the splash to quit:
      // the failure below is usually the shutdown itself killing the spawn.
      if (!isQuitting) {
        dialog.showErrorBox("Paperclip failed to start", message);
      }
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const appRoot = path.resolve(__dirname, "..");
      createMainWindow(appRoot, serverPort);
    }
  });

  app.on("before-quit", async () => {
    isQuitting = true;
    trayManager?.destroy();
    if (serverManager) {
      await serverManager.stop();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

function sendSplashStatus(status: string) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("desktop:status", status);
  }
}

function createSplashWindow(appRoot: string) {
  const options: BrowserWindowConstructorOptions = {
    width: 480,
    height: 400,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  splashWindow = new BrowserWindow(options);
  // The user can dismiss the splash while the server is still starting (it is
  // no longer always-on-top). Null the reference so later status updates do
  // not touch a destroyed window; if startup then succeeds the main window
  // still opens, and if it fails the error dialog still shows.
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
  splashWindow.loadFile(path.join(appRoot, "splash.html"));
  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });
}

async function createMainWindow(appRoot: string, port: number) {
  const options: BrowserWindowConstructorOptions = {
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: "Paperclip — AI Agent Control Plane",
    backgroundColor: "#090a0f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };

  mainWindow = new BrowserWindow(options);
  trayManager?.setMainWindow(mainWindow);

  // Load local server Paperclip UI
  const targetUrl = `http://127.0.0.1:${port}`;
  await mainWindow.loadURL(targetUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    // Open external links in user's default browser
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("desktop:getServerPort", () => serverPort);

ipcMain.handle("desktop:openExternal", (_event: any, url: string) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return shell.openExternal(url);
  }
});

ipcMain.handle("desktop:sendNotification", (_event: any, { title, body }: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});
