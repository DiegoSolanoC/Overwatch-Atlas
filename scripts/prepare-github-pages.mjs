/**
 * Copies the static site into _site/ for GitHub Pages, excluding dev-only paths.
 * Run after generate-manifest.js: npm run build:pages
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');

const EXCLUDE_NAMES = new Set([
    '.git',
    '.github',
    'node_modules',
    '_site',
    '.cursor',
    'terminals',
]);

function shouldCopyName(name) {
    if (EXCLUDE_NAMES.has(name)) return false;
    if (name === '.env' || name === '.env.local') return false;
    return true;
}

function copyRecursive(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const ent of entries) {
        if (!shouldCopyName(ent.name)) continue;
        const from = path.join(srcDir, ent.name);
        const to = path.join(destDir, ent.name);
        if (ent.isDirectory()) {
            copyRecursive(from, to);
        } else if (ent.isSymbolicLink()) {
            continue;
        } else {
            fs.copyFileSync(from, to);
        }
    }
}

fs.rmSync(OUT, { recursive: true, force: true });
copyRecursive(ROOT, OUT);

// Ensure Jekyll is disabled on Pages
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// Mark deploy as static so runtime matches GitHub Pages (file over localStorage, no /api writes)
const siteIndex = path.join(OUT, 'index.html');
if (fs.existsSync(siteIndex)) {
    let html = fs.readFileSync(siteIndex, 'utf8');
    if (!/name=["']timeline-deploy["']/i.test(html)) {
        const marker = '<meta name="timeline-deploy" content="static">';
        if (/<meta\s+charset=/i.test(html)) {
            html = html.replace(/(<meta\s+charset=["']UTF-8["']\s*\/?>)/i, `$1\n    ${marker}`);
        } else {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${marker}`);
        }
        fs.writeFileSync(siteIndex, html, 'utf8');
    }
}

console.log('GitHub Pages output:', OUT);
