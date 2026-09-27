import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const srcMigrations = path.join(pkgRoot, "src", "migrations");
const distMigrations = path.join(pkgRoot, "dist", "migrations");
const distMeta = path.join(distMigrations, "meta");

fs.rmSync(distMigrations, { recursive: true, force: true });
fs.mkdirSync(distMeta, { recursive: true });

if (fs.existsSync(srcMigrations)) {
  const files = fs.readdirSync(srcMigrations);
  for (const file of files) {
    if (file.endsWith(".sql")) {
      fs.copyFileSync(path.join(srcMigrations, file), path.join(distMigrations, file));
    }
  }
}

const journalSrc = path.join(srcMigrations, "meta", "_journal.json");
if (fs.existsSync(journalSrc)) {
  fs.copyFileSync(journalSrc, path.join(distMeta, "_journal.json"));
}
