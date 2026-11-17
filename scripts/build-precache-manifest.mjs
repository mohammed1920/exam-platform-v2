#!/usr/bin/env node
/**
 * Build a small PWA precache list from the public entry page.
 * Only assets referenced by index.html and its CSS dependency graph are included.
 * Lazy-loaded section modules and administration-only assets stay lazy.
 */
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(process.argv[2] || "");
if (!process.argv[2]) {
  console.error("Usage: node scripts/build-precache-manifest.mjs <built-output-directory>");
  process.exit(1);
}

const htmlPath = path.join(outputDir, "index.html");
const html = await readFile(htmlPath, "utf8");
const assets = new Set();
const visitedCss = new Set();

function localPath(raw) {
  const value = String(raw || "").trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|data:|blob:)/i.test(value)) return null;
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) return null;
  const resolved = path.resolve(outputDir, clean.replace(/^\.\//, "").replace(/^\/+/, ""));
  if (resolved !== outputDir && !resolved.startsWith(outputDir + path.sep)) {
    throw new Error(`Unsafe precache reference: ${value}`);
  }
  return resolved;
}

async function addAsset(raw, baseDir = outputDir, preserveRequestUrl = false) {
  const value = String(raw || "").trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|data:|blob:)/i.test(value)) return;
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) return;
  // Artwork URLs stored as shared palette tokens are consumed by home.css.
  // Match the established resolution rule in validate-static-project.mjs.
  const relativeBase = path.relative(outputDir, baseDir).split(path.sep).join("/");
  const isHomeCardArtworkToken = relativeBase === "assets/shared/css"
    && clean.includes("images/home-cards/");
  const assetBaseDir = isHomeCardArtworkToken
    ? path.join(outputDir, "assets/features/home/css")
    : baseDir;
  const resolved = path.resolve(assetBaseDir, clean.replace(/^\.\//, "").replace(/^\/+/, ""));
  if (resolved !== outputDir && !resolved.startsWith(outputDir + path.sep)) {
    throw new Error(`Unsafe precache reference: ${value}`);
  }
  await access(resolved);
  const relativePath = path.relative(outputDir, resolved).split(path.sep).join("/");
  const suffix = value.match(/[?#].*$/)?.[0] || "";
  const relative = preserveRequestUrl
    ? value.replace(/^\.\//, "").replace(/^\/+/, "")
    : relativePath + suffix;
  assets.add(relative);

  if (/\.css$/i.test(resolved) && !visitedCss.has(resolved)) {
    visitedCss.add(resolved);
    const css = await readFile(resolved, "utf8");
    const references = [
      ...Array.from(css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi), match => match[2] ?? match[3] ?? ""),
      ...Array.from(css.matchAll(/@import\s+(?!url\s*\()(["'])(.*?)\1/gi), match => match[2])
    ];
    for (const reference of references) {
      await addAsset(reference, path.dirname(resolved));
    }
  }
}

const htmlAssetPattern = /<(?:script|link|img|source|audio|video)\b[^>]*?\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gi;
for (const match of html.matchAll(htmlAssetPattern)) {
  const reference = match[2];
  const resolved = localPath(reference);
  if (!resolved) continue;
  await addAsset(reference, outputDir, true);
}

const manifest = [...assets].sort();
for (const relative of manifest) {
  const clean = relative.split(/[?#]/, 1)[0];
  const resolved = path.resolve(outputDir, clean);
  await access(resolved);
}
await writeFile(path.join(outputDir, "precache-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`PWA precache manifest generated: ${manifest.length} entry/entries from index.html and its CSS dependencies.`);
