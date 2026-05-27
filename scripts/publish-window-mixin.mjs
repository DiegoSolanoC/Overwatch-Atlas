import fs from 'fs';

const [path, globalName] = process.argv.slice(2);
let s = fs.readFileSync(path, 'utf8');
if (!s.includes('export const mixin')) {
    console.log('skip', path);
    process.exit(0);
}
const body = s.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '');
const inner = body.replace('export const mixin = ', '');
const out = `/**\n * @see ${path}\n */\n(function (global) {\n    global.${globalName} = ${inner.trimEnd().replace(/;\s*$/, '')};\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
fs.writeFileSync(path, out);
console.log('published', globalName, 'from', path);
