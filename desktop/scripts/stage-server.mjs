import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..");

const stagingDir = process.argv[2] ?? path.join(desktopRoot, "build", "server");

function copyEntry(from, to) {
  const stat = fs.lstatSync(from);
  if (stat.isSymbolicLink()) {
    // Preserve pnpm's junctions as junctions (no privilege needed to
    // recreate, unlike symlinks). File links are rare in pnpm layouts;
    // materialize those as plain copies.
    const target = fs.readlinkSync(from);
    let isDir = false;
    try {
      isDir = fs.statSync(path.resolve(path.dirname(from), target)).isDirectory();
    } catch {}
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try {
      fs.unlinkSync(to);
    } catch {}
    if (isDir && process.platform === "win32") {
      fs.symlinkSync(target, to, "junction");
    } else if (isDir) {
      fs.symlinkSync(target, to, "dir");
    } else {
      fs.copyFileSync(fs.realpathSync(from), to);
    }
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyEntry(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(src, dest) {
  copyEntry(src, dest);
}

/**
 * Apply each workspace package's publishConfig (dist-mapped exports) to its
 * staging copy. The repo's workspace exports point at ./src/*.ts for tsx-dev;
 * the published layout (what npm consumers and this bundle get) points at
 * ./dist/*.js. Without this the staged server fails with ERR_MODULE_NOT_FOUND
 * for e.g. @paperclipai/db/src/index.ts.
 */
function applyPublishConfigs(stagingNodeModules) {
  const scopeDir = path.join(stagingNodeModules, "@paperclipai");
  if (!fs.existsSync(scopeDir)) return;
  for (const name of fs.readdirSync(scopeDir)) {
    const pkgPath = path.join(scopeDir, name, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const publish = pkg.publishConfig;
    if (!publish) continue;
    let changed = false;
    for (const key of ["exports", "main", "types"]) {
      if (publish[key] !== undefined) {
        pkg[key] = publish[key];
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
      console.log(`[stage-server] applied publishConfig for @paperclipai/${name}`);
    }
  }
}

console.log(`[stage-server] deploying production server to ${stagingDir}`);
fs.rmSync(stagingDir, { recursive: true, force: true });
execSync(
  `pnpm --filter @paperclipai/server deploy "${stagingDir}" --prod`,
  { cwd: repoRoot, stdio: "inherit", shell: true },
);

const uiDist = path.join(repoRoot, "ui", "dist");
if (!fs.existsSync(path.join(uiDist, "index.html"))) {
  throw new Error(`UI dist not found at ${uiDist} — run pnpm build first.`);
}
console.log("[stage-server] copying ui/dist -> ui-dist");
copyDir(uiDist, path.join(stagingDir, "ui-dist"));

console.log("[stage-server] applying publishConfig exports");
applyPublishConfigs(path.join(stagingDir, "node_modules"));

const loader = path.join(stagingDir, "node_modules", "tsx", "dist", "loader.mjs");
if (!fs.existsSync(loader)) {
  throw new Error(`tsx loader missing at ${loader} — is tsx a production dependency of @paperclipai/server?`);
}
if (!fs.existsSync(path.join(stagingDir, "dist", "index.js"))) {
  throw new Error(`server bundle missing at ${path.join(stagingDir, "dist", "index.js")} — run pnpm build first.`);
}

console.log("[stage-server] done");
