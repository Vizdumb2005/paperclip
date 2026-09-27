import { existsSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const uiDist = path.join(repoRoot, "ui", "dist");
const serverUiDist = path.join(repoRoot, "server", "ui-dist");

const reuseEnv = (process.env.PAPERCLIP_RELEASE_REUSE_UI_DIST ?? "").toLowerCase();
const shouldReuse = ["1", "true", "yes"].includes(reuseEnv);

if (shouldReuse && existsSync(path.join(uiDist, "index.html"))) {
  console.log("  -> Reusing existing @paperclipai/ui dist output");
} else {
  console.log("  -> Building @paperclipai/ui...");
  execSync("pnpm --filter @paperclipai/ui build", { cwd: repoRoot, stdio: "inherit" });
}

if (!existsSync(path.join(uiDist, "index.html"))) {
  console.error(`Error: UI build output missing at ${path.join(uiDist, "index.html")}`);
  process.exit(1);
}

rmSync(serverUiDist, { recursive: true, force: true });
cpSync(uiDist, serverUiDist, { recursive: true });
console.log("  -> Copied ui/dist to server/ui-dist");
