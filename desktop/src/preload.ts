import { contextBridge, ipcRenderer } from "electron";

export interface PaperclipDesktopBridge {
  platform: "win32" | "darwin" | "linux";
  version: string;
  getServerPort: () => Promise<number>;
  openExternal: (url: string) => Promise<void>;
  sendNotification: (title: string, body: string) => Promise<void>;
  onStatusUpdate: (callback: (status: string) => void) => void;
}

const api: PaperclipDesktopBridge = {
  platform: "win32",
  version: "0.3.1",
  getServerPort: () => ipcRenderer.invoke("desktop:getServerPort"),
  openExternal: (url: string) => ipcRenderer.invoke("desktop:openExternal", url),
  sendNotification: (title: string, body: string) =>
    ipcRenderer.invoke("desktop:sendNotification", { title, body }),
  onStatusUpdate: (callback: (status: string) => void) => {
    ipcRenderer.on("desktop:status", (_event, status: string) => callback(status));
  },
};

contextBridge.exposeInMainWorld("paperclipDesktop", api);
