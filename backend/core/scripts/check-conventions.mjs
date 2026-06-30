#!/usr/bin/env node
/**
 * Convention checker for backend/core — enforces the rules in CLAUDE.md.
 *
 * Usage:
 *   node scripts/check-conventions.mjs            # scan all of src/
 *   node scripts/check-conventions.mjs <files...> # scan specific files
 *
 * Exits non-zero if any violation is found. Dependency-free (Node/Bun built-ins)
 * so it runs in a git pre-commit hook and a Claude Code hook alike.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url))); // backend/core
const SRC = join(ROOT, "src");

// A rule fires when `pattern` matches a non-comment line in a file for which
// `applies(rel)` is true. `rel` is the path relative to backend/core.
const rules = [
  {
    id: "no-console",
    pattern: /\bconsole\.(log|info|warn|error|debug)\s*\(/,
    message: "Use the pino `logger` (utils/logger.ts), not console.*",
    applies: (rel) => !rel.includes("/scripts/"),
  },
  {
    id: "no-raw-res",
    pattern: /\bres\.(status\s*\([^)]*\)\s*\.\s*)?(json|send)\s*\(/,
    message:
      "Return through ApiResponse.* / throw ApiError — don't write res.json/res.status directly",
    // Only controllers/routes/middleware hold an Express Response. The response/
    // error plumbing is the one place there that's allowed to touch res.json;
    // services/config never have an Express `res` (e.g. a fetch Response).
    applies: (rel) =>
      (rel.includes("/controllers/") ||
        rel.includes("/routes/") ||
        rel.includes("/middleware/")) &&
      !rel.endsWith("responses/apiResponse.ts") &&
      !rel.endsWith("middleware/errorHandler.ts"),
  },
  {
    id: "no-direct-process-env",
    pattern: /\bprocess\.env\b/,
    message: "Read validated config from config/env.ts, not process.env",
    // config/ owns env parsing; logger reads LOG_LEVEL/NODE_ENV at import time.
    applies: (rel) =>
      !rel.startsWith("src/config/") && !rel.endsWith("utils/logger.ts"),
  },
  {
    id: "no-bare-throw-error",
    pattern: /\bthrow\s+new\s+Error\s*\(/,
    message: "Throw an ApiError.* factory (utils/appError.ts), not a bare Error",
    // config/ runs at boot (before the HTTP error handler exists) — a hard
    // crash is the correct failure there, so bare Error is allowed.
    applies: (rel) => !rel.startsWith("src/config/"),
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const isComment = (line) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const argFiles = process.argv.slice(2).filter((f) => f.endsWith(".ts"));
const files = (argFiles.length ? argFiles.map((f) => resolve(f)) : walk(SRC))
  .filter((f) => f.startsWith(SRC)); // only lint backend/core/src

let violations = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  let lines;
  try {
    lines = readFileSync(file, "utf8").split("\n");
  } catch {
    continue; // file deleted in this commit, etc.
  }
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    for (const rule of rules) {
      if (rule.applies(rel) && rule.pattern.test(line)) {
        violations++;
        console.error(
          `✖ ${rel}:${i + 1}  [${rule.id}] ${rule.message}\n    ${line.trim()}`,
        );
      }
    }
  });
}

if (violations > 0) {
  console.error(
    `\n${violations} convention violation(s). See backend/core/CLAUDE.md.`,
  );
  process.exit(1);
}
console.log("✓ conventions OK");
