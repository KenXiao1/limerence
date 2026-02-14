/**
 * check-loc.mjs — Enforce max lines-of-code per source file.
 * Usage: node scripts/check-loc.mjs [--max N] [dir]
 * Defaults: max=500, dir=src/
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
let maxLines = 500;
let rootDir = "src";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max" && args[i + 1]) {
    maxLines = Number(args[++i]);
  } else {
    rootDir = args[i];
  }
}

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(full);
    } else {
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (EXTENSIONS.has(ext)) yield full;
    }
  }
}

let violations = 0;

for await (const file of walk(rootDir)) {
  const content = await readFile(file, "utf-8");
  const lines = content.split("\n").length;
  if (lines > maxLines) {
    const rel = relative(".", file).replace(/\\/g, "/");
    console.error(`  FAIL  ${rel} — ${lines} lines (max ${maxLines})`);
    violations++;
  }
}

if (violations > 0) {
  console.error(`\n${violations} file(s) exceed ${maxLines} lines.`);
  process.exit(1);
} else {
  console.log(`All source files are within ${maxLines} lines.`);
}
