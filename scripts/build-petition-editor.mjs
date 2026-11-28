import { build } from 'esbuild';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const entry = path.join(root, 'assets/features/petitions/js/petition-editor.entry.js');
const output = path.join(root, 'assets/features/petitions/js/petition-editor.bundle.js');
await access(entry);
await mkdir(path.dirname(output), { recursive: true });
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  legalComments: 'none'
});
console.log('Tiptap petition editor bundle built:', path.relative(root, output));
