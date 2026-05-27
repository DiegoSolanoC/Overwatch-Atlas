import fs from 'fs';
const [file, ...needles] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const idx = lines.findIndex((l) => needles.some((n) => l.includes(n)));
if (idx < 0) throw new Error('needle not found: ' + needles.join(', '));
const head = lines.slice(0, idx).join('\n').trimEnd();
fs.writeFileSync(file, head + '\n}\n');
console.log('trimmed', file, 'at line', idx + 1);
