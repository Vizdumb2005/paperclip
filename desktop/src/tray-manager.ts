import { Tray, Menu, nativeImage, shell, type BrowserWindow, type NativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private port: number = 3100;
  private appRoot: string;

  constructor(appRoot: string) {
    this.appRoot = appRoot;
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  setPort(port: number) {
    this.port = port;
    this.updateContextMenu();
  }

  init(): void {
    // Generate or load tray icon
    let iconPath = path.resolve(this.appRoot, "assets/icon.ico");
    let icon: NativeImage;

    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    } else {
      // 16x16 fallback bitmap
      icon = nativeImage.createEmpty();
    }

    try {
      this.tray = new Tray(icon);
      this.tray.setToolTip("Paperclip — AI Agent Control Plane");

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

  private updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open Paperclip",
        click: () => this.showWindow(),
      },
      {
        label: `Server: Running (Port ${this.port})`,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Open in Browser",
        click: () => {
          shell.openExternal(`http://127.0.0.1:${this.port}`);
        },
      },
      {
        label: "Toggle Developer Tools",
        click: () => {
          this.mainWindow?.webContents.toggleDevTools();
        },
      },
      { type: "separator" },
      {
        label: "Quit Paperclip",
        click: () => {
          this.mainWindow?.destroy();
          process.exit(0);
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private showWindow(): void {
    if (!this.mainWindow) return;
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  private toggleWindow(): void {
    if (!this.mainWindow) return;
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow();
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
