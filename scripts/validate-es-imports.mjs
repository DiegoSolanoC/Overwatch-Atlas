import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.js')) files.push(p);
  }
  return files;
}

const importRe = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
const missing = [];

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const spec = m[1];
    const resolved = path.normalize(path.join(path.dirname(file), spec));
    const candidates = [resolved, resolved + '.js', path.join(resolved, 'index.js')];
    const ok = candidates.some((c) => fs.existsSync(c));
    if (!ok) {
      missing.push({ file: path.relative(root, file), spec });
    }
  }
}

missing.sort((a, b) => a.file.localeCompare(b.file) || a.spec.localeCompare(b.spec));
console.log(`Missing imports: ${missing.length}`);
const filter = process.argv[2];
const rows = filter
  ? missing.filter((r) => r.file.includes(filter) || r.spec.includes(filter))
  : missing;
for (const row of rows) {
  console.log(`${row.file} -> ${row.spec}`);
}
if (!filter && missing.length > rows.length) {
  console.log(`(pass a path fragment as argv[2] to filter; ${missing.length} total)`);
}
