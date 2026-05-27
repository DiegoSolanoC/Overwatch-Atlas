/**
 * One-off helper: extract class methods into a prototype mixin object file.
 * Usage: node scripts/extract-class-methods.mjs <source.js> <outMixin.js> method1 method2 ...
 */
import fs from 'fs';

const [sourcePath, outPath, ...methodNames] = process.argv.slice(2);
if (!sourcePath || !outPath || !methodNames.length) {
    console.error('Usage: node extract-class-methods.mjs <source> <out> <methods...>');
    process.exit(1);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const lines = source.split(/\r?\n/);

function findMethodStart(name) {
    const patterns = [
        new RegExp(`^    (async )?${name}\\s*\\(`),
        new RegExp(`^    ${name}\\s*\\(`)
    ];
    for (let i = 0; i < lines.length; i++) {
        for (const re of patterns) {
            if (re.test(lines[i])) return i;
        }
    }
    return -1;
}

function extractBlock(startLine) {
    let depth = 0;
    let started = false;
    const chunk = [];
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === '{') {
                depth++;
                started = true;
            } else if (ch === '}') {
                depth--;
            }
        }
        chunk.push(line);
        if (started && depth === 0) {
            return { chunk, endLine: i };
        }
    }
    throw new Error(`Unclosed block starting at line ${startLine + 1}`);
}

const methods = [];
let removeRanges = [];

for (const name of methodNames) {
    const start = findMethodStart(name);
    if (start < 0) {
        console.error(`Method not found: ${name}`);
        process.exit(1);
    }
    const { chunk, endLine } = extractBlock(start);
    methods.push({ name, chunk, start, endLine });
    removeRanges.push({ start, endLine });
}

removeRanges.sort((a, b) => b.start - a.start);

const header = `/**
 * Extracted from ${sourcePath.replace(/\\/g, '/')}
 * Mixed onto the host class via Object.assign(Prototype, mixin).
 */
`;

let body = 'export const mixin = {\n';
for (const { chunk } of methods) {
    const inner = chunk.join('\n');
    const trimmed = inner.replace(/^    /gm, '    ');
    const asMethod = trimmed.replace(/^    (async )?(\w+)/, '    $2');
    body += asMethod + ',\n\n';
}
body += '};\n';

fs.mkdirSync(outPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/'), { recursive: true });
fs.writeFileSync(outPath, header + body);

let newLines = [...lines];
for (const { start, endLine } of removeRanges) {
    newLines.splice(start, endLine - start + 1);
}
fs.writeFileSync(sourcePath, newLines.join('\n'));
console.log(`Wrote ${outPath}, removed ${methodNames.length} methods from ${sourcePath}`);
