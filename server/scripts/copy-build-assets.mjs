import { existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverDir, "..");

const assetDirectories = [
  { src: path.join(serverDir, "src", "onboarding-assets"), dest: path.join(serverDir, "dist", "onboarding-assets") },
  { src: path.join(serverDir, "src", "built-ins"), dest: path.join(serverDir, "dist", "built-ins") },
  { src: path.join(serverDir, "src", "services", "scripts"), dest: path.join(serverDir, "dist", "services", "scripts") },
  { src: path.join(repoRoot, "packages", "paperclip-runner", "dist"), dest: path.join(serverDir, "dist", "vendor", "paperclip-runner") },
];

for (const { src, dest } of assetDirectories) {
  if (existsSync(src)) {
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
}
