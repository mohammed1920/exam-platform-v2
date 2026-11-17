#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dataDir = process.argv[2];
if (!dataDir) throw new Error('Usage: node build-question-content-manifest.mjs <data-directory>');

const chapters = {};
const entries = await readdir(dataDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const bookDir = join(dataDir, entry.name);
  const files = await readdir(bookDir, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !/^chapter_\d+\.json$/i.test(file.name)) continue;
    const filePath = join(bookDir, file.name);
    const content = await readFile(filePath);
    const key = relative(dataDir, filePath).split(sep).join('/');
    chapters[key] = createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}

const manifest = { version: 1, algorithm: 'sha256-64', chapters };
await writeFile(join(dataDir, 'question-content-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Generated question content manifest for ' + Object.keys(chapters).length + ' chapter file(s).');
