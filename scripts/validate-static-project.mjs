#!/usr/bin/env node
/**
 * Static integrity checks for the Mizan repository.
 * Intentionally does not execute browser code or mutate project files.
 */
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set([".git", "node_modules", ".vercel", ".next"]);
const files = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(full);
  }
}

function display(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const failures = [];
await walk(root);

const jsonFiles = files.filter(file => file.endsWith(".json"));
for (const file of jsonFiles) {
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON: ${display(file)} — ${error.message}`);
  }
}

const cssFiles = files.filter(file => file.endsWith(".css"));
const cssContents = await Promise.all(cssFiles.map(file => readFile(file, "utf8")));
const definedRadiusTokens = new Set();
for (const css of cssContents) {
  for (const match of css.matchAll(/(--mizan-radius-[\w-]+)\s*:/g)) definedRadiusTokens.add(match[1]);
}
for (let i = 0; i < cssFiles.length; i++) {
  for (const match of cssContents[i].matchAll(/var\(\s*(--mizan-radius-[\w-]+)/g)) {
    if (!definedRadiusTokens.has(match[1])) {
      failures.push(`Undefined Mizan radius token in ${display(cssFiles[i])}: ${match[1]}`);
    }
  }
}

// Resolve local CSS url(...) and @import references as well as HTML assets.
async function checkLocalReference(ownerFile, raw, label) {
  const value = raw.trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|data:|blob:)/i.test(value)) return;
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) return;
  const ownerDir = clean.startsWith("/") ? root : path.dirname(ownerFile);
  const resolved = path.resolve(ownerDir, clean.replace(/^\\//, ""));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    failures.push(`Unsafe local ${label} in ${display(ownerFile)}: ${value}`);
    return;
  }
  try {
    await access(resolved);
  } catch {
    failures.push(`Missing local ${label} in ${display(ownerFile)}: ${value}`);
  }
}

const htmlFiles = files.filter(file => /\.html?$/i.test(file));
const referencePattern = /<(?:script\b[^>]*?\bsrc|link\b[^>]*?\bhref)\s*=\s*(["'])(.*?)\1/gi;
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  for (const match of html.matchAll(referencePattern)) {
    const raw = match[2].trim();
    if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    if (!clean) continue;
    const resolved = path.resolve(root, clean.replace(/^\.\//, "").replace(/^\//, ""));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      failures.push(`Unsafe local reference in ${display(htmlFile)}: ${raw}`);
      continue;
    }
    try {
      await access(resolved);
    } catch {
      failures.push(`Missing local asset in ${display(htmlFile)}: ${raw}`);
    }
  }
}

// CSS asset paths are relative to the stylesheet, not the repository root.
const cssReferencePattern = /(?:url\(\s*|@import\s+)(["']?)([^"'()\s]+)\1\s*\)?/gi;
for (const cssFile of cssFiles) {
  const css = await readFile(cssFile, "utf8");
  for (const match of css.matchAll(cssReferencePattern)) {
    await checkLocalReference(cssFile, match[2], "CSS asset");
  }
}
if (failures.length) {
  console.error(`Static integrity checks failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Static integrity checks passed: ${htmlFiles.length} HTML file(s), ${cssFiles.length} CSS file(s), ${jsonFiles.length} JSON file(s), local HTML assets and Mizan radius tokens verified.`);
}
