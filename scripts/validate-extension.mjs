import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.argv[2] || ".";
const manifestPath = join(root, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error(`Missing manifest at ${manifestPath}. Run npm run build first.`);
}

JSON.parse(readFileSync(manifestPath, "utf8"));

const jsFiles = await collectJsFiles(root);
let failed = false;

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`${manifestPath} ok; ${jsFiles.length} JavaScript files passed syntax check`);

async function collectJsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectJsFiles(path);
      return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
    })
  );
  return files.flat();
}
