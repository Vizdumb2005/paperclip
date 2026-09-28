import esbuild from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });

async function build() {
  console.log("Building Paperclip Desktop bundle...");

  // Build Main process
  await esbuild.build({
    entryPoints: [path.join(root, "src/main.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: path.join(root, "dist/main.cjs"),
    external: ["electron"],
    sourcemap: true,
  });

  // Build Preload script
  await esbuild.build({
    entryPoints: [path.join(root, "src/preload.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: path.join(root, "dist/preload.cjs"),
    external: ["electron"],
    sourcemap: true,
  });

  console.log("Desktop build finished successfully: dist/main.cjs, dist/preload.cjs");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
