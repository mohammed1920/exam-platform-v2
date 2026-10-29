#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// Generate manifests only in the deployment bundle; source manifests remain untouched.
const root = path.resolve(process.argv[2] || 'data/petitions');
const docsDir = path.join(root, 'documents');
const categories = JSON.parse(fs.readFileSync(path.join(root, 'categories.json'), 'utf8'));
if (!fs.existsSync(docsDir)) throw new Error('Petition documents directory not found: ' + docsDir);
const categoryById = new Map(categories.map(c => [c.id, c]));
function collectJsonFiles(directory, relative = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(absolute, rel);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [{ absolute, relative: rel }] : [];
  });
}
const files = collectJsonFiles(docsDir).sort((a,b)=>a.relative.localeCompare(b.relative,'en'));
const seenUids = new Set();
const grouped = new Map(categories.map(c => [c.id, []]));
for (const file of files) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file.absolute, 'utf8')); }
  catch (e) { throw new Error('Invalid JSON in ' + file.relative + ': ' + e.message); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('Document must be a JSON object: ' + file.relative);
  if (typeof doc.uid !== 'string' || !doc.uid.trim()) throw new Error('Missing uid in ' + file.relative);
  if (seenUids.has(doc.uid)) throw new Error('Duplicate petition uid "' + doc.uid + '" in ' + file.relative);
  seenUids.add(doc.uid);
  if (typeof doc.name !== 'string' || !doc.name.trim()) throw new Error('Missing name in ' + file.relative);
  if (typeof doc.body !== 'string' || !doc.body.trim()) throw new Error('Document must contain a non-empty body string: ' + file.relative);
  if (!categoryById.has(doc.categoryId)) throw new Error('Missing/invalid categoryId in ' + file.relative + '. Allowed: ' + [...categoryById.keys()].join(', '));
  grouped.get(doc.categoryId).push({uid:doc.uid,baseName:doc.name.trim(),category:categoryById.get(doc.categoryId).name,description:typeof doc.description==='string'?doc.description:'',icon:typeof doc.icon==='string'&&doc.icon?doc.icon:'fas fa-file-signature',document:'data/petitions/documents/'+file.relative});
}
for (const category of categories) {
  const list = grouped.get(category.id);
  const totals = new Map();
  for (const item of list) totals.set(item.baseName,(totals.get(item.baseName)||0)+1);
  const seenNames = new Set();
  const manifest = list.map(item => {
    let name = item.baseName;
    if (totals.get(item.baseName)>1) {
      const occurrence=list.slice(0,list.indexOf(item)+1).filter(x=>x.baseName===item.baseName).length;
      if (occurrence>1) name=item.baseName+' ('+occurrence+')';
    }
    if (seenNames.has(name)) {
      let n=2; while(seenNames.has(item.baseName+' ('+n+')')) n++;
      name=item.baseName+' ('+n+')';
    }
    seenNames.add(name);
    return {uid:item.uid,name,category:item.category,description:item.description,icon:item.icon,document:item.document};
  });
  fs.writeFileSync(path.join(root,category.id+'.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(category.id+': '+manifest.length+' petition(s)');
}
console.log('Petition index generated successfully.');
