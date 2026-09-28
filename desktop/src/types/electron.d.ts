declare module "electron" {
  export interface App {
    isPackaged: boolean;
    requestSingleInstanceLock(): boolean;
    quit(): void;
    whenReady(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface BrowserWindowConstructorOptions {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    resizable?: boolean;
    frame?: boolean;
    transparent?: boolean;
    alwaysOnTop?: boolean;
    center?: boolean;
    show?: boolean;
    title?: string;
    backgroundColor?: string;
    webPreferences?: {
      preload?: string;
      contextIsolation?: boolean;
      nodeIntegration?: boolean;
      sandbox?: boolean;
    };
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions);
    static getAllWindows(): BrowserWindow[];
    webContents: {
      send(channel: string, ...args: any[]): void;
      toggleDevTools(): void;
      setWindowOpenHandler(handler: (details: { url: string }) => { action: "allow" | "deny" }): void;
    };
    loadFile(filePath: string): Promise<void>;
    loadURL(url: string): Promise<void>;
    show(): void;
    hide(): void;
    focus(): void;
    close(): void;
    destroy(): void;
    isMinimized(): boolean;
    isVisible(): boolean;
    restore(): void;
    once(event: string, listener: (...args: any[]) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export class Tray {
    constructor(image: NativeImage);
    setToolTip(toolTip: string): void;
    setContextMenu(menu: Menu | null): void;
    destroy(): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface MenuItemConstructorOptions {
    label?: string;
    click?: () => void;
    enabled?: boolean;
    type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
  }

  export class Menu {
    static buildFromTemplate(template: MenuItemConstructorOptions[]): Menu;
  }

  export interface NativeImage {
    isEmpty(): boolean;
  }

  export const nativeImage: {
    createFromPath(path: string): NativeImage;
    createEmpty(): NativeImage;
  };

  export const shell: {
    openExternal(url: string): Promise<void>;
  };

  export class Notification {
    constructor(options: { title: string; body: string });
    static isSupported(): boolean;
    show(): void;
  }

  export const ipcMain: {
    handle(channel: string, listener: (event: any, ...args: any[]) => any): void;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };

  export const app: App;
}
