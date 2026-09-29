import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import process from "node:process";

export interface ServerManagerOptions {
  preferredPort?: number;
  appRoot: string;
  isPackaged: boolean;
  onStatus?: (status: string) => void;
  onLog?: (log: string) => void;
  /**
   * File the spawned server's stdout/stderr is appended to. The packaged app
   * has no visible console, so without this a startup failure is
   * undiagnosable. Main passes app.getPath("userData")/logs/server.log.
   */
  /**
   * File the spawned server's stdout/stderr is appended to. The packaged app
   * has no visible console, so without this a startup failure is
   * undiagnosable. Main passes app.getPath("userData")/logs/server.log.
   */
  logFile?: string;
  /**
   * Absolute path to the packaged server entry
   * (<resources>/server/dist/index.js). Used only when no repo checkout is
   * found; dev checkouts keep booting from source.
   */
  bundledServerPath?: string;
}

// Cold boots through tsx (transform + embedded Postgres init + migrations)
// measured ~40s warm on dev hardware; first boots run longer. The old 60s cap
// turned slow-but-healthy startups into a scary error dialog.
const STARTUP_TIMEOUT_SECONDS = 240;

function findRepoRoot(startDir: string): string | null {
  let curr = startDir;
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(curr, "server/src/index.ts")) &&
      fs.existsSync(path.join(curr, "package.json"))
    ) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

export class ServerManager {
  private port: number = 3100;
  private childProc: ChildProcess | null = null;
  private options: ServerManagerOptions;
  private isRunning: boolean = false;
  private lastStderr: string = "";
  private childExitCode: number | null = null;
  private childSpawnError: string = "";

  constructor(options: ServerManagerOptions) {
    this.options = options;
    this.port = options.preferredPort ?? 3100;
  }

  getPort(): number {
    return this.port;
  }

  async start(): Promise<number> {
    // 1. Check if an instance is already alive on the port
    const alreadyAlive = await this.checkHealth(this.port);
    if (alreadyAlive) {
      this.options.onStatus?.(`Found active Paperclip server on port ${this.port}`);
      this.isRunning = true;
      return this.port;
    }

    this.options.onStatus?.("Starting Paperclip control plane server...");

    // If something is already listening on the port but it is not a healthy
    // Paperclip server (e.g. another `pnpm dev` still booting, or an unrelated
    // process), spawning a second server only makes it worse: the server
    // auto-selects the next free port while this manager keeps polling the
    // preferred one until the startup timeout. Fail fast with an actionable error.
    if (await this.isPortOccupied(this.port)) {
      throw new Error(
        `Port ${this.port} is already in use by another process that is not a healthy Paperclip server. ` +
          `Stop the other process (or wait for it to finish starting) and relaunch Paperclip.`,
      );
    }

    // Locate repository or packaged root
    const cwdRepo = findRepoRoot(process.cwd());
    const appRepo = findRepoRoot(this.options.appRoot);
    const repoRoot = cwdRepo || appRepo;

    let execCmd = "node";
    let execArgs: string[] = [];
    let spawnCwd = this.options.appRoot;
    // Set for the packaged fallback (Electron's own node); dev branches leave
    // the ambient environment untouched.
    let runAsNode = false;

    if (repoRoot) {
      spawnCwd = path.join(repoRoot, "server");
      const tsxCli = path.join(repoRoot, "cli/node_modules/tsx/dist/cli.mjs");
      const serverSrc = path.join(repoRoot, "server/src/index.ts");

      if (fs.existsSync(tsxCli) && fs.existsSync(serverSrc)) {
        execCmd = "node";
        execArgs = [tsxCli, serverSrc];
      } else {
        execCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
        execArgs = ["--filter", "@paperclipai/server", "dev"];
        spawnCwd = repoRoot;
      }
    } else {
      // Packaged fallback: server bundle shipped under Electron resources
      // (extraResources "server"). It runs on Electron's own node via
      // ELECTRON_RUN_AS_NODE so no system node is required, with the same
      // tsx loader production Docker uses.
      const serverRoot = this.options.bundledServerPath
        ? path.dirname(path.dirname(this.options.bundledServerPath))
        : path.join(this.options.appRoot, "server");
      const bundledServer = path.join(serverRoot, "dist", "index.js");
      if (!fs.existsSync(bundledServer)) {
        throw new Error(
          `Packaged server bundle not found at ${bundledServer}. ` +
            `Reinstall Paperclip — launch from a Paperclip repo checkout instead.`,
        );
      }
      execCmd = process.execPath;
      execArgs = [
        "--import",
        path.join(serverRoot, "node_modules", "tsx", "dist", "loader.mjs"),
        bundledServer,
      ];
      spawnCwd = serverRoot;
      runAsNode = true;
    }

    const env: Record<string, string | undefined> = {
      ...process.env,
      PORT: String(this.port),
      NODE_ENV: "development",
      PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
      PAPERCLIP_MIGRATION_PROMPT: "never",
    };
    if (runAsNode) {
      env.ELECTRON_RUN_AS_NODE = "1";
    }

    try {
      this.childProc = spawn(execCmd, execArgs, {
        cwd: spawnCwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
        windowsHide: true,
      });

      this.childProc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        this.appendServerLog(`[server] ${text}`);
        this.options.onLog?.(`[server] ${text}`);
        const clean = text
          .replace(/\u001b\[[0-9;]*m/g, "")
          .replace(/\[\d{2}:\d{2}:\d{2}\]\s+[A-Z]+:\s+/, "")
          .trim();
        if (
          clean.length > 0 &&
          clean.length < 80 &&
          !/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//.test(clean)
        ) {
          this.options.onStatus?.(clean);
        }
      });

      this.childProc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        this.lastStderr = text;
        this.appendServerLog(`[server:err] ${text}`);
        this.options.onLog?.(`[server:err] ${text}`);
      });

      this.childProc.on("exit", (code: number | null) => {
        this.isRunning = false;
        this.childExitCode = code;
        if (code !== 0 && code !== null) {
          this.options.onStatus?.(`Server stopped with code ${code}. ${this.lastStderr}`);
        }
      });

      this.childProc.on("error", (err: Error) => {
        this.childSpawnError = err.message;
      });

      // Wait for health check to pass
      await this.waitForHealthy(STARTUP_TIMEOUT_SECONDS, 1000);
      this.isRunning = true;
      this.options.onStatus?.("Paperclip control plane ready!");
      return this.port;
    } catch (err: any) {
      this.options.onStatus?.(`Failed to launch server: ${err.message}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
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
        } catch {}
        resolve();
      }, 5000);

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

  private appendServerLog(text: string): void {
    const logFile = this.options.logFile;
    if (!logFile) return;
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, text);
    } catch {
      // Logging must never break startup.
    }
  }

  private async waitForHealthy(maxAttempts: number, intervalMs: number): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.childSpawnError) {
        throw new Error(`Server failed to launch: ${this.childSpawnError}`);
      }
      if (this.childExitCode !== null && this.childExitCode !== 0) {
        throw new Error(
          `Server crashed on startup (exit code ${this.childExitCode})${this.lastStderr ? `: ${this.lastStderr.trim().slice(-500)}` : ""}`,
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
      `Server failed to report healthy on port ${this.port} after ${maxAttempts} seconds` +
        (this.lastStderr ? `. Server output: ${this.lastStderr.trim().slice(-500)}` : ". Check that no other process is using the port.") +
        (this.options.logFile ? ` Full server log: ${this.options.logFile}` : ""),
    );
  }

  private isPortOccupied(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(2000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private checkHealth(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/health",
          timeout: 2000,
        },
        (res: http.IncomingMessage) => {
          resolve(res.statusCode === 200);
        },
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}
