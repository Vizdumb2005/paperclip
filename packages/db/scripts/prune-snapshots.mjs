import fs from "node:fs";
import path from "node:path";

const metaDir = path.resolve("src/migrations/meta");
if (!fs.existsSync(metaDir)) {
  process.exit(0);
}

const files = fs
  .readdirSync(metaDir)
  .filter((f) => f.endsWith("_snapshot.json"))
  .sort()
  .reverse();

// Keep top 5 latest snapshots
const toRemove = files.slice(5);
for (const f of toRemove) {
  try {
    fs.unlinkSync(path.join(metaDir, f));
  } catch {
    // Ignore removal errors
  }
}
